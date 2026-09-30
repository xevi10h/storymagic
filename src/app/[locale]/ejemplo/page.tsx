import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FinalCta from "@/components/landing/FinalCta";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { buttonClass, cx, focusRing } from "@/components/ui";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import { getShowcaseStories } from "@/lib/showcase";

const BASE_URL = "https://meapica.shop";
const PATH = "/ejemplo";

type PageProps = { params: Promise<{ locale: string }> };

function ageBucket(age: number): string {
  if (age <= 4) return "2-4";
  if (age <= 7) return "5-7";
  return "8-12";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "showcase" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = `${BASE_URL}/${loc}${PATH}`;
  languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${PATH}`;
  return {
    title: { absolute: `${t("title")} | Meapica` },
    description: t("subtitle"),
    alternates: { canonical: url, languages },
    openGraph: { title: t("title"), description: t("subtitle"), url, type: "website" },
  };
}

export default async function ShowcaseIndex({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "showcase" });
  const tc = await getTranslations({ locale, namespace: "bookCollection" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const stories = await getShowcaseStories(locale);

  const pageUrl = `${BASE_URL}/${locale}${PATH}`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("title"),
    description: t("subtitle"),
    url: pageUrl,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: stories.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: s.title,
        url: `${BASE_URL}/${locale}/ejemplo/${s.id}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: t("title"), url: pageUrl },
        ]}
      />
      <Navbar />

      <main>
        <PageHero className="pb-8! sm:pb-10!">
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: t("title") }]}
          />
          <div className="mt-4 max-w-3xl lg:mt-8">
            <p className={kicker}>{th("eyebrow")}</p>
            <h1 className={cx("mt-2", marketingH1)}>{t("title")}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t("subtitle")}</p>
            <Link
              id="hero-cta"
              href="/crear"
              className={buttonClass({ className: "mt-7 min-h-14 w-full sm:w-auto sm:px-8" })}
            >
              {th("cta")}
              <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </Link>
          </div>
        </PageHero>

        <section aria-label={t("title")} className="bg-paper px-4 sm:px-6">
          <div className="mx-auto max-w-[1200px]">
            {stories.length === 0 ? (
              <p className="py-16 text-center text-base text-ink-muted">{t("subtitle")}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {stories.map((s, i) => (
                  <li key={s.id}>
                    <Link
                      href={`/ejemplo/${s.id}`}
                      className={cx(
                        "group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-line bg-surface transition-colors hover:border-brand/40",
                        focusRing,
                      )}
                    >
                      {/* Pages are square (20 × 20 cm book): no cropping. */}
                      <div className="relative aspect-square bg-line">
                        {s.coverImage && (
                          <Image
                            src={s.coverImage}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 46vw, (max-width: 1024px) 31vw, 280px"
                            priority={i < 2}
                            className="object-cover"
                          />
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink-soft shadow-sm tabular-nums">
                          {ageBucket(s.characterAge)} {tc("years")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                        <h2 className="font-display text-base font-semibold leading-tight text-ink text-balance sm:text-lg">
                          {s.title}
                        </h2>
                        <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-brand-text">
                          <span aria-hidden className="material-symbols-outlined !text-lg">
                            menu_book
                          </span>
                          {tc("viewSample")}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
