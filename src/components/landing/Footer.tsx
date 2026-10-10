import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/BrandLogo";
import NewsletterForm from "@/components/landing/NewsletterForm";
import { cx } from "@/components/ui";
import { SEO_HUB_HEADING_KEY, SEO_SLUGS, seoHubPath, seoPath, type SeoPageType } from "@/lib/seo-landing";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import { GIFT_VOUCHER_PATH } from "@/lib/promo-codes";
import { isToolLocale, toolPath } from "@/lib/tools/registry";
import { GUIDES, GUIDES_HEADING, GUIDE_LINK_LABELS, guidesForLocale } from "@/lib/guides";
import { SUPPORT_EMAIL } from "@/lib/pricing";
import { CookieSettingsButton } from "@/components/tracking/Tracking";

// Every link is a ≥ 44 px tap target (brand.md › Mobile rules).
const linkClass = cx(
  "inline-flex min-h-11 min-w-11 items-center rounded-lg text-white/80 transition-colors hover:text-white hover:underline hover:decoration-white/40 hover:underline-offset-4",
  // White ring: the brand-orange focus ring is too faint on brand-deep.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
);

const SEO_LINK_TYPES: SeoPageType[] = ["gifts", "ages", "themes"];

function FooterColumn({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 font-display text-base font-semibold text-white">{title}</h2>
      <ul className="flex flex-col text-sm">{children}</ul>
    </div>
  );
}

/**
 * Site footer (landing, blog, SEO pages, Reyes page). Rendered as <footer> so the
 * mobile sticky CTA can observe it and hide; below lg the bottom padding clears
 * that bar (+ the iOS home indicator) so the legal links are always reachable.
 */
export default function Footer() {
  const t = useTranslations("footer");
  const ts = useTranslations("seo");
  const tsc = useTranslations("showcase");
  const tcd = useTranslations("christmasDelivery");
  const tgv = useTranslations("giftVoucher");
  const locale = useLocale();
  // Free Reyes printables exist in es + ca only (src/lib/tools/registry.ts).
  const tRoot = useTranslations();
  const toolsLabel = isToolLocale(locale) ? tRoot("tools.common.footerLink") : null;

  return (
    <footer className="bg-brand-deep pt-14 pb-[calc(7rem+env(safe-area-inset-bottom))] text-white/80 sm:pt-20 lg:pb-10">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.3fr_1fr_1fr_1.4fr] lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <BrandLogo className="h-7 text-white" />
            <p className="mt-4 max-w-xs whitespace-pre-line text-sm leading-relaxed text-white/75">{t("tagline")}</p>
          </div>

          <FooterColumn title={t("workshop")}>
            <li>
              <Link className={linkClass} href="/#artisanal">
                {t("ourPapers")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/examples">
                {tsc("title")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/legal#shipping">
                {t("shippingPackaging")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href={CHRISTMAS_DELIVERY_PATH}>
                {tcd("footerLink")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href={GIFT_VOUCHER_PATH}>
                {tgv("footerLink")}
              </Link>
            </li>
            {toolsLabel && (
              <li>
                <Link className={linkClass} href={toolPath("letter")}>
                  {toolsLabel}
                </Link>
              </li>
            )}
          </FooterColumn>

          <FooterColumn title={t("support")}>
            <li>
              <Link className={linkClass} href="/#faq">
                {t("faq")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/dashboard">
                {t("trackOrder")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/blog">
                Blog
              </Link>
            </li>
            <li>
              <a className={cx(linkClass, "break-all")} href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </li>
          </FooterColumn>

          {/* Reading club */}
          <div className="col-span-2 lg:col-span-1">
            <h2 className="font-display text-base font-semibold text-white">{t("readingClub")}</h2>
            <p className="mt-2 mb-4 text-sm leading-relaxed text-white/75">{t("readingClubDescription")}</p>
            <NewsletterForm />
          </div>
        </div>

        {/* SEO landing links: every hub and every landing (occasions, ages, themes)
            is one click from every marketing page, home included. */}
        <div className="mt-12 grid gap-8 border-t border-white/15 pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {SEO_LINK_TYPES.map((type) => (
            <div key={type}>
              <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white">
                <Link className={linkClass} href={seoHubPath(type)}>
                  {ts(SEO_HUB_HEADING_KEY[type])}
                </Link>
              </h2>
              <ul className="flex flex-wrap gap-x-5 text-sm">
                {SEO_SLUGS[type].map((slug) => (
                  <li key={slug}>
                    <Link className={linkClass} href={seoPath(type, slug)}>
                      {ts(`nav.${type}.${slug}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {/* Guides (Catalan, likeness, comparison): only the ones that exist in this locale. */}
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-white">{GUIDES_HEADING[locale] ?? GUIDES_HEADING.es}</h2>
            <ul className="flex flex-wrap gap-x-5 text-sm">
              {guidesForLocale(locale).map((id) => (
                <li key={id}>
                  <Link className={linkClass} href={GUIDES[id].path}>
                    {GUIDE_LINK_LABELS[id][locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/15 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-white/75">{t("copyright")}</p>
          <ul className="flex flex-wrap gap-x-6">
            <li>
              <Link className={linkClass} href="/legal#terms">
                {t("legalNotice")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/legal#privacy">
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link className={linkClass} href="/legal#cookies">
                {t("cookies")}
              </Link>
            </li>
            <CookieSettingsButton className={linkClass} label={t("cookieSettings")} />
          </ul>
        </div>
      </div>
    </footer>
  );
}
