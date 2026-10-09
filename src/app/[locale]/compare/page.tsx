import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FinalCta from "@/components/landing/FinalCta";
import MobileStickyCta from "@/components/landing/MobileStickyCta";
import { BreadcrumbJsonLd, FAQJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import { FaqSection, GuideSections, RelatedLinks } from "@/components/tools/ToolLanding";
import { GuideHero } from "@/components/seo-guides/GuideParts";
import CompareTable, { type CompareTableCell } from "@/components/seo-guides/CompareTable";
import { Heading, cx, focusRing } from "@/components/ui";
import { SITE_URL } from "@/lib/product-facts";
import { PREVIEW_ILLUSTRATION_COUNT } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale } from "@/lib/guides";
import { guideMetadata } from "@/lib/guides-metadata";
import { COMPARE_BRANDS, COMPARE_CHECKED_ON, COMPARE_ROWS, COMPARE_SOURCES, COMPARE_GUIDE_COPY } from "@/lib/guide-copy/compare";
import { guideFacts } from "@/lib/guide-copy/facts";

// Prices come from product-facts and the copy quotes no season date: static is fine, refresh daily anyway.
export const revalidate = 86400;

const ID = "compare" as const;
const PATH = GUIDES[ID].path;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return GUIDES[ID].locales.map((locale) => ({ locale }));
}

function copyFor(locale: string) {
  return COMPARE_GUIDE_COPY[locale]?.(guideFacts(locale), PREVIEW_ILLUSTRATION_COUNT) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return guideMetadata(ID, locale, copyFor(locale));
}

const linkClass = cx("font-semibold text-brand-text underline decoration-brand/30 underline-offset-4", focusRing);

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  if (!isGuideLocale(ID, locale)) notFound();
  setRequestLocale(locale);
  const copy = copyFor(locale)!;
  const lang = copy.langKey;
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tsc = await getTranslations({ locale, namespace: "showcase" });
  const pageUrl = `${SITE_URL}/${locale}${PATH}`;

  const columns = [{ id: "meapica", name: "Meapica", own: true }, ...COMPARE_BRANDS.map((b) => ({ id: b.id, name: b.name }))];
  const rows = COMPARE_ROWS.map((row) => {
    const cells: Record<string, CompareTableCell> = { meapica: { text: copy.meapica[row] } };
    for (const b of COMPARE_BRANDS) cells[b.id] = { text: b.cells[row].text[lang], source: b.cells[row].source };
    return { label: copy.rowLabels[row], cells };
  });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: copy.breadcrumb, url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={copy.faq} />
      <ProductJsonLd locale={locale} url={pageUrl} />
      <Navbar />

      <main>
        <GuideHero
          locale={locale}
          breadcrumbLabel={ts("common.breadcrumbLabel")}
          crumbs={[{ label: ts("common.breadcrumbHome"), href: "/" }, { label: copy.breadcrumb }]}
          eyebrow={copy.eyebrow}
          h1={copy.h1}
          lead={copy.lead}
          cta={{ href: "/create", label: copy.cta }}
          trust={copy.trust}
        />

        {/* The dated table */}
        <section aria-labelledby="compare-table-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <Heading id="compare-table-title" as="h2" size="page" className="text-balance">
                {copy.tableHeading}
              </Heading>
              <p className="text-sm font-semibold text-ink-soft">
                <time dateTime={COMPARE_CHECKED_ON}>{copy.checkedLabel}</time>
              </p>
            </div>
            <div className="mt-8">
              <CompareTable caption={copy.tableCaption} columns={columns} rows={rows} sourceLabel={copy.sourceLabel} scrollHint={copy.scrollHint} />
            </div>
            <ul className="mt-6 flex max-w-prose flex-col gap-2 text-sm leading-relaxed text-ink-muted">
              {copy.tableNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Where each one is better (fair) + our own strengths and limits */}
        <section aria-labelledby="compare-strengths-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <Heading id="compare-strengths-title" as="h2" size="page" subtitle={copy.strengthsIntro} className="max-w-2xl text-balance">
              {copy.strengthsHeading}
            </Heading>
            <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {COMPARE_BRANDS.map((b) => (
                <li key={b.id} className="rounded-2xl border-2 border-line bg-surface p-6">
                  <h3 className="font-display text-xl font-semibold text-ink">{b.name}</h3>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {b.strengths.map((s) => (
                      <li key={s.text[lang]} className="text-[15px] leading-snug text-ink-body">
                        {s.text[lang]}{" "}
                        <a href={`#source-${s.source}`} aria-label={copy.sourceLabel(s.source)} className="text-[11px] font-bold text-brand-text underline decoration-brand/30 underline-offset-2">
                          [{s.source}]
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border-2 border-brand/20 bg-surface p-6 sm:p-7">
              <h3 className="font-display text-xl font-semibold text-ink">{copy.ownHeading}</h3>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {[
                  { label: copy.ownGoodLabel, items: copy.ownGood, icon: "check_circle", tone: "text-brand" },
                  { label: copy.ownWeakLabel, items: copy.ownWeak, icon: "remove_circle_outline", tone: "text-ink-muted" },
                ].map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{group.label}</p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[15px] leading-snug text-ink-body">
                          <span aria-hidden className={cx("material-symbols-outlined mt-px !text-xl shrink-0", group.tone)}>
                            {group.icon}
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How to choose */}
        <section className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
          <GuideSections sections={copy.sections} />
        </section>

        {/* Sources */}
        <section aria-labelledby="compare-sources-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <Heading id="compare-sources-title" as="h2" size="section" className="text-balance">
              {copy.sourcesHeading}
            </Heading>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {copy.sourcesIntro}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className={cx(linkClass, "break-all")}>
                {SUPPORT_EMAIL}
              </a>
            </p>
            <ol className="mt-6 flex flex-col gap-3 text-sm">
              {COMPARE_SOURCES.map((s, i) => (
                <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-[calc(var(--landing-nav-h,64px)+1rem)] leading-snug text-ink-soft">
                  <span className="font-bold tabular-nums text-ink">[{i + 1}]</span> {s.brand} · {s.what[lang]} ·{" "}
                  <a href={s.url} rel="nofollow noopener noreferrer" target="_blank" className={cx(linkClass, "break-all")}>
                    {s.url.replace(/^https:\/\/(www\.)?/, "").split("?")[0]}
                  </a>{" "}
                  <span className="text-ink-muted">
                    (<time dateTime={COMPARE_CHECKED_ON}>{copy.checkedLabel.replace(/^[^0-9]*/, "")}</time>)
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <FaqSection heading={ts("common.faqHeading")} faqs={copy.faq} />

        <RelatedLinks
          heading={copy.relatedHeading}
          links={[
            { href: GUIDES.likeness.path, label: GUIDE_LINK_LABELS.likeness[locale] },
            { href: GUIDES.catalan.path, label: GUIDE_LINK_LABELS.catalan[locale] },
            { href: "/examples", label: tsc("title") },
            { href: "/gifts/three-kings", label: ts("gifts.three-kings.h1") },
            { href: "/personalized-books", label: ts("hubs.ages.h1") },
          ]}
        />

        <FinalCta />
      </main>

      <Footer />
      <MobileStickyCta />
    </>
  );
}
