import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import WatercolorAvatar from "@/components/avatar/WatercolorAvatar";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { GuideHero } from "@/components/seo-guides/GuideParts";
import { Heading, cx, focusRing } from "@/components/ui";
import { LANDING_EXAMPLE } from "@/components/landing/HowItWorksExample";
import type { AvatarTraits } from "@/lib/avatar/manifest";
import { SITE_URL } from "@/lib/product-facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { getShowcaseLikenessBooks } from "@/lib/showcase";
import { showcasePath } from "@/lib/showcase-slug";
import { isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { LIKENESS_GUIDE_COPY } from "@/lib/guide-copy/likeness";
import { guideFacts } from "@/lib/guide-copy/facts";

// Showcase books can be (un)flagged at any time: refresh hourly, like the other showcase surfaces.
export const revalidate = 3600;

const ID = "likeness" as const;
const PATH = GUIDES[ID].path;

/** Sample portraits from the avatar matrix (captions: copy.portraitCaptions, same order). */
const LIKENESS_SAMPLE_PORTRAITS: AvatarTraits[] = [
  { gender: "girl", ageBand: "small", skinTone: "light", hairColor: "red", hairstyle: "curly", eyeColor: "green", glasses: "none", freckles: true },
  { gender: "boy", ageBand: "big", skinTone: "medium-light", hairColor: "brown", hairstyle: "short", eyeColor: "brown", glasses: "round-dark", freckles: false },
  { gender: "girl", ageBand: "small", skinTone: "medium", hairColor: "brown-dark", hairstyle: "braids", eyeColor: "brown-dark", glasses: "none", freckles: false },
  { gender: "boy", ageBand: "small", skinTone: "dark", hairColor: "black", hairstyle: "afro", eyeColor: "brown-dark", glasses: "none", freckles: false },
  { gender: "girl", ageBand: "big", skinTone: "very-dark", hairColor: "black", hairstyle: "long", eyeColor: "brown-dark", glasses: "none", freckles: false },
  { gender: "neutral", ageBand: "small", skinTone: "medium-light", hairColor: "blonde", hairstyle: "bob", eyeColor: "hazel", glasses: "square-red", freckles: false },
];

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

function copyFor(locale: string) {
  const make = LIKENESS_GUIDE_COPY[locale];
  if (!make) return null;
  const copy = make(guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT);
  if (isPhotoUploadEnabled()) return copy;
  // Photo upload is off: say so (trust tick, one paragraph, one FAQ).
  const [first, ...rest] = copy.sections;
  return {
    ...copy,
    trust: [copy.trust[0], copy.noPhoto.trust, ...copy.trust.slice(1)],
    sections: [first, { ...rest[0], paragraphs: [...rest[0].paragraphs, copy.noPhoto.paragraph] }, ...rest.slice(1)],
    faq: [...copy.faq.slice(0, 2), copy.noPhoto.faq, ...copy.faq.slice(2)],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return guideMetadata(ID, locale, copyFor(locale));
}

const frame = "relative overflow-hidden rounded-xl border border-line bg-line";

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isGuideLocale(ID, locale)) notFound();
  setRequestLocale(locale);
  const copy = copyFor(locale)!;
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tsc = await getTranslations({ locale, namespace: "showcase" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const books = (await getShowcaseLikenessBooks(locale, PREVIEW_ILLUSTRATION_COUNT)).slice(0, 4);
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;
  const hubPath = "/personalized-books";

  const related = [
    ...(isGuideLocale("catalan", locale) ? [{ href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] }] : []),
    ...(isGuideLocale("compare", locale) ? [{ href: GUIDES.compare.path, label: GUIDE_LINK_LABELS.compare[locale] }] : []),
    { href: "/examples", label: tsc("title") },
    { href: "/personalized-books/5-7", label: ts("ages.5-7.h1") },
    { href: "/gifts/birthday", label: ts("gifts.birthday.h1") },
    { href: "/gifts/three-kings", label: ts("gifts.three-kings.h1") },
  ];

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: copy.hubCrumb, url: `${SITE_URL}/${locale}${hubPath}` },
          { name: copy.breadcrumb, url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={copy.faq} />
      <Navbar />

      <main>
        <GuideHero
          locale={locale}
          breadcrumbLabel={ts("common.breadcrumbLabel")}
          crumbs={[
            { label: ts("common.breadcrumbHome"), href: "/" },
            { label: copy.hubCrumb, href: hubPath },
            { label: copy.breadcrumb },
          ]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={{ href: "/create", label: copy.cta }}
          secondary={{ href: "/examples", label: th("sampleCta") }}
          trust={copy.trust}
          aside={
            // The landing example child: her portrait next to her real cover.
            <div className="relative mx-auto w-[64vw] max-w-[260px] pb-10 pl-10 lg:w-full lg:max-w-[400px]">
              <div className={cx(frame, "aspect-square shadow-sm")}>
                <Image src={LANDING_EXAMPLE.coverSrc} alt="" fill priority sizes="(max-width: 1024px) 260px, 400px" className="object-cover" />
              </div>
              <div className="absolute bottom-0 left-0 aspect-square w-[46%] overflow-hidden rounded-full border-4 border-paper bg-surface shadow-sm">
                <WatercolorAvatar traits={LIKENESS_SAMPLE_PORTRAITS[0]} alt={copy.portraitCaptions[0]} size="fill" zoom={1.25} preloadNeighbours={false} priority />
              </div>
            </div>
          }
        />

        {/* The traits the parent picks + sample portraits from the same matrix */}
        <section aria-labelledby="likeness-traits-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="likeness-traits-title" as="h2" size="page" subtitle={copy.traitsIntro} className="max-w-2xl text-balance">
              {copy.traitsHeading}
            </Heading>
            <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {copy.traits.map((trait) => (
                <li key={trait.label} className="rounded-2xl border-2 border-line bg-paper p-5">
                  <h3 className="font-display text-lg font-semibold text-ink">{trait.label}</h3>
                  <p className="mt-1.5 text-[15px] leading-snug text-ink-body">{trait.detail}</p>
                </li>
              ))}
            </ul>

            <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {LIKENESS_SAMPLE_PORTRAITS.map((traits, i) => (
                <li key={i} className="flex flex-col items-center text-center">
                  <div className="aspect-square w-full max-w-[160px] overflow-hidden rounded-full border-2 border-line bg-paper">
                    <WatercolorAvatar traits={traits} alt={copy.portraitCaptions[i]} size="fill" preloadNeighbours={false} />
                  </div>
                  <p className="mt-3 text-sm leading-snug text-ink-soft">{copy.portraitCaptions[i]}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-ink-muted">{copy.portraitsNote}</p>
          </div>
        </section>

        {/* Real showcase books: cover + portrait + first scenes (= the free preview) */}
        {books.length > 0 && (
          <section aria-labelledby="likeness-examples-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-[1200px]">
              <Heading id="likeness-examples-title" as="h2" size="page" subtitle={copy.examplesIntro} className="max-w-2xl text-balance">
                {copy.examplesHeading}
              </Heading>
              <ul className="mt-10 flex flex-col gap-10">
                {books.map((book) => (
                  <li key={book.id} className="border-t border-line pt-8 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <h3 className="font-display text-xl font-semibold text-ink">
                        {copy.labels.child(book.characterName, book.characterAge)}
                        <span className="font-sans text-base font-medium text-ink-muted"> · {book.title}</span>
                      </h3>
                      <Link
                        href={showcasePath(book.slug)}
                        className={cx(
                          "inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-brand-text underline decoration-brand/30 underline-offset-4",
                          focusRing,
                        )}
                      >
                        {copy.labels.seeInside}
                        <span aria-hidden className="material-symbols-outlined !text-lg">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                    <div className="no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
                      {[
                        { src: book.coverImage!, label: copy.labels.cover },
                        { src: book.portraitImage!, label: copy.labels.portrait },
                        ...book.scenes.map((src, i) => ({ src, label: copy.labels.scene(i + 1) })),
                      ].map((img) => (
                        <figure key={img.label} className="w-[38vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                          <div className={cx(frame, "aspect-square")}>
                            <Image
                              src={img.src}
                              alt={`${copy.labels.child(book.characterName, book.characterAge)} · ${img.label}`}
                              fill
                              sizes="(max-width: 640px) 38vw, 230px"
                              className="object-cover"
                            />
                          </div>
                          <figcaption className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{img.label}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className={cx("px-4 py-16 sm:px-6 sm:py-24", books.length > 0 ? "border-y border-line bg-surface" : "bg-paper")}>
          <GuideSections sections={copy.sections} />
        </section>

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks heading={copy.relatedHeading} links={related} />

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
