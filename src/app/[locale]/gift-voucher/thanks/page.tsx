import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { buttonClass, cx } from "@/components/ui";
import { PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { recordGiftVoucherPurchase, voucherCardUrl } from "@/lib/growth/gift-vouchers";
import type { GiftVoucherRow } from "@/lib/fulfilment/db";

export const dynamic = "force-dynamic";

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;
/** The code is shown here only right after the purchase (the URL ends up in the browser history). */
const SHOW_CODE_FOR_MS = 24 * 3600_000;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "giftVoucher.thanks" });
  return { title: { absolute: t("metaTitle") }, robots: { index: false, follow: false } };
}

/**
 * After the voucher payment: records it the same way the webhook does (idempotent, so
 * whichever runs first creates the row, the code and the email) and shows the code.
 */
async function loadVoucher(sessionId: string | null): Promise<GiftVoucherRow | null> {
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) return null;
  try {
    const result = await recordGiftVoucherPurchase(createFulfilmentClient(), sessionId);
    if (result.state !== "ready" || !result.voucher.stripe_promotion_code_id) return null;
    return Date.now() - Date.parse(result.voucher.created_at) < SHOW_CODE_FOR_MS ? result.voucher : null;
  } catch (err) {
    console.error("[gift-voucher] Thanks page could not record the voucher:", err instanceof Error ? err.message : err);
    return null;
  }
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "giftVoucher.thanks" });
  const raw = (await searchParams).session_id;
  const voucher = await loadVoucher(typeof raw === "string" ? raw : null);

  return (
    <>
      <Navbar />
      <main>
        <PageHero>
          <div className="mx-auto mt-6 max-w-xl text-center lg:mt-12" data-testid="gift-voucher-thanks">
            {voucher ? (
              <>
                <p className={kicker}>{t("codeLabel")}</p>
                <h1 className={cx("mt-2", marketingH1)}>{t("h1")}</h1>
                <p className={cx("mt-4", marketingLead)}>{t("intro")}</p>
                <div className="mt-8 rounded-2xl border-2 border-dashed border-brand bg-surface px-5 py-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-text">{t("codeLabel")}</p>
                  <p className="mt-2 select-all break-all font-mono text-[28px] font-bold tracking-[0.12em] text-ink" data-testid="voucher-code">
                    {voucher.code}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{t("validUntil")}</p>
                </div>
                <a href={voucherCardUrl(voucher)} className={buttonClass({ className: "mt-6" })}>
                  <span aria-hidden className="material-symbols-outlined text-xl">print</span>
                  {t("printCta")}
                </a>
              </>
            ) : (
              <>
                <span aria-hidden className="material-symbols-outlined !text-4xl text-brand-text">mail</span>
                <h1 className={cx("mt-2", marketingH1)}>{t("pendingTitle")}</h1>
                <p className={cx("mt-4", marketingLead)}>{t("pendingText")}</p>
                <Link href="/" className={buttonClass({ variant: "secondary", className: "mt-6" })}>
                  {t("backHome")}
                </Link>
              </>
            )}
          </div>
        </PageHero>
      </main>
      <Footer />
    </>
  );
}
