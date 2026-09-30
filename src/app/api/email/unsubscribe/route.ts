import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { suppressEmail } from "@/lib/marketing/suppression";
import { unsubscribeKey, verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe-token";

/**
 * Unsubscribe from commercial email (LSSI art. 22.1). POST only: a GET never
 * unsubscribes, so link scanners that prefetch URLs can't do it.
 *
 * Two callers, one behaviour (idempotent: adds the signed address to email_suppressions):
 *  - RFC 8058 one-click: the mailbox provider POSTs `List-Unsubscribe=One-Click`
 *    (multipart/form-data or x-www-form-urlencoded) to the List-Unsubscribe URI, which
 *    carries the token as `?t=`. No cookies, no redirect: plain 200.
 *  - The /[locale]/unsubscribe page: JSON `{ "t": "…" }`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function tokenFrom(request: Request): Promise<{ token: string | null; oneClick: boolean }> {
  const query = new URL(request.url).searchParams.get("t");
  const type = request.headers.get("content-type") ?? "";
  let bodyToken: string | null = null;
  let oneClick = false;
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as { t?: unknown };
      if (typeof body.t === "string") bodyToken = body.t;
    } else if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      oneClick = form.get("List-Unsubscribe") === "One-Click";
      const t = form.get("t");
      if (typeof t === "string") bodyToken = t;
    }
  } catch {
    // Unreadable body: the query token (one-click) still works.
  }
  return { token: query || bodyToken, oneClick };
}

export async function POST(request: Request) {
  const { token, oneClick } = await tokenFrom(request);
  let email: string | null = null;
  try {
    email = verifyUnsubscribeToken(token, unsubscribeKey());
  } catch (err) {
    console.error("[unsubscribe] Key unavailable:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  }
  if (!email) return NextResponse.json({ error: "invalid_token" }, { status: 400, headers: NO_STORE });

  try {
    await suppressEmail(createFulfilmentClient(), email, "unsubscribed", oneClick ? "one_click" : "unsubscribe_page");
  } catch (err) {
    console.error("[unsubscribe] Could not record the unsubscribe:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "unavailable" }, { status: 500, headers: NO_STORE });
  }
  console.log(`[unsubscribe] Address suppressed (${oneClick ? "one-click" : "page"})`);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
