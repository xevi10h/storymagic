// TikTok Events API 2.0: server-side Purchase from the Stripe payment,
// deduplicated with the browser pixel via event_id. Plain fetch. Server only.

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { purchaseEventId } from "./consent";

const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/** E.164 (TikTok hashes "+34600111222"); Spanish numbers without country code get +34. */
function e164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+${digits.length === 9 ? `34${digits}` : digits}`;
}

/**
 * Send one Purchase for a paid Checkout Session. Only when the buyer
 * accepted advertising cookies (metadata.ads_consent, set by /api/checkout).
 * Never throws: tracking must not fail a payment webhook.
 */
export async function sendTikTokPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;
  const token = process.env.TIKTOK_EVENTS_TOKEN;
  const testCode = process.env.TIKTOK_TEST_EVENT_CODE;
  const meta = session.metadata ?? {};
  if (!pixelId || !token || meta.ads_consent !== "1") return;
  // Test-mode payments only reach TikTok as test events (Events Manager › Test events).
  if (!session.livemode && !testCode) return;

  const email = session.customer_details?.email ?? session.customer_email;
  const phone = session.customer_details?.phone;
  const body = {
    event_source: "web",
    event_source_id: pixelId,
    ...(session.livemode ? {} : { test_event_code: testCode }),
    data: [
      {
        event: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: purchaseEventId(session.id),
        user: {
          email: email ? sha256(email) : undefined,
          phone: phone ? sha256(e164(phone)) : undefined,
          external_id: meta.user_id ? sha256(meta.user_id) : undefined,
          ttp: meta.ttp || undefined,
          ttclid: meta.ttclid || undefined,
          ip: meta.client_ip || undefined,
          user_agent: meta.client_ua || undefined,
        },
        properties: {
          value: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "eur").toUpperCase(),
          content_type: "product",
          contents: meta.format ? [{ content_id: meta.format }] : undefined,
          order_id: session.id,
        },
        page: meta.source_url ? { url: meta.source_url } : undefined,
      },
    ],
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    // TikTok answers 200 with a non-zero `code` on errors.
    const json = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    if (!res.ok || json?.code !== 0) console.error(`[tiktok-events] Purchase ${session.id} rejected: ${res.status} ${JSON.stringify(json)}`);
  } catch (err) {
    console.error(`[tiktok-events] Purchase ${session.id} failed:`, err);
  }
}
