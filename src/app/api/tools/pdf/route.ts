import { NextResponse, type NextRequest } from "next/server";
import { checkMemoryRateLimit, checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { toolInputSchema } from "@/lib/tools/schema";
import { renderToolPdf } from "@/lib/tools/pdf/render";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 4096;

/**
 * POST /api/tools/pdf — the free Reyes printables (/tools/*), rendered in memory.
 * Body: ToolInput (src/lib/tools/schema.ts). Nothing is stored; names never logged.
 *
 * 200 application/pdf (attachment)
 * 400 { error: "invalid_input" }
 * 413 { error: "too_large" }
 * 429 { error: "rate_limited" }
 * 500 { error: "render_failed" }
 */
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // 1. Per-instance memory window (cheap, first), 2. durable per hashed IP.
  const memory = checkMemoryRateLimit(`tool_pdf:${clientIp}`, { maxRequests: 20, windowSeconds: 600 });
  if (!memory.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(memory.retryAfterSeconds ?? 600) } },
    );
  }

  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const parsed = toolInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const durable = await checkRateLimit(rateLimitSubject(`tools:${clientIp}`), "tool_pdf");
  if (!durable.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(durable.retryAfterSeconds ?? 3600) } },
    );
  }

  try {
    const { pdf, filename } = await renderToolPdf(parsed.data);
    const bytes = new Uint8Array(pdf);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    // Error class only: messages could quote the input.
    console.error(`[tools/pdf] render failed (${parsed.data.tool}):`, err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
