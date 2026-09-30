import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FinalCta from "@/components/landing/FinalCta";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { buttonClass, cx, focusRing } from "@/components/ui";
import { STORY_TEMPLATES } from "@/lib/create-store";
import { PRICING, formatPrice } from "@/lib/pricing";
import {
  type SeoPageType,
  SEO_SLUGS,
  THEME_TEMPLATE,
  featuredTemplateIds,
  seoHubPath,
  seoPath,
} from "@/lib/seo-landing";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "./MarketingHeader";

const BASE_URL = "https://meapica.com";

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

  const cards = slugs.map((slug) => ({
    slug,
    label: t(`nav.${type}.${slug}`),
    intro: t(`${type}.${slug}.heroIntro`),
    href: seoPath(type, slug),
    image: art[slug],
  }));

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
              <Link id="hero-cta" href="/crear" className={buttonClass({ className: "min-h-14 w-full text-lg! sm:w-auto sm:px-8" })}>
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

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
