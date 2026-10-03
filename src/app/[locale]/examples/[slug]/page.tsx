import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { buildBookPages } from "@/lib/book-pages";
import { printedStory } from "@/lib/book/book-plan";
import { sanitizePrintText } from "@/lib/book/print-text";
import { BRAND_NAME, SITE_URL } from "@/lib/product-facts";
import { findShowcaseRef, getShowcaseBook } from "@/lib/showcase";
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
      >
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
    </>
  );
}
