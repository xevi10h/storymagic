import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FinalCta from "@/components/landing/FinalCta";
import FaqItem from "@/components/landing/FaqItem";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { Heading, buttonClass, cx, focusRing } from "@/components/ui";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { PRICING, formatPrice } from "@/lib/pricing";
import { factParams } from "@/lib/product-facts";
import {
  type SeoPageType,
  SEO_SLUGS,
  THEME_TEMPLATE,
  featuredTemplateIds,
  seoHubPath,
  seoPath,
} from "@/lib/seo-landing";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "./MarketingHeader";

const BASE_URL = "https://meapica.shop";

type Props = {
  type: SeoPageType;
  locale: string;
};

/** Cover art per card: the theme's own world; per age, the first world of that range not already shown. */
function cardArt(type: SeoPageType, slugs: readonly string[]): Record<string, string | null> {
  const art: Record<string, string | null> = {};
  const used = new Set<string>();
  for (const slug of slugs) {
    let templateId: string | undefined;
    if (type === "themes") templateId = THEME_TEMPLATE[slug];
    else if (type === "ages") templateId = featuredTemplateIds(type, slug).find((id) => !used.has(id));
    // Gift occasions share the same worlds: text cards, no repeated art.
    if (templateId) used.add(templateId);
    art[slug] = templateId ? (STORY_TEMPLATES.find((x) => x.id === templateId)?.image ?? null) : null;
  }
  return art;
}

export default async function HubPage({ type, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "seo" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const tp = await getTranslations({ locale, namespace: "pricing" });

  const hubPath = seoHubPath(type);
  const pageUrl = `${BASE_URL}/${locale}${hubPath}`;
  const slugs = SEO_SLUGS[type];
  const art = cardArt(type, slugs);
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);

  const values = factParams((cents) => formatPrice(cents, locale));
  const cards = slugs.map((slug) => ({
    slug,
    label: t(`nav.${type}.${slug}`),
    intro: t(`${type}.${slug}.heroIntro`, values),
    href: seoPath(type, slug),
    image: art[slug],
  }));

  // Optional long-form guide + FAQ under the cards: seo.hubs.{type}.sections / .faq (q1/a1 … q4/a4).
  const base = `hubs.${type}`;
  const guideHeading = t.has(`${base}.guideHeading`) ? t(`${base}.guideHeading`, values) : null;
  const sections = t.has(`${base}.sections`)
    ? (t.raw(`${base}.sections`) as { heading: string; paragraphs: string[] }[]).map((sec, i) => ({
        heading: t(`${base}.sections.${i}.heading`, values),
        paragraphs: sec.paragraphs.map((_, j) => t(`${base}.sections.${i}.paragraphs.${j}`, values)),
      }))
    : [];
  const faqs = ([1, 2, 3, 4] as const)
    .filter((n) => t.has(`${base}.faq.q${n}`))
    .map((n) => ({ question: t(`${base}.faq.q${n}`, values), answer: t(`${base}.faq.a${n}`, values) }));

  // ItemList structured data for the hub.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      url: `${BASE_URL}/${locale}${c.href}`,
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: t(`hubs.${type}.h1`), url: pageUrl },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      {faqs.length > 0 && <FAQJsonLd questions={faqs} />}
      <Navbar />

      <main>
        <PageHero className="pb-8! sm:pb-10!">
          <Breadcrumbs
            label={t("common.breadcrumbLabel")}
            items={[{ label: t("common.breadcrumbHome"), href: "/" }, { label: t(`hubs.${type}.h1`) }]}
          />
          <div className="mt-4 max-w-3xl lg:mt-8">
            <p className={kicker}>{th("eyebrow")}</p>
            <h1 className={cx("mt-2", marketingH1)}>{t(`hubs.${type}.h1`)}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t(`hubs.${type}.intro`)}</p>
            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link id="hero-cta" href="/create" className={buttonClass({ className: "min-h-14 w-full sm:w-auto sm:px-8" })}>
                {th("cta")}
                <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </Link>
              <p className="w-full text-center text-sm text-ink-soft sm:w-auto sm:text-left">
                <span className="font-bold tabular-nums text-brand-deep">{th("priceFrom", { price: fromPrice })}</span>
                <span> · {tp("vatIncluded")}</span>
                <span> · {th("freeShipping")}</span>
              </p>
            </div>
          </div>
        </PageHero>

        <section aria-label={t(`hubs.${type}.h1`)} className="bg-paper px-4 sm:px-6">
          <ul className="mx-auto grid max-w-[1200px] grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {cards.map((c, i) => (
              <li key={c.slug}>
                <Link
                  href={c.href}
                  className={cx(
                    "group flex h-full overflow-hidden rounded-2xl border-2 border-line bg-surface transition-colors hover:border-brand/40",
                    c.image ? "flex-row sm:flex-col" : "flex-col",
                    focusRing,
                  )}
                >
                  {c.image && (
                    // Covers are square (the book is 20 × 20 cm): thumbnail on phones, full cover above.
                    <div className="relative aspect-square w-28 shrink-0 bg-line sm:w-full">
                      <Image
                        src={c.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 380px"
                        priority={i < 3}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-4 sm:p-5">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-display text-lg font-semibold leading-tight text-ink text-balance">{c.label}</span>
                      <span
                        aria-hidden
                        className="material-symbols-outlined !text-xl shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-text"
                      >
                        arrow_forward
                      </span>
                    </span>
                    <span className="line-clamp-2 text-sm leading-snug text-ink-muted sm:line-clamp-3">{c.intro}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {sections.length > 0 && (
          <section aria-labelledby="hub-guide-title" className="mt-16 border-y border-line bg-surface px-4 py-16 sm:mt-24 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-3xl">
              {guideHeading && (
                <Heading id="hub-guide-title" as="h2" size="page" className="text-balance">
                  {guideHeading}
                </Heading>
              )}
              {sections.map((sec) => (
                <div key={sec.heading} className="mt-10 first:mt-0">
                  <h3 className="font-display text-lg font-semibold leading-snug text-ink sm:text-xl">{sec.heading}</h3>
                  <div className="mt-3 flex flex-col gap-4">
                    {sec.paragraphs.map((p, i) => (
                      <p key={i} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section aria-labelledby="hub-faq-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-3xl">
              <Heading id="hub-faq-title" as="h2" size="page" className="mb-8 text-balance text-center">
                {t("common.faqHeading")}
              </Heading>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
                {faqs.map((f) => (
                  <FaqItem key={f.question} question={f.question} answer={f.answer} />
                ))}
              </div>
            </div>
          </section>
        )}

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
