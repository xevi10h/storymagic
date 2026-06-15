/**
 * FLUX.2 API wrapper (Black Forest Labs)
 *
 * Successor to flux-kontext.ts. Key differences vs FLUX.1 Kontext:
 *   - Up to 8 reference images per generation (input_image..input_image_8)
 *     → enables a full "visual bible" (protagonist + secondaries + location + props).
 *   - Uses width/height (NOT aspect_ratio).
 *   - Models: flux-2-flex (default) and flux-2-pro.
 *     MEASURED cost (BFL credits, 1 credit = $0.01), flux-2-flex, 2026-06-15:
 *       1408×960 (1.35 MP) = 10 cr = $0.10  ·  ≤0.72 MP = 5 cr = $0.05 (5-cr floor).
 *       Bills per megapixel, NOT per step (lowering `steps` does not reduce cost).
 *     (The old "$0.01/img" was stale by ~10×.)
 *
 * The reinforced-watercolor look is driven by the prompt (see scene-screenplay.ts),
 * not the model. flex was chosen as default: with the watercolor prompt it matches
 * pro's brand look, holds identity comparably, and costs 3× less.
 *
 * Async polling + retry/backoff mirror flux-kontext.ts.
 */

import type { FluxResult } from "./flux-kontext";

// ── Config ──────────────────────────────────────────────────────────
const BFL_API_BASE = "https://api.bfl.ai/v1";

/** "flux-2-flex" (default) or "flux-2-pro". Override with FLUX2_MODEL. */
export function flux2Model(): string {
  return process.env.FLUX2_MODEL || "flux-2-flex";
}

const MAX_RETRIES = 2;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ITERATIONS = 90; // 90 × 2s = 180s ceiling (pro on large images can be slow)
const MAX_INPUT_IMAGES = 8;

// ── Types ───────────────────────────────────────────────────────────
export interface Flux2Options {
  /** Base64 reference images, in priority order (max 8). First = highest weight. */
  inputImages?: string[];
  /** Aspect ratio string, e.g. "1:1", "4:3", "16:9", "3:4". Mapped to width/height. */
  aspectRatio?: string;
  /** Explicit width/height (overrides aspectRatio). Must be multiples of 32. */
  width?: number;
  height?: number;
  outputFormat?: string;
  /** 0-5, higher = more permissive moderation. */
  safetyTolerance?: number;
  /** Override the BFL model for this single call. */
  model?: string;
  /** Per-call provider override ("bfl" | "fal"). Defaults to FLUX2_PROVIDER env. */
  provider?: string;
  /** Per-call fal model override (e.g. "fal-ai/flux-2" for dev). Defaults to FAL_FLUX2_MODEL. */
  falModel?: string;
}

// ── Aspect → dimensions (multiples of 32, ≤ ~1.5MP for speed/cost) ──────
const ASPECT_TO_DIMS: Record<string, [number, number]> = {
  "1:1": [1024, 1024],
  "4:3": [1408, 1024],
  "3:4": [1024, 1408],
  "16:9": [1440, 1024],
  "9:16": [1024, 1440],
  "3:2": [1408, 960],
  "2:3": [960, 1408],
};

function dimsFor(opts: Flux2Options): [number, number] {
  if (opts.width && opts.height) return [opts.width, opts.height];
  return ASPECT_TO_DIMS[opts.aspectRatio || "1:1"] || ASPECT_TO_DIMS["1:1"];
}

// ── Mock mode ───────────────────────────────────────────────────────
const MOCK_RESULT: FluxResult = { url: "/placeholder-illustration.webp", base64: "" };

function isMockMode(): boolean {
  if (process.env.MOCK_MODE === "true") return true;
  // No real key for any provider → fall back to mock.
  const hasFal = !!(process.env.FAL_KEY || process.env.FAL_API_KEY);
  const hasBfl = !!process.env.BFL_API_KEY;
  return !hasFal && !hasBfl;
}

// ── Retry helpers (shared semantics with flux-kontext.ts) ───────────
function isNonRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  if (msg.includes("insufficient") || msg.includes("credits")) return true;
  if (msg.includes("BFL API 400") || msg.includes("BFL API 401") || msg.includes("BFL API 403")) return true;
  return false;
}
const retryDelay = (attempt: number) => 2000 * Math.pow(2, attempt);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Core API call (submit + poll) ───────────────────────────────────
interface BflSubmitResponse {
  id: string;
  polling_url?: string;
  cost?: number;
}
interface BflPollResponse {
  status: string;
  result?: { sample: string };
  cost?: number;
}

async function callFlux2Api(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<FluxResult> {
  // Endpoint name fallback: some regions expose "<model>-preview".
  const endpoints = [`${BFL_API_BASE}/${model}`, `${BFL_API_BASE}/${model}-preview`];
  let submitData: BflSubmitResponse | null = null;
  let lastErr = "";

  for (const ep of endpoints) {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-key": apiKey },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      submitData = (await res.json()) as BflSubmitResponse;
      break;
    }
    const errText = await res.text();
    if (errText.includes("insufficient") || errText.includes("credits")) {
      throw new Error(`NO CREDITS — top up at dashboard.bfl.ai. Error: ${errText}`);
    }
    lastErr = `BFL API ${res.status}: ${errText}`;
    if (res.status !== 404) throw new Error(lastErr); // only fall through on 404
  }
  if (!submitData) throw new Error(lastErr || "FLUX.2 submit failed");

  const pollUrl = submitData.polling_url || `${BFL_API_BASE}/get_result?id=${submitData.id}`;

  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(pollUrl, { headers: { "x-key": apiKey } });
    const pollData = (await pollRes.json()) as BflPollResponse;

    if (pollData.status === "Ready" && pollData.result?.sample) {
      const imgRes = await fetch(pollData.result.sample);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      return { url: pollData.result.sample, base64: imgBuf.toString("base64") };
    }
    if (pollData.status === "Error" || pollData.status === "Request Moderated" || pollData.status === "Failed") {
      throw new Error(`FLUX.2 generation failed: ${JSON.stringify(pollData)}`);
    }
    // "Pending"/"Processing" → keep polling
  }
  throw new Error(`Timeout after ${(MAX_POLL_ITERATIONS * POLL_INTERVAL_MS) / 1000}s waiting for FLUX.2 ${model}`);
}

