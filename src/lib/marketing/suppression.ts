// Commercial-email permission (server-only, service-role client).
//
// Rule (LSSI 21.2, owner decision 2026-09-30): an email may carry commercial content
// (an offer block, the PDF → papel reminder) only when
//   * the order explicitly did NOT tick the checkout opt-out (marketing_opt_out = false;
//     null = ordered before the opt-out was offered → never), and
//   * the recipient address is not in email_suppressions.
// Transactional content is always sent; only the commercial part is dropped.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { SUPPORT_EMAIL } from "@/lib/support";
import { getSiteUrl } from "@/lib/email/send";
import { isAuthLocale } from "@/lib/auth/next-path";
import {
  listUnsubscribeHeaders,
  normalizeEmail,
  oneClickUnsubscribeUrl,
  signUnsubscribeToken,
  unsubscribeKey,
  unsubscribePageUrl,
} from "./unsubscribe-token";

export type SuppressionReason = "unsubscribed" | "checkout_opt_out";

/** Is this address suppressed? Throws on a DB error (callers fail closed). */
export async function isSuppressed(supabase: FulfilmentClient, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return true;
  const { data, error } = await supabase.from("email_suppressions").select("id").eq("email", normalized).maybeSingle();
  if (error) throw new Error(`email_suppressions read: ${error.message}`);
  return !!data;
}

/** Suppressed addresses among `emails` (normalised). Throws on a DB error. */
export async function suppressedAmong(supabase: FulfilmentClient, emails: readonly string[]): Promise<Set<string>> {
  const normalized = [...new Set(emails.map(normalizeEmail).filter((e): e is string => !!e))];
  const out = new Set<string>();
  for (let i = 0; i < normalized.length; i += 200) {
    const { data, error } = await supabase.from("email_suppressions").select("email").in("email", normalized.slice(i, i + 200));
    if (error) throw new Error(`email_suppressions read: ${error.message}`);
    for (const row of data ?? []) out.add(row.email);
  }
  return out;
}

/** Add an address (idempotent: the first reason is kept). Returns false for a non-address. */
export async function suppressEmail(
  supabase: FulfilmentClient,
  email: string,
  reason: SuppressionReason,
  source: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const { error } = await supabase
    .from("email_suppressions")
    .upsert({ email: normalized, reason, source: source.slice(0, 120) }, { onConflict: "email", ignoreDuplicates: true });
  if (error) throw new Error(`email_suppressions write: ${error.message}`);
  return true;
}

/**
 * May this order's email carry commercial content for `email`? Fails closed: any
 * error (or a missing opt-out answer) means no.
 */
export async function mayReceiveOffers(
  supabase: FulfilmentClient,
  order: { marketing_opt_out: boolean | null | undefined },
  email: string | null | undefined,
): Promise<boolean> {
  if (order.marketing_opt_out !== false || !email) return false;
  try {
    return !(await isSuppressed(supabase, email));
  } catch (err) {
    console.warn("[marketing] Suppression check failed, offers withheld:", err instanceof Error ? err.message : err);
    return false;
  }
}

export interface UnsubscribeLinks {
  /** Confirmation page (link in the email body). */
  pageUrl: string;
  /** Headers for RFC 8058 one-click unsubscribe. */
  headers: Record<string, string>;
}

/** Unsubscribe link + List-Unsubscribe headers for `email`, or null if it can't be signed. */
export function unsubscribeLinks(email: string, locale: string): UnsubscribeLinks | null {
  try {
    const token = signUnsubscribeToken(email, unsubscribeKey());
    const site = getSiteUrl();
    const loc = isAuthLocale(locale) ? locale : "es";
    return {
      pageUrl: unsubscribePageUrl(site, loc, token),
      headers: listUnsubscribeHeaders(oneClickUnsubscribeUrl(site, token), SUPPORT_EMAIL),
    };
  } catch (err) {
    console.warn("[marketing] Could not sign an unsubscribe link:", err instanceof Error ? err.message : err);
    return null;
  }
}
