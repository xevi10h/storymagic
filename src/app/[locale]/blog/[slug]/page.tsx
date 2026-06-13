import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getPost, getLocalesForSlug } from "@/lib/blog";
import { seoPath } from "@/lib/seo-landing";

const BASE_URL = "https://meapica.com";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(locale, slug);
  if (!post) return {};
  const path = `/blog/${slug}`;
  const url = `${BASE_URL}/${locale}${path}`;

  // Only emit hreflang for locales where this post is actually published.
  const locales = await getLocalesForSlug(slug);
  const languages: Record<string, string> = {};
  for (const loc of locales) languages[loc] = `${BASE_URL}/${loc}${path}`;
  if (locales.includes("es")) languages["x-default"] = `${BASE_URL}/es${path}`;

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;

  return {
    title: { absolute: `${title} | Meapica` },
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}),
    },
  };
}

export default async function BlogPost({ params }: PageProps) {
  const { locale, slug } = await params;
  const post = await getPost(locale, slug);
  if (!post) notFound();

  const tb = await getTranslations({ locale, namespace: "blog" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const html = await marked.parse(post.bodyMarkdown);
  const pageUrl = `${BASE_URL}/${locale}/blog/${slug}`;

  const relatedHref =
    post.relatedType && post.relatedSlug
      ? seoPath(post.relatedType, post.relatedSlug)
      : null;
  const relatedLabel =
    post.relatedType && post.relatedSlug
      ? ts(`nav.${post.relatedType}.${post.relatedSlug}`)
      : null;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    inLanguage: locale,
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: "Meapica" },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    mainEntityOfPage: pageUrl,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${BASE_URL}/${locale}` },
          { name: tb("title"), url: `${BASE_URL}/${locale}/blog` },
          { name: post.title, url: pageUrl },
        ]}
      />
      <Navbar />

      <main className="px-4 pt-32 pb-24">
        <article className="mx-auto max-w-2xl">
          <nav className="mb-8 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href="/" className="hover:text-primary">
              {ts("common.breadcrumbHome")}
            </Link>
            <span className="material-symbols-outlined text-base">chevron_right</span>
            <Link href="/blog" className="hover:text-primary">
              {tb("title")}
            </Link>
          </nav>

          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-secondary lg:text-5xl">
            {post.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
            <span>{tb("author", { author: post.author })}</span>
            <span>·</span>
            <span>{tb("readingTime", { min: post.readingMinutes })}</span>
          </div>

          {post.coverImageUrl && (
            <div className="relative mt-8 aspect-[3/2] overflow-hidden rounded-2xl bg-cream">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div
            className="prose-article mt-10"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Related + CTA */}
          <div className="mt-14 rounded-2xl border border-border-light bg-cream/50 p-8 text-center">
            <h2 className="mb-5 font-display text-2xl font-bold text-secondary">
              {tb("relatedHeading")}
            </h2>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/crear"
                className="flex h-13 items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/10 transition-all hover:-translate-y-1 hover:bg-primary-hover"
              >
                {ts("common.ctaPrimary")}
                <span className="material-symbols-outlined">arrow_forward</span>
              </Link>
              {relatedHref && relatedLabel && (
                <Link
                  href={relatedHref}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border-light bg-white px-8 py-3.5 text-base font-bold text-secondary transition-all hover:border-primary hover:text-primary"
                >
                  {relatedLabel}
                </Link>
              )}
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {tb("backToBlog")}
            </Link>
          </div>
        </article>
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
