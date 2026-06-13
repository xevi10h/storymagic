import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { getPublishedPosts } from "@/lib/blog";

const BASE_URL = "https://meapica.com";
const PATH = "/blog";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
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

export default async function BlogIndex({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const posts = await getPublishedPosts(locale);

  return (
    <>
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
          <div className="mx-auto max-w-5xl">
            {posts.length === 0 ? (
              <p className="py-16 text-center text-text-muted">{t("empty")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-cream">
                      {post.coverImageUrl ? (
                        <Image
                          src={post.coverImageUrl}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 360px"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-badge-bg to-cream">
                          <span className="material-symbols-outlined text-5xl text-primary">
                            menu_book
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <h2 className="font-display text-xl font-bold leading-tight text-secondary">
                        {post.title}
                      </h2>
                      <p className="line-clamp-3 text-sm leading-relaxed text-text-soft">
                        {post.excerpt}
                      </p>
                      <span className="mt-auto pt-2 text-xs font-medium text-text-muted">
                        {t("readingTime", { min: post.readingMinutes })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyCta />
    </>
  );
}
