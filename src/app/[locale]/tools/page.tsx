import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import { BookBand, FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { cx, focusRing } from "@/components/ui";
import { SITE_URL } from "@/lib/product-facts";
import { CHRISTMAS_DELIVERY_PATH } from "@/lib/shipping";
import { toolMetadata } from "@/lib/tools/metadata";
import { REYES_BLOG_PATH, TOOL_IDS, TOOL_LOCALES, TOOLS_HUB_PATH, isToolLocale, toolPath } from "@/lib/tools/registry";

// The book band quotes this season's Reyes cut-off: refresh daily.
export const revalidate = 86400;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return TOOL_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return toolMetadata(locale, "tools.hub", TOOLS_HUB_PATH);
}

const ICON: Record<(typeof TOOL_IDS)[number], string> = { letter: "draw", reply: "mail" };

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isToolLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "tools.hub" });
  const tc = await getTranslations({ locale, namespace: "tools.common" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tcd = await getTranslations({ locale, namespace: "christmasDelivery" });
  const faqs = (t.raw("faq") as { q: string; a: string }[]).map((f) => ({ question: f.q, answer: f.a }));

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: tc("hubBreadcrumb"), url: `${SITE_URL}/${locale}${TOOLS_HUB_PATH}` },
        ]}
      />
      <FAQJsonLd questions={faqs} />
      <Navbar />
      <main>
        <PageHero>
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: tc("hubBreadcrumb") }]}
          />
          <div className="mt-4 max-w-3xl lg:mt-6">
            <p className={kicker}>
              {t("eyebrow")} · {tc("freeBadge")}
            </p>
            <h1 className={cx("mt-2", marketingH1)}>{t("h1")}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t("intro")}</p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {TOOL_IDS.map((id) => (
              <li key={id} className="relative flex flex-col rounded-2xl border-2 border-line bg-surface p-6 transition-colors hover:border-brand/40 sm:p-7">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand-text">
                  <span className="material-symbols-outlined">{ICON[id]}</span>
                </span>
                <h2 className="mt-4 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
                  <Link
                    href={toolPath(id)}
                    className={cx("rounded-md after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-brand", focusRing)}
                  >
                    {t(`cards.${id}.title`)}
                  </Link>
                </h2>
                <p className="mt-2 flex-1 text-base leading-relaxed text-ink-body">{t(`cards.${id}.description`)}</p>
                <span aria-hidden className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-brand-text">
                  {t(`cards.${id}.cta`)}
                  <span className="material-symbols-outlined !text-lg">arrow_forward</span>
                </span>
              </li>
            ))}
          </ul>
        </PageHero>

        <section className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <GuideSections sections={t.raw("sections") as { heading: string; paragraphs: string[] }[]} />
          </div>
        </section>

        <BookBand locale={locale} />
        <FaqSection heading={ts("common.faqHeading")} faqs={faqs} />
        <RelatedLinks
          heading={tc("relatedHeading")}
          links={[
            { href: "/gifts/three-kings", label: tc("relatedGifts") },
            { href: CHRISTMAS_DELIVERY_PATH, label: tcd("footerLink") },
            { href: REYES_BLOG_PATH, label: tc("relatedBlog") },
          ]}
        />
      </main>
      <Footer />
    </>
  );
}
