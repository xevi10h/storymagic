"use client";

import { useId, useState } from "react";
import { Button, cx } from "@/components/ui";
import { VOUCHER_MESSAGE_MAX, VOUCHER_RECIPIENT_MAX, type VoucherFormat } from "@/lib/promo-codes";

export interface VoucherFormatOption {
  id: VoucherFormat;
  label: string;
  note: string;
  /** Formatted, VAT-inclusive price ("49,90 €"). */
  price: string;
  /** Shipping included (printed formats). */
  shipping: boolean;
}

/** All copy comes from the server page (giftVoucher messages stay out of the client bundle). */
export interface GiftVoucherFormCopy {
  legend: string;
  vatIncluded: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  /** "{count} de {max}" */
  messageCount: string;
  /** "Comprar tarjeta regalo · {price}" */
  buy: string;
  secure: string;
  terms: string;
  termsLink: string;
  error: string;
}

/**
 * Format radios (same pattern as the paywall's), recipient name + short message printed on
 * the voucher, and the pay button → POST /api/gift-voucher/checkout → Stripe Checkout.
 */
export default function GiftVoucherForm({
  locale,
  options,
  copy,
}: {
  locale: string;
  options: VoucherFormatOption[];
  copy: GiftVoucherFormCopy;
}) {
  const [format, setFormat] = useState<VoucherFormat>(options[0]?.id ?? "hardcover");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const recipientId = useId();
  const messageId = useId();
  const counterId = useId();
  const selected = options.find((o) => o.id === format) ?? options[0];
  const messageLength = Array.from(message).length;

  async function pay() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/gift-voucher/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, locale, recipientName, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout_failed");
      window.location.assign(data.url);
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
      className="flex flex-col gap-5"
      data-testid="gift-voucher-form"
    >
      <fieldset>
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">{copy.legend}</legend>
        <div className="space-y-2">
          {options.map((o) => {
            const active = o.id === format;
            return (
              <label
                key={o.id}
                data-testid={`voucher-format-${o.id}`}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border-2 px-3.5 py-3 transition-colors",
                  active ? "border-brand bg-brand/[0.04]" : "border-line bg-surface hover:border-brand/40",
                )}
              >
                <input
                  type="radio"
                  name="voucher-format"
                  value={o.id}
                  checked={active}
                  onChange={() => setFormat(o.id)}
                  className="mt-1 h-[18px] w-[18px] shrink-0 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base font-bold text-ink">{o.label}</span>
                    <span className="whitespace-nowrap text-base font-bold tabular-nums text-brand-deep">{o.price}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-3 text-xs leading-snug">
                    <span className="min-w-0 text-ink-soft">{o.note}</span>
                    <span className="shrink-0 text-ink-muted">{copy.vatIncluded}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={recipientId} className="mb-1.5 block text-sm font-semibold text-ink">
          {copy.recipientLabel}
        </label>
        <input
          id={recipientId}
          type="text"
          value={recipientName}
          maxLength={VOUCHER_RECIPIENT_MAX}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder={copy.recipientPlaceholder}
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          data-testid="voucher-recipient"
        />
      </div>

      <div>
        <label htmlFor={messageId} className="mb-1.5 block text-sm font-semibold text-ink">
          {copy.messageLabel}
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(Array.from(e.target.value).slice(0, VOUCHER_MESSAGE_MAX).join(""))}
          placeholder={copy.messagePlaceholder}
          rows={3}
          aria-describedby={counterId}
          className="w-full resize-none rounded-xl border-2 border-line bg-surface px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          data-testid="voucher-message"
        />
        <p id={counterId} className="mt-1 text-right text-xs tabular-nums text-ink-muted">
          {copy.messageCount.replace("{count}", String(messageLength)).replace("{max}", String(VOUCHER_MESSAGE_MAX))}
        </p>
      </div>

      <div>
        <Button type="submit" size="lg" block loading={loading} trailingIcon="arrow_forward" data-testid="voucher-buy">
          {copy.buy.replace("{price}", selected?.price ?? "")}
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-error">
            {copy.error}
          </p>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-ink-soft">
          <span aria-hidden className="material-symbols-outlined mt-px !text-[15px] text-ink-muted">
            lock
          </span>
          {copy.secure}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-ink-soft">
          {copy.terms}{" "}
          <a href={`/${locale}/legal#terms`} className="font-semibold underline decoration-brand/30 underline-offset-2 hover:text-brand-text">
            {copy.termsLink}
          </a>
        </p>
      </div>
    </form>
  );
}
