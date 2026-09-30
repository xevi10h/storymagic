"use client";

import { useState } from "react";
import PurchasePanel, { type ConsentState } from "@/components/purchase/PurchasePanel";
import { ReorderSheet } from "@/components/dashboard/OrdersTab";
import { PRICING, type AddonId, type BookFormat } from "@/lib/pricing";

/** Fixture paywall: shows the body /api/checkout would receive instead of calling it. */
export function PurchaseHarness() {
  const [format, setFormat] = useState<BookFormat>("hardcover");
  const [addons, setAddons] = useState<Set<AddonId>>(new Set());
  const [consent, setConsent] = useState(false);
  const [consentState, setConsentState] = useState<ConsentState>("idle");
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sheetStory, setSheetStory] = useState<string | null>(null);

  return (
    <main className="min-h-dvh bg-paper px-4 py-8">
      <div className="mx-auto max-w-[440px] rounded-3xl bg-white p-5 shadow-card ring-1 ring-line sm:p-6">
        <PurchasePanel
          childName="Teo"
          title="Teo y el dragón de la biblioteca"
          coverUrl={null}
          spineColor="#5D4037"
          format={format}
          onChooseFormat={setFormat}
          addons={addons}
          onToggleAddon={(id) =>
            setAddons((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          subtotal={PRICING[format].price}
          consent={consent}
          consentState={consentState}
          onConsentChange={(checked) => {
            setConsent(checked);
            if (checked) setConsentState("idle");
          }}
          marketingOptOut={marketingOptOut}
          onMarketingOptOutChange={setMarketingOptOut}
          checkingOut={false}
          checkoutError={null}
          onCheckout={() => {
            if (!consent) return setConsentState("missing");
            setSent(JSON.stringify({ storyId: "fixture", format, addons: [...addons], locale: "es", withdrawalConsent: true, marketingOptOut }));
          }}
        />
        {sent && (
          <pre data-testid="checkout-body" className="mt-4 whitespace-pre-wrap break-all rounded-xl bg-line p-3 text-xs text-ink-soft">
            {sent}
          </pre>
        )}
        <button type="button" className="mt-4 text-sm underline" onClick={() => setSheetStory("5a000000-0000-4000-8000-000000000003")}>
          Open reorder sheet
        </button>
      </div>
      <ReorderSheet
        storyId={sheetStory}
        title="Teo y el dragón de la biblioteca"
        offer={{
          offer: "pdf_upgrade",
          storyId: "5a000000-0000-4000-8000-000000000003",
          sourceOrderId: "c0ffee12-3333-4000-8000-000000000003",
          sourceFormat: "digital_pdf",
          expiresAt: null,
        }}
        onClose={() => setSheetStory(null)}
      />
    </main>
  );
}
