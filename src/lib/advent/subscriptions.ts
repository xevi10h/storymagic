// Server-only: Advent daily-email subscriptions (table advent_subscriptions, migration
// 20261027120000). Service-role client; callers validate the input first.
//
// Double opt-in (owner 2026-10-27): a sign-up whose email is the signed-in account's own
// confirmed address is active at once; every other one is pending until the link in the
// confirmation email is clicked (confirmByToken). A pending row gets nothing else.

import { randomBytes } from "node:crypto";
import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { isMissingSchemaError } from "@/lib/reviews/schema";
import { getSiteUrl, sendEmail } from "@/lib/email/send";
import { ADVENT_CONFIRM_PATH, ADVENT_CONSENT_VERSION, ADVENT_YEAR, CONFIRM_RESEND_MINUTES, mayResendConfirmation } from "./calendar";
import { buildAdventConfirmEmail } from "./confirm-email";
import { adventNameIn } from "./personalize";
import type { AdventGender, AdventLocale } from "./render";

/** Random URL-safe token (32 chars) for the unsubscribe and confirmation links. */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface SubscribeInput {
  email: string;
  childName: string;
  gender: AdventGender;
  locale: AdventLocale;
  /** The email is the signed-in account's own confirmed address: single opt-in. */
  verifiedSelf: boolean;
  /** Set only with verifiedSelf. */
  userId: string | null;
  characterId: string | null;
}

/**
 * pending: a confirmation is (or was already) on its way and nothing else will be sent
 * until it is clicked. already: the address was confirmed and stays as it was (a guest
 * cannot change someone else's subscription).
 */
export type SubscribeResult =
  | { ok: true; state: "active" | "pending" | "already" }
  | { ok: false; reason: "migration_pending" | "failed" };

export async function subscribe(db: FulfilmentClient, input: SubscribeInput): Promise<SubscribeResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const child = {
    child_name: input.childName,
    gender: input.gender,
    locale: input.locale,
    user_id: input.userId,
    character_id: input.characterId,
    consent_at: nowIso,
    consent_version: ADVENT_CONSENT_VERSION,
    consent_source: "advent_page",
    unsubscribed_at: null,
    updated_at: nowIso,
  };

  const confirmToken = newToken();
  const inserted = await db.from("advent_subscriptions").insert({
    season: ADVENT_YEAR,
    email: input.email,
    unsubscribe_token: newToken(),
    confirm_token: confirmToken,
    confirmed_at: input.verifiedSelf ? nowIso : null,
    confirm_sent_at: input.verifiedSelf ? null : nowIso,
    ...child,
  });
  if (!inserted.error) {
    if (input.verifiedSelf) return { ok: true, state: "active" };
    await sendConfirmation(db, { email: input.email, token: confirmToken, locale: input.locale, childName: input.childName, gender: input.gender, previousSentAt: null });
    return { ok: true, state: "pending" };
  }
  if (isMissingSchemaError(inserted.error)) return { ok: false, reason: "migration_pending" };
  if (inserted.error.code !== "23505") {
    console.error("[advent] subscribe insert failed:", inserted.error.code ?? inserted.error.message);
    return { ok: false, reason: "failed" };
  }

  const { data: row, error: readErr } = await db
    .from("advent_subscriptions")
    .select("id, confirmed_at, unsubscribed_at, confirm_token, confirm_sent_at")
    .eq("season", ADVENT_YEAR)
    .eq("email", input.email)
    .maybeSingle();
  if (readErr || !row) {
    console.error("[advent] subscribe read failed:", readErr?.code ?? "missing row");
    return { ok: false, reason: "failed" };
  }

  if (input.verifiedSelf) {
    const { error } = await db
      .from("advent_subscriptions")
      .update({ ...child, confirmed_at: row.confirmed_at ?? nowIso })
      .eq("id", row.id);
    return error ? { ok: false, reason: "failed" } : { ok: true, state: "active" };
  }

  // Confirmed and active: a guest sign-up for this address changes nothing.
  if (row.confirmed_at && !row.unsubscribed_at) return { ok: true, state: "already" };

  // Pending (or unsubscribed): new details, (re)confirmation required.
  const { error: updErr } = await db.from("advent_subscriptions").update({ ...child, confirmed_at: null }).eq("id", row.id);
  if (updErr) return { ok: false, reason: "failed" };
  if (!mayResendConfirmation(row.confirm_sent_at, now)) return { ok: true, state: "pending" };

  // At most one confirmation per CONFIRM_RESEND_MINUTES, also across concurrent requests.
  const cutoff = new Date(now.getTime() - CONFIRM_RESEND_MINUTES * 60_000).toISOString();
  const { data: claimed } = await db
    .from("advent_subscriptions")
    .update({ confirm_sent_at: nowIso })
    .eq("id", row.id)
    .or(`confirm_sent_at.is.null,confirm_sent_at.lte."${cutoff}"`)
    .select("id");
  if (claimed && claimed.length > 0) {
    await sendConfirmation(db, { email: input.email, token: row.confirm_token, locale: input.locale, childName: input.childName, gender: input.gender, previousSentAt: row.confirm_sent_at });
  }
  return { ok: true, state: "pending" };
}

/** Plain, non-commercial confirmation email. A failed send frees the throttle for a retry. */
async function sendConfirmation(
  db: FulfilmentClient,
  p: { email: string; token: string; locale: AdventLocale; childName: string; gender: AdventGender; previousSentAt: string | null },
): Promise<void> {
  const built = buildAdventConfirmEmail({
    locale: p.locale,
    childName: adventNameIn(p.locale, p.childName, p.gender),
    confirmUrl: `${getSiteUrl()}/${p.locale}${ADVENT_CONFIRM_PATH}?t=${encodeURIComponent(p.token)}`,
  });
  const ok = await sendEmail({ to: p.email, subject: built.subject, html: built.html, text: built.text });
  if (!ok) {
    console.error("[advent] confirmation email failed");
    await db.from("advent_subscriptions").update({ confirm_sent_at: p.previousSentAt }).eq("confirm_token", p.token);
  }
}

/** The confirmation link's button. Idempotent. */
export async function confirmByToken(db: FulfilmentClient, token: string): Promise<"ok" | "invalid" | "failed"> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return "invalid";
  const { data, error } = await db
    .from("advent_subscriptions")
    .select("id, confirmed_at, unsubscribed_at")
    .eq("confirm_token", token)
    .maybeSingle();
  if (error) return isMissingSchemaError(error) ? "invalid" : "failed";
  if (!data || data.unsubscribed_at) return "invalid";
  if (data.confirmed_at) return "ok";
  const now = new Date().toISOString();
  const { error: upd } = await db
    .from("advent_subscriptions")
    .update({ confirmed_at: now, updated_at: now })
    .eq("id", data.id)
    .is("confirmed_at", null);
  return upd ? "failed" : "ok";
}

/** One-click / page unsubscribe by the row's token. Idempotent; "invalid" = unknown token. */
export async function unsubscribeByToken(db: FulfilmentClient, token: string): Promise<"ok" | "invalid" | "failed"> {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return "invalid";
  const { data, error } = await db
    .from("advent_subscriptions")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error) return isMissingSchemaError(error) ? "invalid" : "failed";
  if (!data) return "invalid";
  if (data.unsubscribed_at) return "ok";
  const now = new Date().toISOString();
  const { error: upd } = await db.from("advent_subscriptions").update({ unsubscribed_at: now, updated_at: now }).eq("id", data.id);
  return upd ? "failed" : "ok";
}
