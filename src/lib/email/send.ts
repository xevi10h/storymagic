// Transactional email sender — Resend REST API.
//
// We call the REST endpoint directly (no SDK dependency) to mirror the existing
// waitlist flow and keep the bundle small. Sending never throws: a failed email
// must not break an order webhook, so callers get a boolean and we log failures.
//
// Required env:
//   RESEND_API_KEY        — Resend API key
// Optional env:
//   EMAIL_FROM            — sender (default: "Meapica <hola@constrack.pro>"; switch to
//                           hola@meapica.com only once meapica.com is verified in Resend)
//   EMAIL_REPLY_TO        — reply-to for every email (default: SUPPORT_EMAIL from
//                           src/lib/support.ts, the customer-facing inbox)
//   NEXT_PUBLIC_SITE_URL  — public site origin (default: "https://meapica.com")

import { SUPPORT_EMAIL } from "../support";

const DEFAULT_FROM = "Meapica <hola@constrack.pro>";
const DEFAULT_SITE_URL = "https://meapica.com";

/** Public site origin without trailing slash. Used for logo + dashboard links in emails. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional reply-to override */
  replyTo?: string;
}

/**
 * Send one transactional email via Resend.
 * Returns true on success, false otherwise. Never throws.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not configured — skipping send to", params.to);
    return false;
  }

  const from = process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
  const replyTo = params.replyTo || process.env.EMAIL_REPLY_TO?.trim() || SUPPORT_EMAIL;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend returned ${res.status} for ${params.to}: ${detail}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Failed to send to", params.to, err);
    return false;
  }
}
