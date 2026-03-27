/**
 * FLUX Kontext API wrapper
 *
 * Provides production-ready access to FLUX Kontext Pro and Max endpoints
 * for character-consistent illustration generation.
 *
 * Supports:
 *   - Kontext Pro: single input image reference
 *   - Kontext Max: up to 4 input image references (multi-character composites)
 *   - Async polling with configurable timeout
 *   - Retry with exponential backoff (skips billing/client errors)
 *   - Mock mode for local development without API credits
 */

// ── Types ───────────────────────────────────────────────────────────

export interface FluxResult {
  url: string;
  base64: string;
}

export interface FluxProOptions {
  /** Base64-encoded input image for reference-based generation */
  inputImage?: string;
  /** Aspect ratio string, e.g. "1:1", "16:9", "4:3" */
  aspectRatio?: string;
  /** Output format: "png" | "jpeg" | "webp" */
  outputFormat?: string;
  /** Safety tolerance level (1-6, higher = more permissive) */
  safetyTolerance?: number;
}

export interface FluxMaxOptions extends FluxProOptions {
  /** Second reference image (base64) for multi-character composites */
  inputImage2?: string;
  /** Third reference image (base64) */
  inputImage3?: string;
  /** Fourth reference image (base64) */
  inputImage4?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const BFL_API_BASE = "https://api.bfl.ai/v1";

/** Max number of retries on transient errors */
const MAX_RETRIES = 2;

/** Polling interval in milliseconds */
const POLL_INTERVAL_MS = 2000;

/** Maximum number of poll iterations (60 polls x 2s = 120s total) */
const MAX_POLL_ITERATIONS = 60;

/**
 * Maps common Recraft pixel sizes to the closest FLUX aspect ratio.
 * Useful when migrating prompts from Recraft V3 to FLUX Kontext.
 */
export const RECRAFT_SIZE_TO_FLUX_RATIO: Record<string, string> = {
  "1024x1024": "1:1",
  "1365x1024": "4:3",
  "1024x1365": "3:4",
  "1536x1024": "3:2",
  "1024x1536": "2:3",
  "1820x1024": "16:9",
  "1024x1820": "9:16",
};

// ── Mock mode ───────────────────────────────────────────────────────

const MOCK_RESULT: FluxResult = {
  url: "/placeholder-illustration.webp",
  base64: "",
};

function isMockMode(): boolean {
  return (
    process.env.MOCK_MODE === "true" || !process.env.BFL_API_KEY
  );
}

async function mockGenerate(model: string): Promise<FluxResult> {
  console.log(`[${model}] Mock mode — returning placeholder`);
  await new Promise((r) => setTimeout(r, 500));
  return { ...MOCK_RESULT };
}

// ── Retry helpers ───────────────────────────────────────────────────

/**
 * Returns true if the error should NOT be retried.
 * Credit/billing errors and client errors (400, 401, 403) propagate immediately.
 */
function isNonRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  // Credit/billing errors
  if (msg.includes("insufficient") || msg.includes("credits")) return true;
  // Client errors embedded in our error messages
  if (msg.includes("BFL API 400") || msg.includes("BFL API 401") || msg.includes("BFL API 403")) {
    return true;
  }
  return false;
}

/** Exponential backoff: 2s, 4s */
function retryDelay(attempt: number): number {
  return 2000 * Math.pow(2, attempt);
}

// ── Core API call ───────────────────────────────────────────────────

interface BflSubmitResponse {
  id: string;
  polling_url?: string;
}

interface BflPollResponse {
  status: string;
  result?: { sample: string };
}

/**
 * Low-level FLUX API call with async polling.
 * Submits a generation request, then polls until the result is ready.
 */
