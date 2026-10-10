"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Sheet from "@/components/create/Sheet";
import { MarketingOptOut } from "@/components/purchase/MarketingOptOut";
import { Button, buttonClass, cx } from "@/components/ui";
import { formatPrice, offerPrice, PRICING, STRIPE_CATALOG, type PhysicalFormat } from "@/lib/pricing";
import { orderReference, orderView, PRINT_STEPS, type OrderView } from "@/lib/order-view";
import { SUPPORT_EMAIL } from "@/lib/support";
import type { StoryUpsell } from "@/lib/upsell";
import { REFERRAL_DISCOUNT_CENTS, REFERRAL_ROUTE } from "@/lib/promo-codes";

// ── Types (shape of /api/dashboard → orders) ────────────────────────────────

export interface DashboardOrder {
  id: string;
  format: string;
  status: string;
  subtotal: number;
  total: number;
  addons: unknown;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_name: string | null;
  shipping_address: {
    line1?: string;
    line2?: string;
    city?: string;
    postal_code?: string;
  } | null;
  created_at: string;
  /** Null once the account behind it was deleted. */
  story_id: string | null;
  invoice_url: string | null;
  /** Only while the order is live (credential of /api/downloads/{token}). */
  download_token: string | null;
  refunded_at: string | null;
  gelato_status: string | null;
  pdf_ready: boolean;
  /** Offer this order was bought with (pdf_upgrade / extra_copy_repeat), null = normal price. */
  offer?: string | null;
  /** Post-purchase offer this order makes its story eligible for (decided by /api/dashboard). */
  upsell?: StoryUpsell | null;
  /** The order's personal referral code ("10 € y 10 €"), null when none / not live. */
  referral_code?: string | null;
  stories: {
    title: string | null;
    status: string;
    generated_text: { bookTitle?: string } | null;
    characters: { name: string } | null;
  } | null;
}

const STEP_ICONS: Record<(typeof PRINT_STEPS)[number], string> = {
  paid: "receipt_long",
  producing: "print",
  shipped: "local_shipping",
  delivered: "inventory_2",
};

type T = ReturnType<typeof useTranslations<"dashboard">>;

// ── Tab ─────────────────────────────────────────────────────────────────────

export interface ReorderTarget {
  storyId: string;
  title: string;
}

export function OrdersTab({ orders, empty }: { orders: DashboardOrder[]; empty: React.ReactNode }) {
  const [reorder, setReorder] = useState<ReorderTarget | null>(null);
  if (orders.length === 0) return <>{empty}</>;
  // Every "otra copia" of a story shows the offer its eligible order carries
  // (/api/checkout applies it to any printed copy of that story).
  const offers = new Map(orders.filter((o) => o.upsell && o.story_id).map((o) => [o.story_id!, o.upsell!]));
  return (
    <>
      <ul className="space-y-4" data-testid="orders-list">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} onReorder={setReorder} />
          </li>
        ))}
      </ul>
      <ReorderSheet
        storyId={reorder?.storyId ?? null}
        title={reorder?.title ?? ""}
        offer={reorder ? (offers.get(reorder.storyId) ?? null) : null}
        onClose={() => setReorder(null)}
      />
    </>
  );
}

// ── Post-purchase offer ─────────────────────────────────────────────────────

/**
 * "¿Lo quieres en papel?" (PDF order) / "¿Una para los abuelos?" (printed order,
 * 60 days). Prices come from the same catalog the checkout charges.
 */
export function OfferCallout({
  offer,
  onOpen,
  className,
}: {
  offer: StoryUpsell;
  onOpen: () => void;
  className?: string;
}) {
  const t = useTranslations("dashboard.offer");
  const locale = useLocale();
  const upgrade = offer.offer === "pdf_upgrade";
  const format: PhysicalFormat = !upgrade && offer.sourceFormat === "softcover" ? "softcover" : "hardcover";
  const price = formatPrice(offerPrice(offer.offer, format), locale);
  const until = offer.expiresAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(offer.expiresAt))
    : "";

  return (
    <div
      className={cx("flex flex-col gap-3 rounded-2xl border-2 border-brand/25 bg-brand-tint px-4 py-3.5 sm:flex-row sm:items-center", className)}
      data-testid="order-offer"
      data-offer={offer.offer}
    >
      <span aria-hidden className="hidden sm:block">
        <span className="material-symbols-outlined !text-[26px] text-brand-text">{upgrade ? "menu_book" : "family_restroom"}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold leading-tight text-ink">
          {upgrade ? t("upgradeTitle") : t("extraTitle")}
        </p>
        <p className="mt-1 text-[13px] leading-snug text-ink-body">
          {upgrade
            ? t("upgradeLine", { price, pdf: formatPrice(STRIPE_CATALOG.digital_pdf.amount, locale) })
            : t("extraLine", { price, date: until })}
        </p>
      </div>
      <Button size="sm" onClick={onOpen} className="w-full shrink-0 sm:w-auto" data-testid="order-offer-cta">
        {upgrade ? t("upgradeCta") : t("extraCta")}
      </Button>
    </div>
  );
}