async function callFlux2WithRetry(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<FluxResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callFlux2Api(model, body, apiKey);
    } catch (err) {
      if (attempt === MAX_RETRIES || isNonRetryableError(err)) throw err;
      const delay = retryDelay(attempt);
      console.warn(`[FLUX.2 ${model}] Attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`, err instanceof Error ? err.message : err);
      await sleep(delay);
    }
  }
  throw new Error("Unreachable");
}

// ── fal provider (FLUX.2 [pro] / [dev], same FLUX.2 family, ~2.4× faster & cheaper) ──
// fal hosts FLUX.2 and bills per megapixel. Reference images are passed as data
// URIs in `image_urls`. Chosen via FLUX2_PROVIDER=fal (model via FAL_FLUX2_MODEL).
function flux2Provider(): string {
  return process.env.FLUX2_PROVIDER || "bfl";
}
const FAL_FLUX_MODEL = process.env.FAL_FLUX2_MODEL || "fal-ai/flux-2-pro";

async function callFalFlux2(
  prompt: string,
  width: number,
  height: number,
  refsB64: string[],
  falModel: string,
): Promise<FluxResult> {
  const key = (process.env.FAL_KEY || process.env.FAL_API_KEY || "").trim();
  if (!key) throw new Error("FLUX2_PROVIDER=fal but FAL_KEY is missing");
  const imageUrls = refsB64.map((b) =>
    b.startsWith("data:") || b.startsWith("http") ? b : `data:image/png;base64,${b}`,
  );
  // flux-2-flex needs the /edit endpoint to accept reference images; pro/dev accept them on the base endpoint.
  const endpoint = imageUrls.length && falModel === "fal-ai/flux-2-flex" ? "fal-ai/flux-2-flex/edit" : falModel;
  const body: Record<string, unknown> = {
    prompt,
    image_size: { width, height },
    num_images: 1,
    output_format: "png",
    enable_safety_checker: false,
  };
  if (imageUrls.length) body.image_urls = imageUrls;

  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 401 || res.status === 403)
      throw new Error(`NO CREDITS — check FAL_KEY / fal.ai balance. ${t.slice(0, 160)}`);
    throw new Error(`fal ${endpoint} ${res.status}: ${t.slice(0, 200)}`);
  }
  const d = (await res.json()) as { images?: Array<{ url?: string }> };
  const url = d?.images?.[0]?.url;
  if (!url) throw new Error(`fal returned no image: ${JSON.stringify(d).slice(0, 160)}`);
  const imgBuf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return { url, base64: imgBuf.toString("base64") };
}

async function callFalWithRetry(
  prompt: string,
  width: number,
  height: number,
  falModel: string,
  refs: string[],
): Promise<FluxResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callFalFlux2(prompt, width, height, refs, falModel);
    } catch (err) {
      if (attempt === MAX_RETRIES || isNonRetryableError(err)) throw err;
      const delay = retryDelay(attempt);
      console.warn(`[FLUX.2 fal] Attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`, err instanceof Error ? err.message : err);
      await sleep(delay);
    }
  }
  throw new Error("Unreachable");
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generate an image with FLUX.2, conditioned on up to 8 reference images.
 *
 * @param prompt - Concrete visual description (must already include the style suffix).
 * @param opts   - Reference images (base64, priority order), aspect ratio, etc.
 */
export async function generateFlux2(prompt: string, opts: Flux2Options = {}): Promise<FluxResult> {
  if (isMockMode()) {
    console.log("[FLUX.2] Mock mode — returning placeholder");
    await sleep(300);
    return { ...MOCK_RESULT };
  }

  const [width, height] = dimsFor(opts);
  const refs = (opts.inputImages || []).filter(Boolean).slice(0, MAX_INPUT_IMAGES);
  const start = Date.now();

  // fal provider (FLUX.2 pro/dev) — faster + cheaper, same FLUX.2 family.
  const provider = opts.provider || flux2Provider();
  if (provider === "fal" && (process.env.FAL_KEY || process.env.FAL_API_KEY)) {
    const falModel = opts.falModel || FAL_FLUX_MODEL;
    const result = await callFalWithRetry(prompt, width, height, falModel, refs);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[FLUX.2 ${falModel}] Generated in ${elapsed}s (${refs.length} refs, ${width}x${height})`);
    return result;
  }

  // BFL provider (default)
  const apiKey = process.env.BFL_API_KEY!;
  const model = opts.model || flux2Model();
  const body: Record<string, unknown> = {
    prompt,
    width,
    height,
    output_format: opts.outputFormat || "png",
    safety_tolerance: Math.min(opts.safetyTolerance ?? 4, 5),
  };
  // Attach reference images: input_image, input_image_2 .. input_image_8
  refs.forEach((b64, idx) => {
    body[idx === 0 ? "input_image" : `input_image_${idx + 1}`] = b64;
  });

  const result = await callFlux2WithRetry(model, body, apiKey);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[FLUX.2 ${model}] Generated in ${elapsed}s (${refs.length} refs, ${width}x${height})`);
  return result;
}
