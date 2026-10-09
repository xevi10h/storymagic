import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Footer from "@/components/landing/Footer";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import ExampleBookCard from "@/components/seo-landing/ExampleBookCard";
import { Breadcrumbs } from "@/components/seo-landing/MarketingHeader";
import { RelatedLinks } from "@/components/tools/ToolLanding";
import { Heading } from "@/components/ui";
import { buildBookPages } from "@/lib/book-pages";
import { printedStory } from "@/lib/book/book-plan";
import { sanitizePrintText } from "@/lib/book/print-text";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { BRAND_NAME, SITE_URL, ageBandSlug } from "@/lib/product-facts";
import { seoHubPath, seoPath, themeSlugForTemplate } from "@/lib/seo-landing";
import { findShowcaseRef, getShowcaseBook, getShowcaseStories } from "@/lib/showcase";
import { showcasePath } from "@/lib/showcase-slug";
import ShowcaseBookView from "./ShowcaseBookView";
import { EXAMPLE_COPY, asLoc } from "./copy";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/**
 * An example book: a real book made on the platform, always labelled as an example.
 * Server-rendered: the viewer's pages are built here (same plan as the sample PDF)
 * and the story text is in the HTML, so the page reads without JS and is indexable.
 */
export default async function ShowcaseBookPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // The layout already answered 404 / the UUID redirect; this narrows the types.
  const ref = await findShowcaseRef(locale, slug);
  const story = ref ? await getShowcaseBook(ref.id) : null;
  if (!ref || !story) notFound();

  const t = await getTranslations({ locale, namespace: "showcase" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const copy = EXAMPLE_COPY[asLoc(locale)];

  const pages = buildBookPages({ ...story, status: "ready" }, "", { preview: false });
  const printed = printedStory(story);
  const title = story.title ?? printed.bookTitle;
  const { name, age } = story.characters;
  // The scenes as printed, in reading order (blank bridge scenes carry no text).
  const scenes = [...printed.scenes]
    .sort((a, b) => a.sceneNumber - b.sceneNumber)
    .map((s) => ({ sceneNumber: s.sceneNumber, text: sanitizePrintText(s.text ?? "").trim() }))
    .filter((s) => s.text.length > 0);

  // The book's real art, server-rendered as <img> (the page-flip viewer above is client-only):
  // every ready illustration in reading order; panoramas (a spread in the print plan) stay 2:1.
  const panoramas = new Set(story.book_plan.interior.flatMap((p) => (p.kind === "spread" ? [p.image.sceneNumber] : [])));
  const sceneTitles = new Map(printed.scenes.map((s) => [s.sceneNumber, sanitizePrintText(s.title ?? "").trim()]));
  const art = story.story_illustrations
    .filter((i) => i.status === "ready" && !!i.image_url)
    .sort((a, b) => a.scene_number - b.scene_number)
    .map((i) => ({
      n: i.scene_number,
      src: i.image_url as string,
      wide: panoramas.has(i.scene_number),
      title: sceneTitles.get(i.scene_number) ?? "",
    }));

  // Internal links: this world's theme page, the child's age page, the gifts hub and other examples.
  const themeSlug = themeSlugForTemplate(story.template_id);
  const ageSlug = ageBandSlug(age);
  let others: Awaited<ReturnType<typeof getShowcaseStories>> = [];
  try {
    others = (await getShowcaseStories(locale)).filter((s) => s.id !== story.id && s.locale === locale).slice(0, 3);
  } catch {
    // The related block must never break the book page.
  }
  const relatedLinks = [
    themeSlug
      ? { href: seoPath("themes", themeSlug), label: ts(`themes.${themeSlug}.h1`) }
      : { href: seoHubPath("themes"), label: ts("hubs.themes.h1") },
    { href: seoPath("ages", ageSlug), label: ts(`ages.${ageSlug}.h1`) },
    { href: seoHubPath("gifts"), label: ts("hubs.gifts.h1") },
    ...(isGuideLocale("catalan", locale) ? [{ href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] }] : []),
    { href: GUIDES.likeness.path, label: GUIDE_LINK_LABELS.likeness[locale] },
    { href: "/examples", label: copy.allExamples },
  ];

  const pageUrl = `${SITE_URL}/${locale}${showcasePath(ref.slug)}`;
  const examplesUrl = `${SITE_URL}/${locale}/examples`;
  const firstScene = [...story.story_illustrations].sort((a, b) => a.scene_number - b.scene_number)[0]?.image_url ?? null;
  const image = story.cover_image_url ?? firstScene;

  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${pageUrl}#book`,
    name: title,
    url: pageUrl,
    inLanguage: story.locale ?? locale,
    genre: copy.genre,
    description: copy.description(title, name, age, story.characters.gender),
    ...(printed.synopsis ? { abstract: sanitizePrintText(printed.synopsis) } : {}),
    ...(image ? { image } : {}),
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isFamilyFriendly: true,
    isPartOf: { "@type": "CollectionPage", name: t("title"), url: examplesUrl },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd) }} />
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: t("title"), url: examplesUrl },
          { name: title, url: pageUrl },
        ]}
      />
      <ShowcaseBookView
        storyId={story.id}
        title={title}
        templateId={story.template_id}
        gender={story.characters.gender}
        favoriteColor={story.characters.favorite_color}
        pages={pages}
        breadcrumbs={
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: t("title"), href: "/examples" }, { label: title }]}
          />
        }
        after={
          <>
            {others.length > 0 && (
              <section aria-labelledby="more-examples-title" className="border-t border-line bg-paper px-4 py-14 sm:px-6 sm:py-20">
                <div className="mx-auto max-w-[1200px]">
                  <Heading id="more-examples-title" as="h2" size="section" className="mb-5">
                    {copy.moreHeading}
                  </Heading>
                  <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:max-w-[900px]">
                    {others.map((s) => (
                      <li key={s.id} className="[&:nth-child(3)]:hidden md:[&:nth-child(3)]:block">
                        <ExampleBookCard story={s} headingLevel="h3" />
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            <RelatedLinks heading={copy.relatedHeading} links={relatedLinks} />
          </>
        }
      >
        {(story.cover_image_url || art.length > 0) && (
          <section aria-labelledby="story-art-title" className="border-t border-line bg-surface px-4 py-12 sm:px-6 sm:py-16">
            <div className="mx-auto max-w-[1200px]">
              <Heading id="story-art-title" as="h2" size="section" subtitle={copy.galleryIntro(art.length)} className="mb-6 max-w-2xl text-balance">
                {copy.galleryHeading}
              </Heading>
              <ul className="grid grid-flow-dense grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                {story.cover_image_url && (
                  <li>
                    <figure>
                      <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-line">
                        <Image
                          src={story.cover_image_url}
                          alt={t("coverAlt", { title })}
                          fill
                          sizes="(max-width: 768px) 46vw, 280px"
                          className="object-cover"
                        />
                      </div>
                      <figcaption className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{copy.coverCaption}</figcaption>
                    </figure>
                  </li>
                )}
                {art.map((a) => (
                  <li key={a.n} className={a.wide ? "col-span-2" : undefined}>
                    <figure>
                      <div className={`relative overflow-hidden rounded-xl border border-line bg-line ${a.wide ? "aspect-[2/1]" : "aspect-square"}`}>
                        <Image
                          src={a.src}
                          alt={copy.sceneAlt(title, a.n, a.title)}
                          fill
                          sizes={a.wide ? "(max-width: 768px) 92vw, 580px" : "(max-width: 768px) 46vw, 280px"}
                          className="object-cover"
                        />
                      </div>
                      <figcaption className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        {copy.sceneCaption(a.n)}
                        {a.title && <span className="font-medium normal-case tracking-normal"> · {a.title}</span>}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {scenes.length > 0 && (
          <section aria-labelledby="story-text-title" className="border-t border-line bg-paper">
            <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6 sm:py-16">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-text">
                {t("sampleBadge")} · {BRAND_NAME}
              </p>
              <h2 id="story-text-title" className="mt-2 text-balance font-display text-2xl font-bold leading-tight text-ink sm:text-[28px]">
                {copy.textHeading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-body">{copy.textIntro(name, age, story.characters.gender)}</p>
              <details className="group mt-6 rounded-2xl border-2 border-line bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 text-base font-bold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                  {copy.textToggle}
                  <span aria-hidden className="material-symbols-outlined shrink-0 text-2xl text-ink-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">
                    expand_more
                  </span>
                </summary>
                <div lang={story.locale ?? locale} className="border-t border-line px-5 py-6 text-[17px] leading-[1.75] text-ink-body [&>p+p]:mt-4">
                  <p className="font-display text-xl font-semibold leading-snug text-ink">{title}</p>
                  {scenes.map((scene) => (
                    <p key={scene.sceneNumber} className="whitespace-pre-line">
                      {scene.text}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          </section>
        )}
      </ShowcaseBookView>
      <Footer />
    </>
  );
}
