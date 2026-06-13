import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/BrandLogo";
import NewsletterForm from "@/components/landing/NewsletterForm";
import { SEO_GIFT_SLUGS, SEO_AGE_SLUGS, seoPath } from "@/lib/seo-landing";

export default function Footer() {
  const t = useTranslations("footer");
  const ts = useTranslations("seo");
  const tsc = useTranslations("showcase");

  return (
    <footer className="mt-12 border-t-8 border-footer-accent bg-footer-bg pt-20 pb-10 text-footer-text">
      <div className="mx-auto max-w-6xl px-8">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="mb-6">
              <BrandLogo className="h-6 text-white" />
            </div>
            <p className="mb-6 text-sm leading-relaxed text-footer-muted whitespace-pre-line">
              {t("tagline")}
            </p>
          </div>

          {/* Taller */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">{t("workshop")}</h4>
            <ul className="space-y-3 text-sm text-footer-muted">
              <li>
                <Link className="transition-colors hover:text-primary" href="/#artisanal">
                  {t("ourPapers")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/#artisanal">
                  {t("artisanalProcess")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/legal#shipping">
                  {t("shippingPackaging")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Atención */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">{t("support")}</h4>
            <ul className="space-y-3 text-sm text-footer-muted">
              <li>
                <Link className="transition-colors hover:text-primary" href="/ejemplo">
                  {tsc("title")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/blog">
                  Blog
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/legal#faq">
                  {t("faq")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/dashboard">
                  {t("trackOrder")}
                </Link>
              </li>
              <li>
                <Link className="transition-colors hover:text-primary" href="/#artisanal">
                  {t("qualityGuarantee")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Club de Lectura */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">{t("readingClub")}</h4>
            <p className="mb-4 text-sm text-footer-muted">
              {t("readingClubDescription")}
            </p>
            <NewsletterForm />
          </div>
        </div>

        {/* SEO landing links — internal linking for gift occasions & age ranges */}
        <div className="mb-12 grid grid-cols-1 gap-8 border-t border-footer-border pt-12 sm:grid-cols-2">
          <div>
            <h4 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-white">
              <Link className="transition-colors hover:text-primary" href="/gifts">
                {ts("nav.giftHeading")}
              </Link>
            </h4>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-footer-muted">
              {SEO_GIFT_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link
                    className="transition-colors hover:text-primary"
                    href={seoPath("gifts", slug)}
                  >
                    {ts(`nav.gifts.${slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-5 font-display text-sm font-bold uppercase tracking-wider text-white">
              <Link className="transition-colors hover:text-primary" href="/personalized-books">
                {ts("nav.ageHeading")}
              </Link>
            </h4>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-footer-muted">
              {SEO_AGE_SLUGS.map((slug) => (
                <li key={slug}>
                  <Link
                    className="transition-colors hover:text-primary"
                    href={seoPath("ages", slug)}
                  >
                    {ts(`nav.ages.${slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-footer-border pt-8 text-xs text-footer-border md:flex-row">
          <p>{t("copyright")}</p>
          <div className="flex gap-6">
            <Link className="transition-colors hover:text-white" href="/legal#terms">
              {t("legalNotice")}
            </Link>
            <Link className="transition-colors hover:text-white" href="/legal#privacy">
              {t("privacy")}
            </Link>
            <Link className="transition-colors hover:text-white" href="/legal#cookies">
              {t("cookies")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
