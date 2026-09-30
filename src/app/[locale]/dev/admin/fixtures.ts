// DEV-ONLY fixture orders for the /admin visual harness. Invented data, no real customer.
import type { AdminOrderDetail } from "@/lib/admin/data";
import type { AdminOrderRow } from "@/lib/admin/orders-view";

export const FIXTURE_NOW = Date.parse("2026-09-30T12:00:00Z");
const h = (hours: number) => new Date(FIXTURE_NOW - hours * 3_600_000).toISOString();

const row = (n: number, patch: Partial<AdminOrderRow>): AdminOrderRow => ({
  id: `${(0x3f2a1c00 + n * 0x1111).toString(16).padStart(8, "0")}-7d1e-4c2a-9b1f-${String(n).padStart(12, "0")}`,
  created_at: h(n * 9),
  status: "delivered",
  format: "hardcover",
  total: 49.9,
  currency: "eur",
  customer_email: `familia${n}@example.com`,
  shipping_name: "Familia Ejemplo",
  story_id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  user_id: `11111111-0000-4000-8000-${String(n).padStart(12, "0")}`,
  gelato_order_id: `gel-${n}0a9-4f1c`,
  gelato_status: "delivered",
  gelato_last_error: null,
  gelato_submit_attempts: 1,
  fulfilment_alerted_at: null,
  fulfilment_requeued_at: null,
  stripe_payment_id: `pi_3Fixture${n}`,
  stripe_checkout_session_id: `cs_live_fixture${n}`,
  tracking_number: `1Z999AA1${n}`,
  refunded_at: null,
  story_title: "La gran aventura",
  child_name: "Niño",
  ...patch,
});

export const FIXTURE_ROWS: AdminOrderRow[] = [
  row(1, { status: "paid", created_at: h(0.5), gelato_order_id: null, gelato_status: null, tracking_number: null, child_name: "Lucía", story_title: "El bosque de Lucía" }),
  row(2, { status: "paid", created_at: h(52), gelato_order_id: null, gelato_status: null, tracking_number: null, gelato_submit_attempts: 8, gelato_last_error: "Gelato 400: invalid postcode", fulfilment_alerted_at: h(20), child_name: "Mateo", story_title: "Mateo y el dragón" }),
  row(3, { status: "producing", created_at: h(30), gelato_status: "on_hold", tracking_number: null, child_name: "Martina", story_title: "Martina en el mar", format: "softcover", total: 34.9 }),
  row(4, { status: "producing", created_at: h(150), gelato_status: "in_production", tracking_number: null, child_name: "Hugo", story_title: "Hugo, astronauta" }),
  row(5, { status: "shipped", created_at: h(70), gelato_status: "in_transit", child_name: "Sofía", story_title: "Sofía y la luna" }),
  row(6, { status: "producing", created_at: h(80), format: "digital_pdf", total: 9.9, gelato_order_id: null, gelato_status: null, tracking_number: null, child_name: "Leo", story_title: "Leo el valiente" }),
  row(7, { status: "refunded", created_at: h(90), refunded_at: h(88), gelato_status: "cancelled", tracking_number: null, child_name: "Valeria", story_title: "Valeria y los piratas" }),
  row(8, { status: "delivered", created_at: h(200), child_name: "Pau", story_title: "En Pau i el drac" }),
  row(9, { status: "delivered", created_at: h(400), user_id: null, story_id: null, child_name: null, story_title: null }),
  row(10, { status: "cancelled", created_at: h(420), gelato_order_id: null, gelato_status: null, tracking_number: null, stripe_payment_id: null, child_name: "Alma", story_title: "Alma y el bosque" }),
];

export function fixtureDetail(orderId: string): AdminOrderDetail | null {
  const r = FIXTURE_ROWS.find((o) => o.id === orderId) ?? null;
  if (!r) return null;
  return {
    fetchedAt: FIXTURE_NOW,
    order: {
      ...r,
      subtotal: r.total,
      addons: ["extra_copy"],
      shipping_address: { line1: "Carrer de l'Exemple 12, 3r 2a", line2: "", postal_code: "08036", city: "Barcelona", state: "B", country: "ES", phone: "+34 600 000 000" },
      withdrawal_consent_at: r.created_at,
      withdrawal_consent_version: "2026-09-30",
      confirmation_email_sent_at: r.created_at,
      ready_email_sent_at: r.status === "paid" ? null : h(1),
      gelato_next_attempt_at: null,
      print_files_validated_at: r.status === "paid" ? null : r.created_at,
      print_interior_path: null,
      print_cover_path: null,
      gelato_reprint_count: 0,
      invoice_url: "https://invoice.stripe.com/i/fixture",
      stripe_invoice_id: "in_fixture",
      tracking_url: r.tracking_number ? "https://example.com/track" : null,
    },
    story: r.story_id
      ? {
          id: r.story_id,
          status: r.status === "paid" ? "completing" : "delivered",
          title: r.story_title,
          locale: "es",
          completion_attempts: r.status === "paid" ? 3 : 0,
          completion_last_error: r.status === "paid" ? "OpenAI 429: rate limited" : null,
          completion_next_attempt_at: null,
          final_generated_at: r.status === "paid" ? null : h(2),
          pdf_url: null,
          is_showcase: false,
        }
      : null,
    history: [
      { from_status: null, to_status: "pending", gelato_status: null, changed_at: r.created_at },
      { from_status: "pending", to_status: "paid", gelato_status: null, changed_at: r.created_at },
      ...(r.status !== "paid" ? [{ from_status: "paid", to_status: r.status, gelato_status: r.gelato_status, changed_at: h(1) }] : []),
    ],
    audit: [
      { created_at: h(0.2), actor_email: "ops@example.com", action: "resend_email:shipped", ok: true, details: { message: "Email de envío reenviado." } },
    ],
  };
}
