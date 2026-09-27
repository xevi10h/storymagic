// Low-level OpenAI transport shared by the story pipeline.
//
// - nativeFetch: Node https client (bypasses Next.js undici socket drops on
//   long LLM generations).
// - callOpenAIStructured: Chat Completions with Structured Outputs
//   (response_format json_schema, strict) generated from a zod schema, parsed
//   and re-validated with the same schema. Reports usage, latency and cost.

import * as https from "node:https";
import * as http from "node:http";
import { z } from "zod";

// ── Native HTTPS fetch ───────────────────────────────────────────────────────

export function nativeFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string; timeoutMs?: number },
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const timeoutMs = options.timeoutMs ?? 180_000;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: {
          ...options.headers,
          Connection: "keep-alive",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          const status = res.statusCode ?? 500;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: () => Promise.resolve(body),
            json: () => {
              try {
                return Promise.resolve(JSON.parse(body));
              } catch {
                return Promise.reject(new Error(`Non-JSON response from LLM API: ${body.slice(0, 200)}`));
              }
            },
          });
        });
        res.on("error", reject);
      },
    );

    // Keep TCP alive so proxies don't drop idle sockets during long generations.
    req.on("socket", (socket) => {
      socket.setKeepAlive(true, 30_000);
    });
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.on("error", reject);
    req.write(options.body);
    req.end();
  });
}

/** Streaming POST: calls onChunk for every body chunk, resolves with the status when the body ends. */
export function nativeStream(
  url: string,
  options: { headers: Record<string, string>; body: string; timeoutMs?: number },
  onChunk: (chunk: string) => void,
): Promise<{ status: number; errorBody: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const timeoutMs = options.timeoutMs ?? 180_000;
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { ...options.headers, Connection: "keep-alive" },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 500;
        const errorChunks: Buffer[] = [];
        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => {
          if (status >= 200 && status < 300) onChunk(chunk);
          else errorChunks.push(Buffer.from(chunk));
        });
        res.on("end", () => resolve({ status, errorBody: Buffer.concat(errorChunks).toString("utf-8") }));
        res.on("error", reject);
      },
    );
    req.on("socket", (socket) => socket.setKeepAlive(true, 30_000));
    req.on("timeout", () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.write(options.body);
    req.end();
  });
}

/**
 * Best-effort parse of a JSON document that is still being streamed: cuts at
 * the last completed object/array and closes the open containers. Only fully
 * written objects survive, so every value returned is final.
 */
export function parsePartialJson(text: string): unknown {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let cut = -1;
  let cutStack: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      cut = i + 1;
      cutStack = stack.slice();
    }
  }
  if (cut < 0) return undefined;
  const closing = cutStack.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
  try {
    return JSON.parse(text.slice(0, cut) + closing);
  } catch {
    return undefined;
  }
}

// ── Model capabilities ───────────────────────────────────────────────────────

/** Reasoning models (gpt-5.5+, gpt-5.6-*, gpt-6-*, o-series) only accept the default temperature. */
export function modelAcceptsTemperature(model: string): boolean {
  return /^(gpt-3\.5|gpt-4|gpt-5\.4)/.test(model);
}

/** Models that take `reasoning_effort` on Chat Completions. */
export function modelAcceptsReasoningEffort(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

// USD per 1M tokens (developers.openai.com/api/docs/pricing, checked 2026-09-27).
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6-astra": { input: 10, cached: 1, output: 50 },
  "gpt-6-sol": { input: 2, cached: 0.2, output: 10 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-5.6-sol": { input: 4, cached: 0.4, output: 20 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, output: 1.2 },
  "gpt-5.5": { input: 5, cached: 0.5, output: 30 },
  "gpt-5.4": { input: 2.5, cached: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-4.1": { input: 2, cached: 0.5, output: 8 },
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.6 },
};

export interface LLMUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export function estimateCostUsd(model: string, usage: LLMUsage): number | null {
  const key = Object.keys(PRICES)
    .sort((a, b) => b.length - a.length)
    .find((k) => model === k || model.startsWith(`${k}-`));
  if (!key) return null;
  const p = PRICES[key];
  const uncached = usage.inputTokens - usage.cachedInputTokens;
  return (uncached * p.input + usage.cachedInputTokens * p.cached + usage.outputTokens * p.output) / 1_000_000;
}

// ── Structured call ──────────────────────────────────────────────────────────

export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key && !key.includes("your_") && !key.includes("_here")) return key;
  throw new Error("OPENAI_API_KEY not configured in .env.local");
}

export interface StructuredCallOptions<T> {
  model: string;
  system: string;
  user: string;
  /** Name reported to the API for the schema (a-z, 0-9, _ -). */
  schemaName: string;
  schema: z.ZodType<T>;
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
  maxCompletionTokens?: number;
  /** Log label */
  label?: string;
  /**
   * Stream the response and call this with the partially parsed object
   * (completed sub-objects only) as it grows.
   */
  onPartial?: (partial: unknown) => void;
}

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  elapsedMs: number;
  usage: LLMUsage;
  costUsd: number | null;
}

/** JSON Schema for OpenAI strict Structured Outputs from a zod schema. */
export function toOpenAIJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function isTransient(err: unknown): boolean {
  return (
    err instanceof Error &&
    /socket|timed out|ECONNRESET|EPIPE|ETIMEDOUT|EAI_AGAIN/.test(err.message)
  );
}

