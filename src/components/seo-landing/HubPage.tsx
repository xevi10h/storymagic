import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { STORY_TEMPLATES } from "@/lib/create-store";
import {
  type SeoPageType,
  SEO_SLUGS,
  THEME_TEMPLATE,
  seoPath,
} from "@/lib/seo-landing";

const BASE_URL = "https://meapica.com";
const HUB_BASE = "/personalized-books"; // ages hub base (shared with [age])

// Icon per gift occasion (material symbols).
const GIFT_ICON: Record<string, string> = {
  "three-kings": "redeem",
  "sant-jordi": "local_florist",
  birthday: "cake",
  communion: "church",
  christmas: "park",
  baptism: "water_drop",
  "end-of-school": "school",
  "name-day": "celebration",
  graduation: "workspace_premium",
  "first-birthday": "child_friendly",
};

type Props = {
  type: SeoPageType;
  locale: string;
};

export default async function HubPage({ type, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "seo" });
  const td = await getTranslations({ locale, namespace: "data" });

  const hubPath =
    type === "gifts" ? "/gifts" : type === "themes" ? "/themes" : HUB_BASE;
  const pageUrl = `${BASE_URL}/${locale}${hubPath}`;
  const slugs = SEO_SLUGS[type];

  const cards = slugs.map((slug) => {
    const label = t(`nav.${type}.${slug}`);
    let image: string | null = null;
    if (type === "themes") {
      const tpl = STORY_TEMPLATES.find((x) => x.id === THEME_TEMPLATE[slug]);
      image = tpl?.image ?? null;
    }
    return {
      slug,
      label,
      href: seoPath(type, slug),
      image,
      icon: type === "gifts" ? GIFT_ICON[slug] : "auto_stories",
      alt: image ? td(`templates.${THEME_TEMPLATE[slug]}.title`) : label,
    };
  });

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <Navbar />

      <main>
        <header className="relative overflow-hidden px-4 pt-32 pb-12">
          <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary-light/20 blur-[100px] mix-blend-multiply" />
          <div className="mx-auto max-w-4xl">
            <nav className="mb-6 flex items-center gap-1.5 text-sm text-text-muted">
              <Link href="/" className="hover:text-primary">
                {t("common.breadcrumbHome")}
              </Link>
              <span className="material-symbols-outlined text-base">
                chevron_right
              </span>
              <span className="text-text-soft">{t(`hubs.${type}.h1`)}</span>
            </nav>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.1] tracking-tight text-secondary lg:text-6xl">
              {t(`hubs.${type}.h1`)}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-soft">
              {t(`hubs.${type}.intro`)}
            </p>
          </div>
        </header>

        <section className="px-4 pb-24">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.slug}
                  href={c.href}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  {c.image ? (
                    <div className="relative aspect-[16/10] overflow-hidden bg-cream">
                      <Image
                        src={c.image}
                        alt={c.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 360px"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center bg-cream">
                      <span className="material-symbols-outlined text-5xl text-primary">
                        {c.icon}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 p-5">
                    <span className="font-display text-lg font-bold text-secondary">
                      {c.label}
                    </span>
                    <span className="material-symbols-outlined shrink-0 text-text-muted transition-transform group-hover:translate-x-1">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-14 text-center">
              <Link
                href="/crear"
                className="mx-auto inline-flex items-center gap-2 rounded-lg bg-primary px-10 py-4 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
              >
                {t("common.ctaPrimary")}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
