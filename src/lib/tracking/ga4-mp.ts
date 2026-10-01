// GA4 Measurement Protocol: server-side purchase from the Stripe payment,
// deduplicated with the browser gtag purchase via transaction_id. Plain fetch. Server only.

import type Stripe from "stripe";
import { purchaseEventId } from "./consent";

// EU collection endpoint (data collected in the EU).
const ENDPOINT = "https://region1.google-analytics.com/mp/collect";

/** `_ga` = "GA1.1.<random>.<timestamp>" → client id "<random>.<timestamp>". */
export function gaClientId(cookie: string | undefined): string {
  const m = cookie?.match(/^GA\d\.\d\.(\d+\.\d+)$/);
  return m ? m[1] : "";
}

/** `_ga_<stream>` = "GS1.1.<session_id>.…" or "GS2.1.s<session_id>$o…" → session id. */
export function gaSessionId(cookie: string | undefined): string {
  const m = cookie?.match(/^GS1\.\d\.(\d+)\./) ?? cookie?.match(/^GS2\.\d\.s(\d+)/);
  return m ? m[1] : "";
}

/**
 * Send one purchase for a paid Checkout Session, attributed to the buyer's GA4
 * session. Only when the buyer accepted cookies (metadata.ads_consent, set by
 * /api/checkout) and gtag had set its client id. Never throws: tracking must
 * not fail a payment webhook.
 */
export async function sendGa4Purchase(session: Stripe.Checkout.Session): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA4_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  const meta = session.metadata ?? {};
  if (meta.ads_consent !== "1") return; // no consent: nothing to send, by design
  if (!measurementId || !apiSecret) {
    // Consented purchase that can't be reported: say so instead of failing silently.
    console.warn(`[ga4-mp] purchase ${session.id} not sent: missing NEXT_PUBLIC_GA4_ID / GA4_API_SECRET`);
    return;
  }
  // GA4 has no test-event mode: test-mode payments never reach the property.
  if (!session.livemode) return;
  // Consent granted but gtag never set _ga (e.g. accepted on the checkout page itself):
  // the browser purchase on the success page still reports it.
  if (!meta.ga_cid) return;

  const value = (session.amount_total ?? 0) / 100;
  const body = {
    client_id: meta.ga_cid,
    timestamp_micros: Date.now() * 1000,
    consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: purchaseEventId(session.id),
          value,
          currency: (session.currency ?? "eur").toUpperCase(),
          items: meta.format ? [{ item_id: meta.format, item_name: meta.format, price: value, quantity: 1 }] : undefined,
          ...(meta.ga_sid ? { session_id: meta.ga_sid } : {}),
          engagement_time_msec: 1,
        },
      },
    ],
  };

  try {
    const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    // MP answers 2xx even for malformed events (validation lives at /debug/mp/collect).
    if (!res.ok) console.error(`[ga4-mp] purchase ${session.id} rejected: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[ga4-mp] purchase ${session.id} failed:`, err);
  }
}
