// OpenAI Images API client (gpt-image-2.5-*) — the only image provider.
//
//   /v1/images/generations  when there are no reference images
//   /v1/images/edits        multipart, up to 16 `image[]` references
//
// Verified against the official docs (developers.openai.com, 2026-09-27) and live calls:
//   - sizes: WIDTHxHEIGHT, both multiples of 16, each edge ≤ 3840, aspect 1:3…3:1,
//     total pixels 655,360 … 8,294,400
//   - quality: low | medium | high | xhigh | max | auto (2.5 models)
//   - GPT image models always return base64 (`b64_json`) — never a temporary URL
//   - `input_fidelity` returns 400 on 2.x models → never sent
//   - output_format jpeg + output_compression (higher = better quality, measured)
//   - pricing (both 2.5 models): $5/1M text in, $8/1M image in, $30/1M out
//   - rate limits are per tier (images/min + tokens/min); this account is tier 3
//     (50 images/min, 800k TPM). The images endpoint sends no x-ratelimit headers,
//     so we cap in-flight calls per process and back off on 429.

import { ProviderUnavailableError } from "@/lib/fulfilment/provider-errors";
import { describeError, isNetworkError } from "./net-retry";

const API_BASE = "https://api.openai.com/v1/images";
const PROVIDER = "openai";

export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";

export interface ImageReference {
  data: Buffer;
  /** image/png | image/jpeg | image/webp */
  mime: string;
}

export interface ImageUsage {
  input_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  output_tokens?: number;
  total_tokens?: number;
}

export interface OpenAIImageRequest {
  model: string;
  quality: ImageQuality;
  /** "WIDTHxHEIGHT" (validated here) */
  size: string;
  prompt: string;
  references?: ImageReference[];
  /** jpeg (default, 95) keeps print files small; png for lossless needs */
  outputFormat?: "jpeg" | "png" | "webp";
  outputCompression?: number;
  /** Short tag for logs, e.g. "story abc scene 3" */
  label: string;
  /** Epoch ms after which no attempt may start / run (pipeline time budget) */
  deadline?: number;
}

export interface OpenAIImageResult {
  image: Buffer;
  mime: string;
  size: string;
  model: string;
  quality: ImageQuality;
  usage: ImageUsage;
  costUsd: number;
  ms: number;
}

/** Non-retryable request failures (moderation, bad parameters). */
export class ImageRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ImageRequestError";
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

const RATES_PER_TOKEN = { textIn: 5 / 1e6, imageIn: 8 / 1e6, out: 30 / 1e6 };
const MAX_REFERENCES = 16;

function numberEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Per-attempt timeout. `max` quality measured 172 s; 240 s leaves headroom. */
const timeoutMs = () => numberEnv("OPENAI_IMAGE_TIMEOUT_MS", 240_000);
const maxAttempts = () => numberEnv("OPENAI_IMAGE_MAX_ATTEMPTS", 3);
/**
 * Attempts when the request never reached OpenAI (DNS failure, refused/reset
 * connection: `TypeError: fetch failed`). Such a failure costs nothing and a
 * connectivity blip routinely lasts longer than the 2 s + 4 s of the HTTP
 * retry policy, so it gets its own, longer budget (backoff 2, 4, 8, 15, 15 s ≈ 44 s),
 * still bounded by the caller's deadline.
 */
const maxNetworkAttempts = () => numberEnv("OPENAI_IMAGE_NETWORK_ATTEMPTS", 6);
const MAX_BACKOFF_MS = 15_000;
/** In-flight calls per process. A book is ~14 parallel calls; tier 3 allows 50/min. */
const concurrency = () => numberEnv("OPENAI_IMAGE_CONCURRENCY", 14);

export function openAIKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key && !key.includes("your_") && !key.includes("_here") ? key : null;
}

// ── Size validation ──────────────────────────────────────────────────────────

export function parseSize(size: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) throw new Error(`Invalid image size "${size}"`);
  const width = Number(m[1]);
  const height = Number(m[2]);
  const pixels = width * height;
  const ratio = width / height;
  if (width % 16 || height % 16) throw new Error(`Image size ${size}: edges must be multiples of 16`);
  if (width > 3840 || height > 3840) throw new Error(`Image size ${size}: edge exceeds 3840`);
  if (pixels < 655_360 || pixels > 8_294_400) throw new Error(`Image size ${size}: ${pixels} px outside 655,360–8,294,400`);
  if (ratio > 3 || ratio < 1 / 3) throw new Error(`Image size ${size}: aspect outside 1:3–3:1`);
  return { width, height };
}

// ── Concurrency limiter ──────────────────────────────────────────────────────

let active = 0;
const waiters: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < concurrency()) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}

function release(): void {
  active--;
  waiters.shift()?.();
}

// ── Errors ───────────────────────────────────────────────────────────────────

interface ApiErrorBody {
  error?: { message?: string; code?: string | null; type?: string | null };
}

const BILLING_CODES = new Set(["insufficient_quota", "billing_hard_limit_reached", "billing_not_active"]);

class RetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
    /** No HTTP response at all (connectivity) — see maxNetworkAttempts */
    readonly network = false,
  ) {
    super(message);
  }
}