// ── Referral ("10 € y 10 €") ────────────────────────────────────────────────

/** The buyer's referral code: share link → /<locale>/r/<code> (pre-applied at the friend's checkout). */
export function ReferralCallout({ code, className }: { code: string; className?: string }) {
  const t = useTranslations("dashboard.referral");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const amount = new Intl.NumberFormat(locale === "en" ? "en-IE" : locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(REFERRAL_DISCOUNT_CENTS / 100);

  async function copy() {
    const url = `${window.location.origin}/${locale}${REFERRAL_ROUTE}/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t("copy"), url);
    }
  }

  return (
    <div className={cx("flex flex-col gap-3 rounded-2xl border-2 border-line bg-paper px-4 py-3.5 sm:flex-row sm:items-center", className)} data-testid="order-referral">
      <span aria-hidden className="hidden sm:block">
        <span className="material-symbols-outlined !text-[26px] text-brand-text">redeem</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold leading-tight text-ink">{t("title", { amount })}</p>
        <p className="mt-1 text-[13px] leading-snug text-ink-body">{t("line", { amount })}</p>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          {t("codeLabel")}: <span className="select-all font-mono font-bold tracking-wider text-ink">{code}</span>
        </p>
      </div>
      <Button size="sm" variant="secondary" leadingIcon={copied ? "check" : "content_copy"} onClick={copy} className="w-full shrink-0 sm:w-auto" data-testid="order-referral-copy">
        <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
      </Button>
    </div>
  );
}

// ── One order ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onReorder,
}: {
  order: DashboardOrder;
  onReorder: (target: ReorderTarget) => void;
}) {
  const t = useTranslations("dashboard");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const detailId = useId();

  const view = orderView(order);
  const ref = orderReference(order.id);
  const title = order.stories?.title ?? order.stories?.generated_text?.bookTitle ?? t("untitledStory");
  const childName = order.stories?.characters?.name ?? "";
  const formatLabel = order.format === "digital_pdf" ? t("orders.digitalLabel") : t(`orderFormat.${order.format === "hardcover" ? "hardcover" : "softcover"}`);
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const downloadHref = view.canDownload && order.download_token ? `/api/downloads/${order.download_token}` : null;
  const contactHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("orders.contactSubject", { ref }))}`;
  const storyId = order.story_id;
  // The offer replaces the plain "otra copia" button once the book can be printed again.
  const showOffer = !!order.upsell && view.canReorder && !view.refunded;

  return (
    <article
      className="overflow-hidden rounded-2xl border-2 border-line bg-surface"
      data-testid="order-card"
      data-phase={view.phase}
    >
      {/* Header: book, format, date · price */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-semibold leading-tight text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted">
            {childName && `${childName} · `}
            {formatLabel} · {date(order.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-display text-base font-semibold tabular-nums text-brand-deep">
            {formatPrice(Math.round(order.total * 100), locale)}
          </span>
          <span className="text-[11px] text-ink-muted">{tPricing("vatIncluded")}</span>
        </div>
      </div>

      <OrderStatus order={order} view={view} t={t} date={date} />

      {showOffer && order.upsell && storyId && (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <OfferCallout offer={order.upsell} onOpen={() => onReorder({ storyId, title })} />
        </div>
      )}

      {order.referral_code && !view.refunded && view.phase !== "cancelled" && (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <ReferralCallout code={order.referral_code} />
        </div>
      )}

      {/* Tracking (print, once the carrier has a code) */}
      {order.tracking_number && view.kind === "print" && order.status !== "refunded" && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 sm:px-5">
          <span aria-hidden className="material-symbols-outlined !text-xl text-ink-muted">package_2</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{t("trackingNumber")}</p>
            <p className="break-all font-mono text-sm text-ink">{order.tracking_number}</p>
          </div>
          {order.tracking_url && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "secondary", size: "sm", className: "w-full sm:w-auto" })}
            >
              <span aria-hidden className="material-symbols-outlined !text-lg">local_shipping</span>
              {t("orders.trackShipment")}
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        {downloadHref && (
          <a href={downloadHref} className={buttonClass({ variant: "secondary", size: "sm" })} data-testid="order-download">
            <span aria-hidden className="material-symbols-outlined !text-lg">download</span>
            {t("orders.downloadPdf")}
          </a>
        )}
        {view.canReorder && !showOffer && storyId && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReorder({ storyId, title })}
            data-testid="order-reorder"
          >
            <span aria-hidden className="material-symbols-outlined !text-lg">library_add</span>
            {order.status === "refunded"
              ? t("orders.reorderAgain")
              : view.kind === "digital"
                ? t("orders.reorderPrinted")
                : t("orders.reorder")}
          </Button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={detailId}
          className={cx(buttonClass({ variant: "quiet", size: "sm" }), "ml-auto")}
        >
          {open ? t("orders.hideDetail") : t("orders.showDetail")}
          <span aria-hidden className="material-symbols-outlined !text-lg">
            {open ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {open && (
        <OrderDetail
          id={detailId}
          order={order}
          reference={ref}
          formatLabel={formatLabel}
          date={date(order.created_at)}
          contactHref={contactHref}
          t={t}
        />
      )}
    </article>
  );
}

function OrderStatus({
  order,
  view,
  t,
  date,
}: {
  order: DashboardOrder;
  view: OrderView;
  t: T;
  date: (iso: string) => string;
}) {
  const name = order.shipping_name?.trim() ?? "";

  if (view.phase === "refunded" || view.phase === "cancelled") {
    return (
      <StatusRow icon="undo" tone="muted">
        <span>{view.phase === "refunded" ? t("orders.message.refunded") : t("orders.message.cancelled")}</span>
        {order.refunded_at && <span className="block text-xs font-normal text-ink-muted">{t("orders.refundedOn", { date: date(order.refunded_at) })}</span>}
      </StatusRow>
    );
  }

  if (view.kind === "digital") {
    const ready = view.phase === "digital_ready";
    return (
      <StatusRow icon={ready ? "download_done" : "brush"} tone={ready ? "success" : "brand"}>
        <span>{ready ? t("orders.message.digitalReady") : t("orders.message.digitalPreparing")}</span>
        {view.refunded && order.refunded_at && (
          <span className="block text-xs font-normal text-ink-muted">{t("orders.refundedOn", { date: date(order.refunded_at) })}</span>
        )}
      </StatusRow>
    );
  }

  const step = view.stepIndex ?? 0;
  const message =
    view.phase === "print_problem"
      ? t("orders.message.problem")
      : view.phase === "print_shipped"
        ? name ? t("orders.message.shippedTo", { name }) : t("orders.message.shipped")
        : view.phase === "print_delivered"
          ? name ? t("orders.message.deliveredTo", { name }) : t("orders.message.delivered")
          : view.phase === "print_producing"
            ? t("orders.message.producing")
            : t("orders.message.paid");

  return (
    <div className="border-t border-line bg-paper/60 px-4 py-4 sm:px-5">
      <p
        className={cx(
          "flex items-start gap-2 text-sm font-semibold",
          view.phase === "print_problem" ? "text-red-700" : view.phase === "print_delivered" ? "text-success" : "text-ink",
        )}
      >
        <span aria-hidden className="material-symbols-outlined !text-xl">
          {view.phase === "print_problem" ? "support_agent" : STEP_ICONS[PRINT_STEPS[step]]}
        </span>
        <span>
          {message}
          {view.refunded && order.refunded_at && (
            <span className="block text-xs font-normal text-ink-muted">{t("orders.refundedOn", { date: date(order.refunded_at) })}</span>
          )}
        </span>
      </p>

      {/* Stepper: paid → producing → shipped → delivered */}
      <ol className="mt-4 flex items-start" aria-label={t("orders.detailTitle")}>
        {PRINT_STEPS.map((s, i) => {
          const done = i < step || (i === step && s === "delivered");
          const active = i === step && !done;
          return (
            <li key={s} className={cx("flex items-start", i < PRINT_STEPS.length - 1 && "flex-1")} aria-current={active ? "step" : undefined}>
              <div className="flex w-16 flex-col items-center text-center sm:w-20">
                <span
                  className={cx(
                    "flex h-6 w-6 items-center justify-center rounded-full",
                    done && "bg-brand text-white",
                    active && "bg-brand text-white ring-4 ring-brand/15",
                    !done && !active && "border-2 border-line bg-surface text-ink-muted",
                  )}
                >
                  <span aria-hidden className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {done ? "check" : STEP_ICONS[s]}
                  </span>
                </span>
                <span
                  className={cx(
                    "mt-1.5 text-[11px] leading-tight",
                    active ? "font-bold text-brand-text" : done ? "font-medium text-ink-soft" : "text-ink-muted",
                  )}
                >
                  {t(`orderStatus.${s}`)}
                </span>
              </div>
              {i < PRINT_STEPS.length - 1 && (
                <span aria-hidden className={cx("mt-3 h-0.5 flex-1 rounded-full", i < step ? "bg-brand" : "bg-line")} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatusRow({ icon, tone, children }: { icon: string; tone: "success" | "brand" | "muted"; children: React.ReactNode }) {
  return (
    <div className="border-t border-line bg-paper/60 px-4 py-3.5 sm:px-5">
      <p
        className={cx(
          "flex items-start gap-2 text-sm font-semibold",
          tone === "success" ? "text-success" : tone === "brand" ? "text-ink" : "text-ink-soft",
        )}
      >
        <span aria-hidden className={cx("material-symbols-outlined !text-xl", tone === "brand" && "text-brand-text")}>
          {icon}
        </span>
        <span>{children}</span>
      </p>
    </div>
  );
}

function OrderDetail({
  id,
  order,
  reference,
  formatLabel,
  date,
  contactHref,
  t,
}: {
  id: string;
  order: DashboardOrder;
  reference: string;
  formatLabel: string;
  date: string;
  contactHref: string;
  t: T;
}) {
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const addons = Array.isArray(order.addons) ? (order.addons as string[]) : [];
  const a = order.shipping_address;
  const address = a
    ? [order.shipping_name ?? "", a.line1 ?? "", a.line2 ?? "", `${a.postal_code ?? ""} ${a.city ?? ""}`.trim()].filter((l) => l.trim())
    : [];

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right text-ink-soft">{value}</dd>
    </div>
  );

  return (
    <section id={id} className="border-t border-line px-4 py-4 sm:px-5" aria-label={t("orders.detailTitle")}>
      <dl className="text-sm">
        {row(t("orders.referenceLabel"), <span className="font-mono font-semibold text-ink">{reference}</span>)}
        {row(t("orders.date"), date)}
        {row(t("orders.format"), formatLabel)}
        {addons.includes("extra_copy") && row(t("orders.extras"), t("orders.extraCopy"))}
        {order.offer === "pdf_upgrade" && row(t("orders.offerLabel"), t("orders.offerUpgrade"))}
        {order.offer === "extra_copy_repeat" && row(t("orders.offerLabel"), t("orders.offerExtraCopy"))}
        {row(
          t("orders.total"),
          <span>
            <span className="font-semibold tabular-nums text-ink">{formatPrice(Math.round(order.total * 100), locale)}</span>{" "}
            <span className="text-xs text-ink-muted">· {tPricing("vatIncluded")}</span>
          </span>,
        )}
      </dl>

      {address.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="text-ink-muted">{t("orders.shipTo")}</p>
          <address className="mt-1 not-italic leading-relaxed text-ink-soft">
            {address.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </address>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {order.invoice_url && (
          <a
            href={order.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-ink-soft underline decoration-ink-muted/40 underline-offset-2 hover:text-brand-text"
          >
            <span aria-hidden className="material-symbols-outlined !text-lg">receipt_long</span>
            {t("orders.invoice")}
          </a>
        )}
        <a
          href={contactHref}
          className="inline-flex items-center gap-1.5 font-semibold text-ink-soft underline decoration-ink-muted/40 underline-offset-2 hover:text-brand-text"
        >
          <span aria-hidden className="material-symbols-outlined !text-lg">mail</span>
          {t("orders.contact")}
        </a>
      </div>
    </section>
  );
}

// ── Another copy ────────────────────────────────────────────────────────────

const REORDER_FORMATS: PhysicalFormat[] = ["hardcover", "softcover"];

function offerFormat(offer: StoryUpsell | null | undefined): PhysicalFormat {
  return offer?.offer === "extra_copy_repeat" && offer.sourceFormat === "softcover" ? "softcover" : "hardcover";
}

/**
 * "Comprar otra copia": a printed copy of a finished book (standard Checkout; the
 * address is chosen there). Opened from an order, its offer card or the library.
 * With a post-purchase offer the sheet shows the offer prices; /api/checkout
 * decides the price again from the buyer's orders (the client never sends it).
 */
export function ReorderSheet({
  storyId,
  title,
  offer = null,
  onClose,
}: {
  storyId: string | null;
  title: string;
  offer?: StoryUpsell | null;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const tPricing = useTranslations("pricing");
  const locale = useLocale();
  const [format, setFormat] = useState<PhysicalFormat>("hardcover");
  // Preselect on every open (extra copy: the format of the book they bought).
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (storyId !== openedFor) {
    setOpenedFor(storyId);
    if (storyId) setFormat(offerFormat(offer));
  }
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupId = useId();

  function close() {
    if (busy) return;
    setConsent(false);
    setConsentMissing(false);
    setMarketingOptOut(false);
    setError(null);
    onClose();
  }

  async function pay() {
    if (!storyId) return;
    if (!consent) {
      setConsentMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, format, addons: [], locale, withdrawalConsent: true, marketingOptOut }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error(`checkout_${res.status}`);
      window.location.href = data.url;
    } catch (err) {
      console.warn("[dashboard] Reorder checkout failed:", err);
      setError(t("reorder.error"));
      setBusy(false);
    }
  }

  const priceOf = (f: PhysicalFormat) => (offer ? offerPrice(offer.offer, f) : PRICING[f].price);
  const price = formatPrice(priceOf(format), locale);
  const upgrade = offer?.offer === "pdf_upgrade";
  const until = offer?.expiresAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(offer.expiresAt))
    : "";

  return (
    <Sheet
      open={!!storyId}
      title={upgrade ? t("reorder.titleUpgrade", { title }) : t("reorder.title", { title })}
      onClose={close}
      closeLabel={t("reorder.close")}
      footer={
        <>
          <Button size="lg" block onClick={() => void pay()} loading={busy} data-testid="reorder-pay">
            {t("reorder.pay", { price })}
          </Button>
          {error && (
            <p className="mt-2 text-center text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-body">{upgrade ? t("reorder.introUpgrade") : t("reorder.intro")}</p>
      {offer && (
        <p
          className="mt-3 flex items-start gap-2 rounded-xl bg-brand-tint px-3 py-2.5 text-[13px] font-semibold leading-snug text-brand-text"
          data-testid="reorder-offer-note"
        >
          <span aria-hidden className="material-symbols-outlined !text-lg">sell</span>
          <span>
            {upgrade
              ? t("reorder.offerUpgradeNote", { pdf: formatPrice(STRIPE_CATALOG.digital_pdf.amount, locale) })
              : t("reorder.offerExtraNote", { date: until })}
          </span>
        </p>
      )}

      <p id={groupId} className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {t("reorder.formatLabel")}
      </p>
      <div role="radiogroup" aria-labelledby={groupId} className="mt-2 grid gap-2">
        {REORDER_FORMATS.map((f) => {
          const selected = f === format;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFormat(f)}
              className={cx(
                "flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                selected ? "border-brand bg-brand/[0.04]" : "border-line bg-surface hover:border-brand/40",
              )}
            >
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold text-ink">{tPricing(`${f}.label`)}</span>
                <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{tPricing(`${f}.description`)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-base font-semibold tabular-nums text-brand-deep">
                  {formatPrice(priceOf(f), locale)}
                </span>
                {offer && (
                  <span className="block text-[11px] tabular-nums text-ink-muted">
                    {t.rich("reorder.normalPrice", { price: formatPrice(PRICING[f].price, locale), s: (chunks) => <s>{chunks}</s> })}
                  </span>
                )}
                <span className="block text-[11px] text-ink-muted">{tPricing("vatIncluded")}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Consent (art. 103 m LGDCU): never pre-ticked */}
      <label
        className={cx(
          "mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-snug text-ink-soft",
          consentMissing && !consent ? "bg-red-50 ring-1 ring-red-300" : "bg-line/60",
        )}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (e.target.checked) setConsentMissing(false);
          }}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
        />
        <span>{t("reorder.consent")}</span>
      </label>
      {consentMissing && !consent && (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {tPricing("withdrawal.required")}
        </p>
      )}
      <MarketingOptOut checked={marketingOptOut} onChange={setMarketingOptOut} className="mt-2.5" />
    </Sheet>
  );
}
