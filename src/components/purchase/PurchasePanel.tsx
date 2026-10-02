"use client";

import { forwardRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookMockup, type BackCoverSource, type BookMockupFormat } from "@/components/book-mockup";
import { deName } from "@/lib/creation-flow";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import {
  PRICING,
  ENABLED_ADDON_IDS,
  SHOW_REPRINT_GUARANTEE,
  addonPrice,
  formatPrice,
  type AddonId,
  type BookFormat,
} from "@/lib/pricing";
import { useDeliveryLine, useSeasonNotice } from "./delivery";
import { Spinner } from "@/components/ui/Spinner";
import { MarketingOptOut } from "./MarketingOptOut";

/**
 * The PDF is sold as a text link under the two printed options ("¿Solo el PDF?"),
 * so the 9,90 € card no longer anchors the hardcover as expensive (audit P1-7).
 * false = three radio rows again.
 */
const PDF_AS_LINK = true;

const PRINTED_FORMATS = ["hardcover", "softcover"] as const;

/** "idle" | "missing" (main CTA without consent: red) | "nudge" (sticky bar sent us here: soft). */
export type ConsentState = "idle" | "missing" | "nudge";

interface PurchasePanelProps {
  childName: string;
  /** Drives the Catalan personal article ("el llibre de la Noa"). */
  childGender?: string;
  title: string;
  coverUrl: string | null;
  /** Board / spine colour from the book palette (getBookColors(...).gradientStart). */
  spineColor: string;
  format: BookFormat;
  /** Called on every explicit choice, also re-choosing the pre-selected format. */
  onChooseFormat: (format: BookFormat) => void;
  addons: Set<AddonId>;
  onToggleAddon: (id: AddonId) => void;
  subtotal: number;
  consent: boolean;
  consentState: ConsentState;
  onConsentChange: (checked: boolean) => void;
  /** "No quiero recibir ofertas…" (LSSI 21.2 opt-out at collection), never pre-ticked. */
  marketingOptOut: boolean;
  onMarketingOptOutChange: (checked: boolean) => void;
  checkingOut: boolean;
  checkoutError: string | null;
  onCheckout: () => void;
  /** Two-column desktop: small mockup beside the headline, without the scale lines. */
  compact?: boolean;
  /** Back cover of the mockup (seen when the reader turns the book round) */
  back?: BackCoverSource;
  /** Slot for dev-only tools (mock-mode unlock), rendered above the CTA. */
  devTools?: React.ReactNode;
}

function mockupFormat(format: BookFormat): BookMockupFormat {
  return format === "digital_pdf" ? "pdf" : format;
}

/**
 * Screen 6 buy panel: what arrives home (their own cover as a printed book that
 * follows the chosen format), compact format radios with price + delivery, the
 * extra copy as one line, one-line consent, CTA and verifiable trust lines.
 * `#checkout-section` is the panel, `#formats` the choice (scroll targets).
 */