function toError(status: number, body: string, retryAfter: string | null): Error {
  let parsed: ApiErrorBody = {};
  try {
    parsed = JSON.parse(body) as ApiErrorBody;
  } catch {
    /* non-JSON body */
  }
  const code = parsed.error?.code ?? parsed.error?.type ?? undefined;
  const message = `OpenAI images ${status}${code ? ` (${code})` : ""}: ${(parsed.error?.message ?? body).slice(0, 300)}`;

  if (code && BILLING_CODES.has(code)) return new ProviderUnavailableError(PROVIDER, "out_of_credits", message, status);
  if (status === 402) return new ProviderUnavailableError(PROVIDER, "out_of_credits", message, status);
  if (status === 401 || status === 403) return new ProviderUnavailableError(PROVIDER, "auth", message, status);
  if (status === 429 || status >= 500) {
    const seconds = Number(retryAfter);
    return new RetryableError(message, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined);
  }
  return new ImageRequestError(message, status, code);
}

// ── Request ──────────────────────────────────────────────────────────────────

function buildRequest(req: OpenAIImageRequest, key: string): { url: string; init: RequestInit } {
  const format = req.outputFormat ?? "jpeg";
  const fields: Record<string, string> = {
    model: req.model,
    prompt: req.prompt,
    size: req.size,
    quality: req.quality,
    n: "1",
    output_format: format,
  };
  if (format !== "png") fields.output_compression = String(req.outputCompression ?? 95);

  const refs = req.references ?? [];
  if (refs.length === 0) {
    const body: Record<string, string | number> = { ...fields, n: 1 };
    if (body.output_compression) body.output_compression = Number(body.output_compression);
    return {
      url: `${API_BASE}/generations`,
      init: {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    };
  }

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  refs.forEach((ref, i) => {
    const ext = ref.mime === "image/png" ? "png" : ref.mime === "image/webp" ? "webp" : "jpg";
    form.append("image[]", new Blob([new Uint8Array(ref.data)], { type: ref.mime }), `ref-${i + 1}.${ext}`);
  });
  return { url: `${API_BASE}/edits`, init: { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form } };
}

export function costOf(usage: ImageUsage): number {
  const textIn = usage.input_tokens_details?.text_tokens ?? 0;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  return textIn * RATES_PER_TOKEN.textIn + imageIn * RATES_PER_TOKEN.imageIn + out * RATES_PER_TOKEN.out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(req: OpenAIImageRequest, key: string, ms: number): Promise<{ image: Buffer; usage: ImageUsage }> {
  const { url, init } = buildRequest(req, key);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new RetryableError(`OpenAI images request timed out after ${Math.round(ms / 1000)}s`);
    throw new RetryableError(`OpenAI images request failed: ${describeError(err)}`, undefined, isNetworkError(err));
  }
  const text = await res.text();
  if (!res.ok) throw toError(res.status, text, res.headers.get("retry-after"));
  const json = JSON.parse(text) as { data?: { b64_json?: string }[]; usage?: ImageUsage };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new RetryableError(`OpenAI images returned no image data: ${text.slice(0, 200)}`);
  return { image: Buffer.from(b64, "base64"), usage: json.usage ?? {} };
}

/**
 * One image. Retries 429 / 5xx / timeouts (OPENAI_IMAGE_MAX_ATTEMPTS) and
 * connectivity failures (OPENAI_IMAGE_NETWORK_ATTEMPTS) with exponential
 * backoff (honours Retry-After) while the deadline allows. Throws
 * ProviderUnavailableError for auth/billing problems (retrying cannot fix them)
 * and ImageRequestError for rejected requests (moderation, parameters).
 */
export async function generateOpenAIImage(req: OpenAIImageRequest): Promise<OpenAIImageResult> {
  const key = openAIKey();
  if (!key) throw new ProviderUnavailableError(PROVIDER, "misconfigured", "OPENAI_API_KEY is not configured");
  parseSize(req.size);
  if ((req.references?.length ?? 0) > MAX_REFERENCES) throw new Error(`At most ${MAX_REFERENCES} reference images (got ${req.references?.length})`);

  const refs = req.references?.length ?? 0;
  const started = Date.now();
  let lastErr: unknown;

  await acquire();
  try {
    for (let n = 1; ; n++) {
      const left = req.deadline ? req.deadline - Date.now() : Infinity;
      if (left < 20_000) break;
      const t0 = Date.now();
      try {
        const { image, usage } = await attempt(req, key, Math.min(timeoutMs(), left));
        const costUsd = costOf(usage);
        const ms = Date.now() - started;
        console.log(
          `[OpenAI Image] ${req.label}: ${req.model} ${req.quality} ${req.size} refs=${refs} $${costUsd.toFixed(3)} ${((Date.now() - t0) / 1000).toFixed(0)}s` +
            (n > 1 ? ` (attempt ${n})` : ""),
        );
        const format = req.outputFormat ?? "jpeg";
        return { image, mime: `image/${format}`, size: req.size, model: req.model, quality: req.quality, usage, costUsd, ms };
      } catch (err) {
        lastErr = err;
        if (!(err instanceof RetryableError)) throw err;
        const limit = err.network ? Math.max(maxNetworkAttempts(), maxAttempts()) : maxAttempts();
        if (n >= limit) break;
        const wait = Math.min(err.retryAfterMs ?? 2_000 * 2 ** (n - 1), err.retryAfterMs ? 30_000 : MAX_BACKOFF_MS) + Math.random() * 1_000;
        // Sleeping past the deadline only delays the inevitable failure.
        if (req.deadline && req.deadline - Date.now() - wait < 20_000) break;
        console.warn(`[OpenAI Image] ${req.label}: ${err.message} — retry ${n + 1}/${limit} in ${(wait / 1000).toFixed(1)}s`);
        await sleep(wait);
      }
    }
  } finally {
    release();
  }
  const msg = lastErr instanceof Error ? lastErr.message : "deadline reached before the request could start";
  throw new Error(`OpenAI image failed (${req.label}): ${msg}`);
}
