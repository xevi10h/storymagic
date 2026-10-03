// Meta Conversions API: server-side Purchase from the Stripe payment, deduplicated
// with the browser Pixel via event_id. Plain fetch (the official Node SDK lags on npm).
// Server only.

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { purchaseEventId } from "./consent";

const GRAPH_VERSION = "v26.0";

/** POST /{dataset}/events response: success fields, or Graph's error envelope. */
type MetaEventsResponse = {
  events_received?: number;
  fbtrace_id?: string;
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string; fbtrace_id?: string };
};

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/** Spanish numbers without country code get 34; Meta wants digits only, with country code. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 9 ? `34${digits}` : digits;
}

/**
 * Send one Purchase event for a paid Checkout Session. Only when the buyer
 * accepted advertising cookies (metadata.ads_consent, set by /api/checkout).
 * Never throws: tracking must not fail a payment webhook.
 */
export async function sendMetaPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // .trim(): a stray newline in the env value would make Meta reject the token.
  const token = process.env.META_CAPI_TOKEN?.trim();
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE;
  const meta = session.metadata ?? {};
  if (meta.ads_consent !== "1") {
    console.info(`[meta-capi] Purchase ${session.id} skipped: no ads consent`); // by design
    return;
  }
  if (!pixelId || !token) {
    // Consented purchase that can't be reported. Names which one is missing (never the value).
    const missing = [!pixelId && "NEXT_PUBLIC_META_PIXEL_ID", !token && "META_CAPI_TOKEN"].filter(Boolean).join(", ");
    console.error(`[meta-capi] Purchase ${session.id} NOT sent: missing ${missing}`);
    return;
  }
  // Test-mode payments only reach Meta as test events (Events Manager › Test events).
  if (!session.livemode && !testCode) {
    console.info(`[meta-capi] Purchase ${session.id} skipped: test-mode payment and no META_CAPI_TEST_EVENT_CODE`);
    return;
  }

  const email = session.customer_details?.email ?? session.customer_email;
  const phone = session.customer_details?.phone;
  const country = session.customer_details?.address?.country;
  const userData: Record<string, unknown> = {
    client_ip_address: meta.client_ip || undefined,
    client_user_agent: meta.client_ua || undefined,
    fbp: meta.fbp || undefined,
    fbc: meta.fbc || undefined,
    em: email ? [sha256(email)] : undefined,
    ph: phone ? [sha256(normalizePhone(phone))] : undefined,
    external_id: meta.user_id ? [sha256(meta.user_id)] : undefined,
    country: country ? [sha256(country)] : undefined,
  };

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: purchaseEventId(session.id),
        action_source: "website",
        event_source_url: meta.source_url || undefined,
        user_data: userData,
        custom_data: {
          value: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "eur").toUpperCase(),
          content_ids: meta.format ? [meta.format] : undefined,
          content_type: "product",
          order_id: session.id,
        },
      },
    ],
    ...(session.livemode ? {} : { test_event_code: testCode }),
  };

  // Every outcome is logged: a 200 with nothing in the logs is indistinguishable from "never ran".
  const mode = session.livemode ? "live" : `test:${testCode}`;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    let json: MetaEventsResponse = {};
    try {
      json = JSON.parse(text) as MetaEventsResponse;
    } catch {
      // non-JSON body (proxy/HTML error): logged raw below
    }
    if (res.ok && json.events_received === 1) {
      console.info(`[meta-capi] Purchase ${session.id} sent (${mode}): events_received=1 fbtrace_id=${json.fbtrace_id ?? "-"}`);
    } else if (json.error) {
      const e = json.error;
      console.error(
        `[meta-capi] Purchase ${session.id} REJECTED (${mode}): http=${res.status} code=${e.code ?? "-"} subcode=${e.error_subcode ?? "-"} type=${e.type ?? "-"} fbtrace_id=${e.fbtrace_id ?? "-"} message=${e.message ?? "-"}${e.error_user_msg ? ` detail=${e.error_user_msg}` : ""}`,
      );
    } else {
      // 2xx without events_received=1, or an unparseable body.
      console.error(`[meta-capi] Purchase ${session.id} NOT confirmed (${mode}): http=${res.status} body=${text.slice(0, 500)}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[meta-capi] Purchase ${session.id} FAILED (${mode}): ${reason}`);
  }
}
