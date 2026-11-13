"use client";

import { useEffect, useState } from "react";
import PurchasePanel from "@/components/purchase/PurchasePanel";
import { ReorderSheet } from "@/components/dashboard/OrdersTab";
import { PRICING, addonPrice, type AddonId, type BookFormat } from "@/lib/pricing";
import { blackFridayPriceCents } from "@/lib/black-friday";
import { useBlackFriday } from "@/components/seasonal/SalePrice";

/** Fixture paywall: shows the body /api/checkout would receive instead of calling it. */
export function PurchaseHarness() {
  const [format, setFormat] = useState<BookFormat>("hardcover");
  const [addons, setAddons] = useState<Set<AddonId>>(new Set());
  const [consent, setConsent] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sheetStory, setSheetStory] = useState<string | null>(null);
  // As if the visitor came through a creator link (/r/LARA10); ?link=MEA7K3P9Q = a friend's
  // referral code, ?link= (empty) = no link code. Dates: ?now=YYYY-MM-DD (dev).
  const [linkCode, setLinkCode] = useState<{ code: string } | null>({ code: "LARA10" });
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("link");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dev fixture read once from the URL after hydration
    if (param !== null) setLinkCode(param.trim() ? { code: param.trim().toUpperCase() } : null);
  }, []);
  const [ownCode, setOwnCode] = useState(false);
  // Same subtotal as the preview page: Black Friday price on the book line inside the window.
  const blackFriday = useBlackFriday();
  const subtotal =
    (blackFriday && !ownCode ? blackFridayPriceCents(PRICING[format].price) : PRICING[format].price) +
    [...addons].reduce((sum, id) => sum + addonPrice(id, format), 0);

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
          subtotal={subtotal}
          consent={consent}
          onConsentChange={setConsent}
          marketingOptOut={marketingOptOut}
          onMarketingOptOutChange={setMarketingOptOut}
          checkingOut={false}
          checkoutError={null}
          linkCode={linkCode ? { ...linkCode, replaced: ownCode } : null}
          onUseOwnCode={() => setOwnCode(true)}
          ownCode={ownCode}
          onCancelOwnCode={() => setOwnCode(false)}
          onCheckout={() => {
            if (!consent) return setSent("blocked: withdrawal consent missing");
            setSent(JSON.stringify({ storyId: "fixture", format, addons: [...addons], locale: "es", withdrawalConsent: true, marketingOptOut, ownCode }));
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
