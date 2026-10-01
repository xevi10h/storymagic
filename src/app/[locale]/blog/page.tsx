import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import FinalCta from "@/components/landing/FinalCta";
import { cx, focusRing } from "@/components/ui";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import { getPublishedPosts, getBlogLocales } from "@/lib/blog";

const BASE_URL = "https://meapica.shop";
const PATH = "/blog";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const url = `${BASE_URL}/${locale}${PATH}`;
  // Data-driven indexing: a locale's index is indexable (and in hreflang/sitemap)
  // only once it has a published post; an empty "coming soon" index is noindex.
  const blogLocales = await getBlogLocales();
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) {
    if (blogLocales.includes(loc)) languages[loc] = `${BASE_URL}/${loc}${PATH}`;
  }
  if (blogLocales.includes(routing.defaultLocale)) {
    languages["x-default"] = `${BASE_URL}/${routing.defaultLocale}${PATH}`;
  }
  const hasPosts = blogLocales.includes(locale);
  return {
    title: { absolute: `${t("title")} | Meapica` },
    description: t("subtitle"),
    alternates: { canonical: url, languages },
    openGraph: { title: t("title"), description: t("subtitle"), url, type: "website" },
    ...(hasPosts ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function BlogIndex({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "blog" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const posts = await getPublishedPosts(locale);

  return (
    <>
      <Navbar />
      <main>
        <PageHero className="pb-8! sm:pb-10!">
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: "Blog" }]}
          />
          <div className="mt-4 max-w-3xl lg:mt-8">
            <p className={kicker}>Blog</p>
            <h1 className={cx("mt-2", marketingH1)}>{t("title")}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t("subtitle")}</p>
          </div>
          {/* Sticky "Crear su libro" bar (phones) appears once the reader is past the header. */}
          <span id="hero-cta" aria-hidden className="block h-px" />
        </PageHero>

        <section aria-label={t("title")} className="bg-paper px-4 sm:px-6">
          <div className="mx-auto max-w-[1200px]">
            {posts.length === 0 ? (
              <p className="py-16 text-center text-base text-ink-muted">{t("empty")}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {posts.map((post, i) => (
                  <li key={post.slug}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className={cx(
                        "group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-line bg-surface transition-colors hover:border-brand/40",
                        focusRing,
                      )}
                    >
                      <div className="relative aspect-[3/2] bg-line">
                        {post.coverImageUrl && (
                          <Image
                            src={post.coverImageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                            priority={i < 3}
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <h2 className="font-display text-xl font-semibold leading-tight text-ink text-balance group-hover:text-brand-text">
                          {post.title}
                        </h2>
                        <p className="line-clamp-3 text-[15px] leading-relaxed text-ink-body">{post.excerpt}</p>
                        <span className="mt-auto pt-2 text-xs font-medium text-ink-muted">
                          {t("readingTime", { min: post.readingMinutes })}
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