export async function callOpenAIStructured<T>(opts: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
  const apiKey = getOpenAIKey();
  const label = opts.label ?? opts.schemaName;
  const payload: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, strict: true, schema: toOpenAIJsonSchema(opts.schema) },
    },
  };
  if (opts.reasoningEffort && modelAcceptsReasoningEffort(opts.model)) {
    payload.reasoning_effort = opts.reasoningEffort;
  }
  if (opts.maxCompletionTokens) payload.max_completion_tokens = opts.maxCompletionTokens;

  if (opts.onPartial) {
    payload.stream = true;
    payload.stream_options = { include_usage: true };
  }
  const body = JSON.stringify(payload);
  const start = Date.now();
  const MAX_ATTEMPTS = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { content, finishReason, refusal, usageRaw, modelName } = opts.onPartial
        ? await streamCompletion(apiKey, body, opts.timeoutMs ?? 240_000, opts.onPartial, label, opts.model)
        : await plainCompletion(apiKey, body, opts.timeoutMs ?? 240_000, label, opts.model);
      if (refusal) throw new Error(`${opts.model} refused [${label}]: ${refusal}`);
      if (finishReason === "length") throw new Error(`${opts.model} output truncated (max tokens) [${label}]`);
      if (!content) throw new Error(`Empty response from ${opts.model} [${label}]`);

      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch (e) {
        throw new Error(`Invalid JSON from ${opts.model} [${label}]: ${e instanceof Error ? e.message : e}`);
      }
      const parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`Schema validation failed [${label}]: ${parsed.error.message.slice(0, 800)}`);
      }

      const usage: LLMUsage = {
        inputTokens: usageRaw?.prompt_tokens ?? 0,
        cachedInputTokens: usageRaw?.prompt_tokens_details?.cached_tokens ?? 0,
        outputTokens: usageRaw?.completion_tokens ?? 0,
        reasoningTokens: usageRaw?.completion_tokens_details?.reasoning_tokens ?? 0,
      };
      const elapsedMs = Date.now() - start;
      const costUsd = estimateCostUsd(opts.model, usage);
      console.log(
        `[LLM] ${label} ${opts.model} ${(elapsedMs / 1000).toFixed(1)}s in=${usage.inputTokens} out=${usage.outputTokens} (reasoning ${usage.reasoningTokens})${costUsd !== null ? ` ~$${costUsd.toFixed(4)}` : ""}`,
      );
      return { data: parsed.data, model: modelName ?? opts.model, elapsedMs, usage, costUsd };
    } catch (err) {
      lastError = err;
      if ((isTransient(err) || err instanceof RetryableHttpError) && attempt < MAX_ATTEMPTS) {
        console.warn(`[LLM] ${label} attempt ${attempt} failed: ${err instanceof Error ? err.message : err}. Retrying...`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`All attempts failed [${label}]`);
}

// ── Completion transports ────────────────────────────────────────────────────

interface UsageRaw {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

interface CompletionOutcome {
  content: string;
  finishReason?: string;
  refusal?: string | null;
  usageRaw?: UsageRaw;
  modelName?: string;
}

class RetryableHttpError extends Error {}

function httpError(status: number, text: string, model: string, label: string): Error {
  const msg = `${model} error (${status}) [${label}]: ${text.slice(0, 500)}`;
  return status === 429 || status >= 500 ? new RetryableHttpError(msg) : new Error(msg);
}

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

async function plainCompletion(apiKey: string, body: string, timeoutMs: number, label: string, model: string): Promise<CompletionOutcome> {
  const res = await nativeFetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body,
    timeoutMs,
  });
  if (!res.ok) throw httpError(res.status, await res.text(), model, label);
  const data = (await res.json()) as {
    model?: string;
    choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
    usage?: UsageRaw;
  };
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? "",
    finishReason: choice?.finish_reason,
    refusal: choice?.message?.refusal,
    usageRaw: data.usage,
    modelName: data.model,
  };
}

async function streamCompletion(
  apiKey: string,
  body: string,
  timeoutMs: number,
  onPartial: (partial: unknown) => void,
  label: string,
  model: string,
): Promise<CompletionOutcome> {
  let pending = "";
  let content = "";
  let refusal = "";
  let finishReason: string | undefined;
  let usageRaw: UsageRaw | undefined;
  let modelName: string | undefined;
  let lastParsedLength = 0;
  const PARSE_EVERY = 300; // chars — keeps partial parsing O(n) amortised per book

  const { status, errorBody } = await nativeStream(
    CHAT_URL,
    { headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body, timeoutMs },
    (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            model?: string;
            usage?: UsageRaw | null;
            choices?: { delta?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[];
          };
          if (evt.model) modelName = evt.model;
          if (evt.usage) usageRaw = evt.usage;
          const choice = evt.choices?.[0];
          if (choice?.delta?.content) content += choice.delta.content;
          if (choice?.delta?.refusal) refusal += choice.delta.refusal;
          if (choice?.finish_reason) finishReason = choice.finish_reason;
        } catch {
          // ignore keep-alive / malformed lines
        }
      }
      if (content.length - lastParsedLength >= PARSE_EVERY) {
        lastParsedLength = content.length;
        const partial = parsePartialJson(content);
        if (partial !== undefined) {
          try {
            onPartial(partial);
          } catch (err) {
            console.warn(`[LLM] ${label} onPartial threw (ignored):`, err instanceof Error ? err.message : err);
          }
        }
      }
    },
  );
  if (status < 200 || status >= 300) throw httpError(status, errorBody, model, label);
  return { content, finishReason, refusal: refusal || null, usageRaw, modelName };
}
