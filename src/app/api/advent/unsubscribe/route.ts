import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { unsubscribeByToken } from "@/lib/advent/subscriptions";

/**
 * Stop the Advent daily email (link + List-Unsubscribe in every one). POST only: a GET
 * never unsubscribes, so link scanners that prefetch URLs can't do it.
 *  - RFC 8058 one-click: the mailbox provider POSTs `List-Unsubscribe=One-Click` to the
 *    List-Unsubscribe URI, which carries the token as `?t=`. Plain 200, no redirect.
 *  - The /[locale]/advent/unsubscribe page: JSON `{ "t": "…" }`.
 * Idempotent (unsubscribed_at set once). Only this calendar stops; other email is untouched.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function tokenFrom(request: Request): Promise<string | null> {
  const query = new URL(request.url).searchParams.get("t");
  if (query) return query;
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as { t?: unknown };
      return typeof body.t === "string" ? body.t : null;
    }
    if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
      const t = (await request.formData()).get("t");
      return typeof t === "string" ? t : null;
    }
  } catch {
    // unreadable body
  }
  return null;
}

export async function POST(request: Request) {
  const token = await tokenFrom(request);
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE });
  let result: "ok" | "invalid" | "failed";
  try {
    result = await unsubscribeByToken(createFulfilmentClient(), token);
  } catch (err) {
    console.error("[advent/unsubscribe] failed:", err instanceof Error ? err.message : "unknown");
    result = "failed";
  }
  if (result === "invalid") return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE });
  if (result === "failed") return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  console.log("[advent/unsubscribe] subscription stopped");
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
