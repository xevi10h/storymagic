import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import { STORY_TEMPLATES } from "@/lib/create-store";
import {
  type SeoPageType,
  featuredTemplateIds,
  relatedSeoPages,
  seoCtaHref,
  seoPath,
  seoHubPath,
  SEO_HUB_HEADING_KEY,
} from "@/lib/seo-landing";

const BASE_URL = "https://meapica.com";

// Conversion-ordered subset of the legal FAQ reused on every SEO page.
const FAQ_ORDER = [2, 3, 1, 4] as const;

type Props = {
  type: SeoPageType;
  slug: string;
  locale: string;
};

export default async function SeoLandingPage({ type, slug, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "seo" });
  const td = await getTranslations({ locale, namespace: "data" });
  const tf = await getTranslations({ locale, namespace: "legal" });

  const k = (field: string) => t(`${type}.${slug}.${field}`);
  const ctaHref = seoCtaHref(type, slug);
  const ctaLabel = t("common.ctaPrimary");

  const featured = featuredTemplateIds(type, slug)
    .map((id) => STORY_TEMPLATES.find((tpl) => tpl.id === id))
    .filter((tpl): tpl is (typeof STORY_TEMPLATES)[number] => Boolean(tpl));

  const related = relatedSeoPages(type, slug);
  const pageUrl = `${BASE_URL}/${locale}${seoPath(type, slug)}`;
  const hubPath = seoHubPath(type);
  const hubLabel = t(SEO_HUB_HEADING_KEY[type]);

  // benefits is a JSON array — next-intl t.raw returns it as-is
  const benefits = t.raw(`${type}.${slug}.benefits`) as string[];
  const bodyParagraphs = t.raw(`${type}.${slug}.bodyParagraphs`) as string[];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: hubLabel, url: `${BASE_URL}/${locale}${hubPath}` },
          { name: k("h1"), url: pageUrl },
        ]}
      />
      <ProductJsonLd locale={locale} />
      <Navbar />

      <main>
        {/* Hero */}
        <header className="relative overflow-hidden px-4 pt-32 pb-16">
          <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary-light/20 blur-[100px] mix-blend-multiply" />
          <div className="mx-auto max-w-4xl">
            {/* Breadcrumb */}
            <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
              <Link href="/" className="hover:text-primary">
                {t("common.breadcrumbHome")}
              </Link>
              <span className="material-symbols-outlined text-base">
                chevron_right
              </span>
              <Link href={hubPath} className="hover:text-primary">
                {hubLabel}
              </Link>
              <span className="material-symbols-outlined text-base">
                chevron_right
              </span>
              <span className="text-text-soft">{k("h1")}</span>
            </nav>

            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-secondary lg:text-6xl">
              {k("h1")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-soft">
              {k("heroIntro")}
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                href={ctaHref}
                className="flex h-14 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
              >
                {ctaLabel}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              <div className="flex items-center gap-2 text-sm font-medium text-text-soft">
                <span className="material-symbols-outlined text-xl text-success">
                  forest
                </span>
                <span>{tf("faq.section4Title")}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Body + benefits */}
        <section className="bg-white px-4 py-20">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="mb-6 font-display text-3xl font-bold text-secondary">
                {k("bodyHeading")}
              </h2>
              <div className="flex flex-col gap-5">
                {bodyParagraphs.map((p, i) => (
                  <p key={i} className="text-lg leading-relaxed text-text-soft">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border-light bg-cream/50 p-8">
              <h3 className="mb-5 font-display text-xl font-bold text-secondary">
                {k("benefitsHeading")}
              </h3>
              <ul className="flex flex-col gap-4">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-text-soft">
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-primary">
                      check_circle
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Featured stories */}
        <section className="bg-cream px-4 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold text-secondary md:text-4xl">
                {t("common.featuredHeading")}
              </h2>
              <p className="mx-auto max-w-xl text-text-soft">
                {t("common.featuredSubheading")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {featured.map((tpl) => (
                <Link
                  key={tpl.id}
                  href={`/crear?template=${tpl.id}&from=seo`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border-light/50 bg-white shadow-sm transition-all duration-300 hover:shadow-xl"
                >
                  <div className="relative aspect-3/4 overflow-hidden bg-cream">
                    <Image
                      src={tpl.image}
                      alt={td(`templates.${tpl.id}.title`)}
                      fill
                      sizes="(max-width: 768px) 45vw, 280px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-primary backdrop-blur">
                      {td(`templates.${tpl.id}.ageRange`)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-display text-base font-bold leading-tight text-secondary">
                      {td(`templates.${tpl.id}.title`)}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-white px-4 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-10 text-center font-display text-3xl font-bold text-secondary">
              {t("common.faqHeading")}
            </h2>
            <div className="flex flex-col gap-4">
              {FAQ_ORDER.map((n) => (
                <details
                  key={n}
                  className="group rounded-xl border border-border-light bg-cream/40 transition-colors open:bg-cream/70"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-display text-lg font-bold text-secondary [&::-webkit-details-marker]:hidden">
                    {tf(`faq.section${n}Title`)}
                    <span className="material-symbols-outlined shrink-0 text-text-muted transition-transform duration-300 group-open:rotate-180">
                      expand_more
                    </span>
                  </summary>
                  <p className="px-6 pb-6 leading-relaxed text-text-soft">
                    {tf(`faq.section${n}Text`)}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Related pages — internal linking */}
        <section className="bg-cream px-4 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center font-display text-2xl font-bold text-secondary">
              {t("common.relatedHeading")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={`${p.type}-${p.slug}`}
                  href={seoPath(p.type, p.slug)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border-light bg-white px-5 py-4 text-sm font-bold text-secondary shadow-sm transition-all hover:border-primary hover:text-primary hover:shadow-md"
                >
                  <span className="line-clamp-1">{t(`${p.type}.${p.slug}.h1`)}</span>
                  <span className="material-symbols-outlined shrink-0 text-base text-text-muted">
                    arrow_forward
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-20 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 font-display text-3xl font-bold text-secondary md:text-4xl">
              {k("bodyHeading")}
            </h2>
            <Link
              href={ctaHref}
              className="mx-auto inline-flex items-center gap-2 rounded-lg bg-secondary px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-secondary-hover"
            >
              {ctaLabel}
              <span className="material-symbols-outlined">auto_stories</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