async function callFluxApi(
  endpoint: "flux-kontext-pro" | "flux-kontext-max",
  body: Record<string, unknown>,
  apiKey: string,
): Promise<FluxResult> {
  // 1. Submit generation request
  const submitRes = await fetch(`${BFL_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    if (errText.includes("insufficient") || errText.includes("credits")) {
      throw new Error(
        `NO CREDITS — top up at dashboard.bfl.ai. Error: ${errText}`,
      );
    }
    throw new Error(`BFL API ${submitRes.status}: ${errText}`);
  }

  const submitData = (await submitRes.json()) as BflSubmitResponse;
  const pollUrl =
    submitData.polling_url ||
    `${BFL_API_BASE}/get_result?id=${submitData.id}`;

  // 2. Poll for result
  for (let i = 0; i < MAX_POLL_ITERATIONS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(pollUrl, {
      headers: { "x-key": apiKey },
    });
    const pollData = (await pollRes.json()) as BflPollResponse;

    if (pollData.status === "Ready" && pollData.result?.sample) {
      // Download the generated image
      const imgRes = await fetch(pollData.result.sample);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      return {
        url: pollData.result.sample,
        base64: imgBuf.toString("base64"),
      };
    }

    if (
      pollData.status === "Error" ||
      pollData.status === "Request Moderated"
    ) {
      throw new Error(`Generation failed: ${JSON.stringify(pollData)}`);
    }
    // Otherwise status is "Pending" / "Processing" — keep polling
  }

  throw new Error(
    `Timeout after ${(MAX_POLL_ITERATIONS * POLL_INTERVAL_MS) / 1000}s waiting for FLUX ${endpoint}`,
  );
}

/**
 * Wraps callFluxApi with retry logic.
 * Retries up to MAX_RETRIES times with exponential backoff.
 * Credit/billing errors and client errors propagate immediately.
 */
async function callFluxWithRetry(
  endpoint: "flux-kontext-pro" | "flux-kontext-max",
  body: Record<string, unknown>,
  apiKey: string,
  label: string,
): Promise<FluxResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callFluxApi(endpoint, body, apiKey);
    } catch (err) {
      // Last attempt — propagate error
      if (attempt === MAX_RETRIES) throw err;

      // Non-retryable errors propagate immediately
      if (isNonRetryableError(err)) throw err;

      const delay = retryDelay(attempt);
      console.warn(
        `[${label}] Attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`,
        err instanceof Error ? err.message : err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // TypeScript exhaustiveness — should never reach here
  throw new Error("Unreachable");
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generate an image using FLUX Kontext Pro (single reference image).
 *
 * @param prompt - Text prompt describing the desired image
 * @param opts - Optional configuration (input image, aspect ratio, etc.)
 * @returns FluxResult with the generated image URL and base64 data
 */
export async function generateFluxPro(
  prompt: string,
  opts: FluxProOptions = {},
): Promise<FluxResult> {
  if (isMockMode()) return mockGenerate("FLUX Pro");

  const apiKey = process.env.BFL_API_KEY!;
  const start = Date.now();

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: opts.aspectRatio || "1:1",
    output_format: opts.outputFormat || "png",
    safety_tolerance: opts.safetyTolerance ?? 6,
  };
  if (opts.inputImage) body.input_image = opts.inputImage;

  const result = await callFluxWithRetry(
    "flux-kontext-pro",
    body,
    apiKey,
    "FLUX Pro",
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[FLUX Pro] Scene generated in ${elapsed}s`);

  return result;
}

/**
 * Generate an image using FLUX Kontext Max (up to 4 reference images).
 * Ideal for multi-character composite scenes.
 *
 * @param prompt - Text prompt describing the desired image
 * @param opts - Optional configuration (up to 4 input images, aspect ratio, etc.)
 * @returns FluxResult with the generated image URL and base64 data
 */
export async function generateFluxMax(
  prompt: string,
  opts: FluxMaxOptions = {},
): Promise<FluxResult> {
  if (isMockMode()) return mockGenerate("FLUX Max");

  const apiKey = process.env.BFL_API_KEY!;
  const start = Date.now();

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: opts.aspectRatio || "1:1",
    output_format: opts.outputFormat || "png",
    safety_tolerance: opts.safetyTolerance ?? 6,
  };
  if (opts.inputImage) body.input_image = opts.inputImage;
  if (opts.inputImage2) body.input_image_2 = opts.inputImage2;
  if (opts.inputImage3) body.input_image_3 = opts.inputImage3;
  if (opts.inputImage4) body.input_image_4 = opts.inputImage4;

  const result = await callFluxWithRetry(
    "flux-kontext-max",
    body,
    apiKey,
    "FLUX Max",
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[FLUX Max] Scene generated in ${elapsed}s`);

  return result;
}
