// Operator alerts for fulfilment problems that need a human (stranded order,
// validation gate failed, AI provider out of credits…). Never throws.
//
// Recipient: OPS_ALERT_EMAIL, falling back to GELATO_OWNER_EMAIL (the operator who
// already receives Gelato "owner mode" shipments).
// Dedupe: public.claim_ops_alert(key, window) — at most one email per key per window.
// If the dedupe RPC is unavailable (migration not applied yet) we still send: a
// duplicate alert is better than a silent failure.

import { sendEmail } from "@/lib/email/send";
import { escapeHtml, renderEmailLayout } from "@/lib/email/layout";
import type { FulfilmentClient } from "./db";
import type { ProviderUnavailableError } from "./provider-errors";

export interface OperatorAlert {
  /** Dedupe key, e.g. `gelato-failed:<orderId>` or `provider:fal:out_of_credits`. */
  key: string;
  subject: string;
  /** Plain-text lines; rendered as paragraphs. */
  lines: string[];
  /** Minimum seconds between two emails with the same key (default 1 hour). */
  dedupeSeconds?: number;
}

function operatorEmail(): string | undefined {
  return process.env.OPS_ALERT_EMAIL?.trim() || process.env.GELATO_OWNER_EMAIL?.trim() || undefined;
}

async function claimAlert(supabase: FulfilmentClient, key: string, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("claim_ops_alert", {
      p_key: key,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[ops-alert] dedupe RPC failed for "${key}" (sending anyway):`, error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error(`[ops-alert] dedupe RPC threw for "${key}" (sending anyway):`, err);
    return true;
  }
}

/** Send a deduplicated alert to the operator. Returns true if an email went out. */
export async function alertOperator(supabase: FulfilmentClient, alert: OperatorAlert): Promise<boolean> {
  // Always leave a searchable trace in the logs, even when the email is deduped.
  console.error(`[ops-alert] ${alert.subject} — ${alert.lines.join(" | ")}`);

  const to = operatorEmail();
  if (!to) {
    console.error("[ops-alert] No OPS_ALERT_EMAIL / GELATO_OWNER_EMAIL configured — alert NOT emailed");
    return false;
  }

  const shouldSend = await claimAlert(supabase, alert.key, alert.dedupeSeconds ?? 3600);
  if (!shouldSend) return false;

  const subject = `[Meapica ops] ${alert.subject}`;
  const html = renderEmailLayout({
    heading: escapeHtml(alert.subject),
    paragraphs: alert.lines.map((l) => escapeHtml(l)),
    signoff: `Automatic alert · key ${escapeHtml(alert.key)}`,
    lang: "en",
  });
  return sendEmail({ to, subject, html, text: [alert.subject, ...alert.lines].join("\n\n") });
}

/** Alert for a provider that cannot serve requests (max one email per provider/kind per hour). */
export function alertProviderUnavailable(
  supabase: FulfilmentClient,
  err: ProviderUnavailableError,
  context: string,
): Promise<boolean> {
  return alertOperator(supabase, {
    key: `provider:${err.provider}:${err.kind}`,
    subject: `AI provider "${err.provider}" unavailable (${err.kind})`,
    lines: [
      `Context: ${context}`,
      `Error: ${err.message.slice(0, 500)}`,
      "Paid books are paused (no money is being spent) and resume automatically once the provider works again (cron every 5 min).",
    ],
    dedupeSeconds: 3600,
  });
}
