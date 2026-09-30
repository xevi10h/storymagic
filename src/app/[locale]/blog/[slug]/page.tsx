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
import { PRICING, formatPrice } from "@/lib/pricing";
import { buttonClass, cx, focusRing } from "@/components/ui";
import { Breadcrumbs } from "@/components/seo-landing/MarketingHeader";

const BASE_URL = "https://meapica.com";

// Long-form reading: ~68ch measure, 17–18px text, generous leading, Fredoka headings.
// Scoped here (only the blog renders markdown), on brand tokens.
const PROSE = [
  "text-[17px] leading-[1.75] text-ink-body sm:text-lg sm:leading-[1.8]",
  "[&>*+*]:mt-5",
  "[&_h2]:mt-12 [&_h2]:text-balance [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-ink sm:[&_h2]:text-[28px]",
  "[&_h3]:mt-9 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-ink",
  "[&_h2+*]:mt-3 [&_h3+*]:mt-2",
  "[&_a]:font-semibold [&_a]:text-brand-text [&_a]:underline [&_a]:decoration-brand/30 [&_a]:underline-offset-2 [&_a:hover]:decoration-brand",
  "[&_strong]:font-bold [&_strong]:text-ink-soft",
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-2 [&_li]:pl-1 [&_li]:marker:text-brand",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-ink-soft",
  "[&_hr]:my-10 [&_hr]:border-line [&_img]:rounded-2xl",
].join(" ");

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
  const th = await getTranslations({ locale, namespace: "hero" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);
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

      <main>
        <article className="bg-paper px-4 pb-16 sm:px-6 sm:pb-24" style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 0.5rem)" }}>
          <div className="mx-auto max-w-[680px]">
            <Breadcrumbs
              label={ts("common.breadcrumbLabel")}
              items={[
                { label: ts("common.breadcrumbHome"), href: "/" },
                { label: "Blog", href: "/blog" },
                { label: post.title },
              ]}
            />

            <header className="mt-4 lg:mt-8">
              <h1 className="text-balance font-display text-[30px] font-bold leading-[1.12] text-ink sm:text-[42px]">{post.title}</h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                <span>{tb("author", { author: post.author })}</span>
                <span aria-hidden>·</span>
                <span>{tb("readingTime", { min: post.readingMinutes })}</span>
              </p>
            </header>
            {/* Sticky "Crear su libro" bar (phones) appears once the reader is past the header. */}
            <span id="hero-cta" aria-hidden className="block h-px" />
          </div>

          {post.coverImageUrl && (
            <div className="relative mx-auto mt-6 aspect-[3/2] max-w-[680px] overflow-hidden rounded-2xl bg-line sm:mt-8">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover"
                priority
              />
            </div>
          )}

          <div className={cx("mx-auto mt-8 max-w-[680px] sm:mt-10", PROSE)} dangerouslySetInnerHTML={{ __html: html }} />

          {/* Related + CTA */}
          <aside
            aria-labelledby="post-next-title"
            className="mx-auto mt-14 max-w-[680px] rounded-3xl bg-surface p-6 text-center ring-1 ring-line sm:p-10"
          >
            <h2 id="post-next-title" className="text-balance font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {tb("relatedHeading")}
            </h2>
            <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href="/crear" className={buttonClass({ className: "min-h-14 sm:px-8" })}>
                {th("cta")}
                <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              </Link>
              {relatedHref && relatedLabel && (
                <Link href={relatedHref} className={buttonClass({ variant: "secondary", className: "min-h-14" })}>
                  {relatedLabel}
                </Link>
              )}
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              <span className="font-bold tabular-nums text-brand-deep">{th("priceFrom", { price: fromPrice })}</span>
              <span> · {tp("vatIncluded")}</span>
              <span> · {th("freeShipping")}</span>
            </p>
          </aside>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className={cx(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-line hover:text-ink-soft",
                focusRing,
              )}
            >
              <span aria-hidden className="material-symbols-outlined !text-lg">arrow_back</span>
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
