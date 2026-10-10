import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BrandLogo from "@/components/BrandLogo";
import PrintButton from "@/components/gift-voucher/PrintButton";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { verifyVoucherCardToken } from "@/lib/growth/voucher-card-token";
import { printQuotes } from "@/lib/book/print-text";

export const dynamic = "force-dynamic";


type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "giftVoucher.card" });
  return { title: { absolute: t("metaTitle") }, robots: { index: false, follow: false } };
}

/**
 * Printable gift voucher (A4/A5 friendly, one card), linked from the voucher email and the
 * thanks page by a signed token (src/lib/growth/voucher-card-token.ts). A refunded voucher
 * is not shown.
 */
export default async function Page({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "giftVoucher.card" });

  const id = verifyVoucherCardToken(token);
  const { data: voucher } = id
    ? await createFulfilmentClient()
        .from("gift_vouchers")
        .select("code, format, recipient_name, message, refunded_at")
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  if (!voucher || voucher.refunded_at) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-4">
        <p className="max-w-md text-center text-base leading-relaxed text-ink-body">{t("notFound")}</p>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-paper px-4 py-10 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-xl justify-end print:hidden">
        <PrintButton label={t("print")} />
      </div>
      <article
        className="mx-auto max-w-xl rounded-3xl border-2 border-line bg-surface px-6 py-10 text-center sm:px-12 print:border-brand/40"
        data-testid="voucher-card"
      >
        <BrandLogo className="mx-auto h-8 text-brand-deep" />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.14em] text-brand-text">{t("kicker")}</p>
        <h1 className="mt-2 text-balance font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{t("title")}</h1>
        {voucher.recipient_name && (
          <p className="mt-3 font-display text-xl font-semibold text-brand-deep">{t("forName", { name: voucher.recipient_name })}</p>
        )}
        <p className="mt-3 text-base text-ink-body">{t(`product.${voucher.format}`)}</p>
        {voucher.message && (
          <blockquote className="mx-auto mt-6 max-w-md whitespace-pre-line font-display text-lg italic leading-relaxed text-ink-soft">
            {`${printQuotes(locale)[0]}${voucher.message}${printQuotes(locale)[1]}`}
          </blockquote>
        )}
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border-2 border-dashed border-brand px-4 py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-text">{t("codeLabel")}</p>
          <p className="mt-1 break-all font-mono text-[26px] font-bold tracking-[0.12em] text-ink">{voucher.code}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("validUntil")}</p>
        </div>
        <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-ink-body">{t("howTo")}</p>
        <p className="mt-6 text-sm font-semibold text-ink-soft">meapica.shop</p>
      </article>
    </main>
  );
}
