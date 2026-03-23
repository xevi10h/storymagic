import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import BrandLogo from "@/components/BrandLogo";
import NewsletterForm from "@/components/landing/NewsletterForm";

export default function Footer() {
  const t = useTranslations("footer");

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