const PurchasePanel = forwardRef<HTMLButtonElement, PurchasePanelProps>(function PurchasePanel(
  {
    childName,
    childGender,
    title,
    coverUrl,
    spineColor,
    format,
    onChooseFormat,
    addons,
    onToggleAddon,
    subtotal,
    consent,
    consentState,
    onConsentChange,
    marketingOptOut,
    onMarketingOptOutChange,
    checkingOut,
    checkoutError,
    onCheckout,
    compact = false,
    back,
    devTools,
  },
  ctaRef,
) {
  const t = useTranslations("crear.purchase");
  const tPreview = useTranslations("crear.preview");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const price = (cents: number) => formatPrice(cents, locale);
  const names = { name: childName, deName: deName(childName, locale, childGender) };

  const isDigital = format === "digital_pdf";
  const delivery = useDeliveryLine(format);
  const season = useSeasonNotice();
  const extraSelected = addons.has("extra_copy");
  const gap = PRICING.hardcover.price - PRICING.softcover.price;

  const rows: BookFormat[] = PDF_AS_LINK
    ? [...PRINTED_FORMATS, ...(isDigital ? (["digital_pdf"] as const) : [])]
    : [...PRINTED_FORMATS, "digital_pdf"];

  const formatName = (key: BookFormat) => tPricing(`${key}.label`).toLowerCase();

  return (
    <div id="checkout-section" className="scroll-mt-[calc(var(--creation-header-h,56px)+12px)]">
      {/* Desktop: headline beside a compact mockup, so the CTA stays above the fold */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_150px] lg:items-center lg:gap-2">
      <div>
        <h2 className="font-display text-[22px] font-bold leading-tight text-secondary">
          {t("headline", names)}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-create-text-sub lg:text-xs">{t("specs")}</p>
      </div>

      {/* Their own cover, as the chosen format (animates on change) */}
      <div className="relative mx-auto mt-2 w-full max-w-[340px] lg:mt-0">
        <BookMockup
          coverUrl={coverUrl}
          title={title}
          childName={childName}
          subtitle={tPreview("personalizedStory")}
          format={mockupFormat(format)}
          spineColor={spineColor}
          showScale={!compact}
          alt={t("mockupAlt", { ...names, title, format: formatName(format) })}
          rotatable
          rotateLabel={t("rotateMockup")}
          back={back}
        />
        {extraSelected && !isDigital && (
          <span className="absolute right-[6%] top-[10%] rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-white shadow-md">
            × 2
          </span>
        )}
      </div>
      </div>

      {/* Format choice */}
      <fieldset id="formats" className="mt-1 lg:mt-3 scroll-mt-[calc(var(--creation-header-h,56px)+12px)]">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-create-text-sub">{t("formatsLegend")}</legend>
        <div className="space-y-2">
          {rows.map((key) => {
            const selected = format === key;
            const digital = key === "digital_pdf";
            return (
              <label
                key={key}
                data-testid={`format-${key}`}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3.5 py-3 transition-colors ${
                  selected ? "border-create-primary bg-create-primary/[0.04]" : "border-create-neutral bg-white hover:border-create-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="book-format"
                  value={key}
                  checked={selected}
                  onChange={() => onChooseFormat(key)}
                  onClick={() => onChooseFormat(key)}
                  className="mt-1 h-[18px] w-[18px] shrink-0 accent-create-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base font-bold text-create-text-dark">{tPricing(`${key}.label`)}</span>
                    <span className="whitespace-nowrap text-base font-bold tabular-nums text-secondary">{price(PRICING[key].price)}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-3 text-xs leading-snug">
                    <span className="min-w-0 text-create-text-sub">
                      {key === "hardcover" && (
                        <>
                          <span className="font-semibold text-brand-text">{tPreview("bestForGifting")}</span>
                          {" · "}
                          {t("hardcoverGap", { diff: price(gap) })}
                        </>
                      )}
                      {key === "softcover" && t("softcoverNote")}
                      {digital && t("pdfInstant")}
                    </span>
                    <span className="shrink-0 text-create-text-sub">{tPricing("vatIncluded")}</span>
                  </span>
                  {!digital && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-success">
                      <span aria-hidden className="material-symbols-outlined text-[15px]">local_shipping</span>
                      {t("freeShipping")}
                      <span className="font-normal text-create-text-sub">· {t("pdfIncluded")}</span>
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        {PDF_AS_LINK && !isDigital && (
          <button
            type="button"
            onClick={() => onChooseFormat("digital_pdf")}
            className="mt-2 text-[13px] text-create-text-sub underline decoration-create-text-sub/40 underline-offset-2 transition-colors hover:text-brand-text"
          >
            {t("pdfOnly", { price: price(PRICING.digital_pdf.price) })}
          </button>
        )}
      </fieldset>

      {/* Extra copy: one line */}
      {!isDigital &&
        ENABLED_ADDON_IDS.includes("extra_copy") && (
          <label
            data-testid="extra-copy"
            className={`mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3.5 py-2.5 transition-colors ${
              extraSelected ? "border-create-primary bg-create-primary/[0.04]" : "border-dashed border-create-neutral hover:border-create-primary/40"
            }`}
          >
            <input
              type="checkbox"
              checked={extraSelected}
              onChange={() => onToggleAddon("extra_copy")}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-create-primary"
            />
            <span className="text-[13px] leading-snug text-create-text-dark">
              <span className="font-bold">+ {t("extraCopy")}</span>
              {" · "}
              <span className="whitespace-nowrap font-bold tabular-nums">{price(addonPrice("extra_copy", format))}</span>{" "}
              <span className="whitespace-nowrap text-create-text-sub">{tPricing("vatIncluded")}</span>
              <span className="text-create-text-sub"> · {t("extraCopyNote")}</span>
            </span>
          </label>
        )}

      {/* Delivery */}
      <div className="mt-4 space-y-1 text-[13px] leading-snug">
        {isDigital ? (
          <p className="flex items-start gap-2 text-create-text">
            <span aria-hidden className="material-symbols-outlined mt-px text-[17px] text-brand-text">download</span>
            {t("digitalDelivery")}
          </p>
        ) : (
          <>
            {delivery && (
              <p className="flex items-start gap-2 font-semibold text-create-text-dark" data-testid="delivery-line">
                <span aria-hidden className="material-symbols-outlined mt-px text-[17px] text-brand-text">event_available</span>
                <span>
                  {delivery} <span className="font-normal text-create-text-sub">({t("deliveryEstimate")})</span>
                </span>
              </p>
            )}
            <p className="pl-[25px] text-create-text-sub">{t("deliveryArea")}</p>
          </>
        )}
        {season && (
          <p className="pl-[25px]">
            <Link href={CHRISTMAS_DELIVERY_PATH} className="font-semibold text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-brand-text">
              {season.text}
            </Link>
          </p>
        )}
      </div>

      {devTools}

      {/* Consent (art. 103 m LGDCU): one plain line, never pre-ticked */}
      <label
        id="withdrawal-consent"
        className={`mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-snug text-create-text transition-colors scroll-mt-[calc(var(--creation-header-h,56px)+80px)] ${
          consentState === "missing" && !consent
            ? "bg-red-50 ring-1 ring-red-300"
            : consentState === "nudge" && !consent
              ? "bg-create-primary/[0.06] ring-2 ring-create-primary/40"
              : "bg-create-neutral/60"
        }`}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsentChange(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-create-primary"
          aria-describedby={consentState === "missing" && !consent ? "withdrawal-consent-error" : undefined}
        />
        <span>{tPricing("withdrawal.label")}</span>
      </label>
      {consentState === "missing" && !consent && (
        <p id="withdrawal-consent-error" className="mt-1.5 text-xs text-red-700" role="alert">
          {tPricing("withdrawal.required")}
        </p>
      )}
      <MarketingOptOut checked={marketingOptOut} onChange={onMarketingOptOutChange} className="mt-2.5" />

      <button
        ref={ctaRef}
        type="button"
        onClick={onCheckout}
        disabled={checkingOut}
        data-testid="checkout-cta"
        className="min-h-12 mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-create-primary px-5 py-4 text-[19px] font-bold leading-tight text-white shadow-lg shadow-create-primary/20 transition-all hover:bg-create-primary-hover active:scale-[0.98] disabled:opacity-60"
      >
        {checkingOut ? (
          <>
            <Spinner className="text-lg" />
            {tPreview("processing")}
          </>
        ) : isDigital ? (
          tPreview("ctaDigital", { ...names, price: price(subtotal) })
        ) : (
          tPreview("ctaPhysical", { ...names, price: price(subtotal) })
        )}
      </button>
      <p className="mt-1.5 text-center text-xs text-create-text-sub">
        {isDigital ? t("ctaNoteDigital") : t("ctaNotePhysical")}
      </p>
      {checkoutError && (
        <p className="mt-2 text-center text-xs text-red-700" role="alert">
          {checkoutError}
        </p>
      )}

      {/* Verifiable trust only (no ratings, no counts) */}
      <ul className="mt-4 space-y-1.5 border-t border-create-neutral pt-4 text-[13px] text-create-text">
        <TrustLine icon="auto_stories">{t("trustPreview")}</TrustLine>
        <TrustLine icon="lock">{t("trustPayment")}</TrustLine>
        <TrustLine icon="home_pin">{t("trustMadeIn")}</TrustLine>
        {SHOW_REPRINT_GUARANTEE && <TrustLine icon="verified">{t("trustReprint")}</TrustLine>}
      </ul>
    </div>
  );
});

function TrustLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="material-symbols-outlined mt-px text-[17px] text-create-text-sub">{icon}</span>
      <span>{children}</span>
    </li>
  );
}

export default PurchasePanel;
