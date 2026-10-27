import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { confirmByToken } from "@/lib/advent/subscriptions";

/**
 * POST /api/advent/confirm — double opt-in: the "Confirmar" button of
 * /[locale]/advent/confirm (JSON { t }). POST only: opening the emailed link never confirms
 * by itself (mail scanners open links). Idempotent; sets confirmed_at (the consent proof).
 * 200 { ok } · 400 invalid_token · 500 unavailable
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let token: string | null = null;
  try {
    const body = (await request.json()) as { t?: unknown };
    if (typeof body.t === "string") token = body.t;
  } catch {
    // unreadable body
  }
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE });
  let result: "ok" | "invalid" | "failed";
  try {
    result = await confirmByToken(createFulfilmentClient(), token);
  } catch (err) {
    console.error("[advent/confirm] failed:", err instanceof Error ? err.message : "unknown");
    result = "failed";
  }
  if (result === "invalid") return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE });
  if (result === "failed") return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  console.log("[advent/confirm] subscription confirmed");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
