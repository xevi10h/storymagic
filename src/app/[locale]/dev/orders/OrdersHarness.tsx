"use client";

import { OrdersTab, type DashboardOrder } from "@/components/dashboard/OrdersTab";

const story = (title: string, status: string) => ({ title, status, generated_text: null, characters: { name: "Teo" } });
const address = { line1: "Carrer de Mallorca 200, 3º 2ª", city: "Barcelona", postal_code: "08036" };
const base = {
  subtotal: 49.9,
  total: 49.9,
  addons: [] as string[],
  tracking_number: null,
  tracking_url: null,
  shipping_name: "Marta García",
  shipping_address: address,
  invoice_url: "https://invoice.stripe.com/i/acct_test/test_fixture",
  download_token: "00000000-0000-4000-8000-000000000000",
  refunded_at: null,
  gelato_status: null,
  pdf_ready: true,
};

export const ORDER_FIXTURES: Record<string, DashboardOrder> = {
  printing: {
    ...base,
    id: "34d619c2-1111-4000-8000-000000000001",
    format: "hardcover",
    status: "producing",
    addons: ["extra_copy"],
    total: 79.8,
    created_at: "2026-09-26T10:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000001",
    gelato_status: "in_production",
    stories: story("Teo y el dragón de la biblioteca", "ordered"),
  },
  shipped: {
    ...base,
    id: "8b2e11aa-2222-4000-8000-000000000002",
    format: "softcover",
    status: "shipped",
    total: 34.9,
    created_at: "2026-09-18T10:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000002",
    tracking_number: "ES2HX0000123456",
    tracking_url: "https://track.example/ES2HX0000123456",
    gelato_status: "in_transit",
    stories: story("Teo y la expedición a la Luna", "shipped"),
    // Printed order within 60 days → "¿Una para los abuelos?"
    upsell: {
      offer: "extra_copy_repeat",
      storyId: "5a000000-0000-4000-8000-000000000002",
      sourceOrderId: "8b2e11aa-2222-4000-8000-000000000002",
      sourceFormat: "softcover",
      expiresAt: "2026-11-17T10:00:00.000Z",
    },
  },
  digital: {
    ...base,
    id: "c0ffee12-3333-4000-8000-000000000003",
    format: "digital_pdf",
    status: "producing",
    total: 9.9,
    created_at: "2026-09-28T10:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000003",
    shipping_name: null,
    shipping_address: null,
    stories: story("Teo y el bosque que canta", "ready"),
    // Paid PDF → "¿Lo quieres en papel?"
    upsell: {
      offer: "pdf_upgrade",
      storyId: "5a000000-0000-4000-8000-000000000003",
      sourceOrderId: "c0ffee12-3333-4000-8000-000000000003",
      sourceFormat: "digital_pdf",
      expiresAt: null,
    },
  },
  upgraded: {
    ...base,
    id: "abcd0000-7777-4000-8000-000000000007",
    format: "hardcover",
    status: "paid",
    offer: "pdf_upgrade",
    subtotal: 40,
    total: 40,
    created_at: "2026-09-30T11:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000007",
    stories: story("Teo y el faro de las estrellas", "ordered"),
  },
  refunded: {
    ...base,
    id: "d00dfeed-4444-4000-8000-000000000004",
    format: "hardcover",
    status: "refunded",
    created_at: "2026-09-10T10:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000004",
    refunded_at: "2026-09-12T10:00:00Z",
    download_token: null,
    stories: story("Teo y el mar de las ballenas", "ready"),
  },
  goodwill: {
    ...base,
    id: "e1e10000-5555-4000-8000-000000000005",
    format: "hardcover",
    status: "delivered",
    created_at: "2026-08-30T10:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000005",
    tracking_number: "ES2HX0000999999",
    tracking_url: "https://track.example/ES2HX0000999999",
    gelato_status: "delivered",
    refunded_at: "2026-09-15T10:00:00Z",
    stories: story("Teo y el castillo de nubes", "delivered"),
  },
  preparing: {
    ...base,
    id: "f00d0000-6666-4000-8000-000000000006",
    format: "digital_pdf",
    status: "paid",
    total: 9.9,
    created_at: "2026-09-30T09:00:00Z",
    story_id: "5a000000-0000-4000-8000-000000000006",
    shipping_name: null,
    shipping_address: null,
    pdf_ready: false,
    download_token: "00000000-0000-4000-8000-000000000006",
    stories: story("Teo y la ciudad de los relojes", "completing"),
  },
};

export function OrdersHarness({ only }: { only?: string }) {
  const orders = only ? only.split(",").map((k) => ORDER_FIXTURES[k]).filter(Boolean) : Object.values(ORDER_FIXTURES);
  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <OrdersTab orders={orders} empty={<p>empty</p>} />
      </div>
    </main>
  );
}
