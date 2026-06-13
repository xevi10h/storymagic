import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getShowcaseStories } from "@/lib/showcase";

const BASE_URL = "https://meapica.com";
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
        <header className="relative overflow-hidden px-4 pt-32 pb-12">
          <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-primary-light/20 blur-[100px] mix-blend-multiply" />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-display text-4xl font-bold tracking-tight text-secondary lg:text-6xl">
              {t("title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-soft">
              {t("subtitle")}
            </p>
          </div>
        </header>

        <section className="px-4 pb-24">
          <div className="mx-auto max-w-7xl">
            {stories.length === 0 ? (
              <p className="py-16 text-center text-text-muted">{t("subtitle")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
                {stories.map((s) => (
                  <Link
                    key={s.id}
                    href={`/ejemplo/${s.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border-light/50 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-3/4 overflow-hidden bg-cream">
                      {s.coverImage && (
                        <Image
                          src={s.coverImage}
                          alt={s.title}
                          fill
                          sizes="(max-width: 768px) 45vw, 280px"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-primary backdrop-blur">
                        {ageBucket(s.characterAge)} {tc("years")}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/30">
                        <span className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-secondary opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
                          <span className="material-symbols-outlined text-base">auto_stories</span>
                          {tc("viewSample")}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h2 className="font-display text-base font-bold leading-tight text-secondary">
                        {s.title}
                      </h2>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-14 text-center">
              <Link
                href="/crear"
                className="mx-auto inline-flex items-center gap-2 rounded-lg bg-primary px-10 py-4 text-lg font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
              >
                {t("cta")}
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
