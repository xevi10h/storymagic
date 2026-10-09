import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import FaqItem from "@/components/landing/FaqItem";
import { BreadcrumbJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";
import { Breadcrumbs, PageHero, kicker, marketingH1, marketingLead } from "@/components/seo-landing/MarketingHeader";
import { Heading, cx, focusRing } from "@/components/ui";
import { PRICING, formatPrice } from "@/lib/pricing";
import { COPY_PARAMS, SITE_URL } from "@/lib/product-facts";
import { CHRISTMAS_DELIVERY_PATH, earliestPrintedCutoff, spainToday } from "@/lib/shipping";
import { REYES_BLOG_PATH, TOOLS_HUB_PATH, toolPath, type ToolId, type ToolLocale } from "@/lib/tools/registry";
import { GUIDES, GUIDE_LINK_LABELS, isGuideLocale, type GuideId } from "@/lib/guides";
import BookCta from "./BookCta";

const INTL_LOCALE: Record<ToolLocale, string> = { es: "es-ES", ca: "ca-ES" };

type Section = { heading: string; paragraphs: string[]; link?: { href: string; label: string } };
type Faq = { q: string; a: string };

/**
 * This season's printed-book Reyes cut-off ("22 de diciembre"). `openOnly`: null
 * once it has passed (the book band then offers the PDF instead).
 */
export function reyesCutoff(locale: ToolLocale, { openOnly = true, today = spainToday() } = {}): string | null {
  const date = earliestPrintedCutoff(today, "reyes");
  if (openOnly && date < today) return null;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(`${date}T00:00:00Z`));
}

/** Readable list of `{heading, paragraphs[]}` sections from the messages. */
export function GuideSections({ sections }: { sections: Section[] }) {
  return (
    <div className="mx-auto flex max-w-prose flex-col gap-12">
      {sections.map((s) => (
        <div key={s.heading}>
          <h2 className="text-balance font-display text-[22px] font-bold leading-tight text-ink sm:text-[28px]">{s.heading}</h2>
          <div className="mt-3 flex flex-col gap-4">
            {s.paragraphs.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
                {p}
              </p>
            ))}
          </div>
          {s.link && (
            <Link
              href={s.link.href}
              className={cx(
                "mt-3 inline-flex min-h-11 items-center gap-1 rounded-md text-base font-semibold text-brand-text underline decoration-brand/30 underline-offset-4",
                focusRing,
              )}
            >
              {s.link.label}
              <span aria-hidden className="material-symbols-outlined !text-lg">
                arrow_forward
              </span>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** The one brand-deep band: the personalised book, honest dates and VAT-inclusive prices. */
export async function BookBand({ locale }: { locale: ToolLocale }) {
  const t = await getTranslations({ locale, namespace: "tools.common" });
  const th = await getTranslations({ locale, namespace: "hero" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const date = reyesCutoff(locale);
  const fromPrice = formatPrice(Math.min(PRICING.softcover.price, PRICING.hardcover.price), locale);
  return (
    <section id="final-cta" aria-labelledby="tool-book-title" className="bg-brand-deep px-4 py-16 text-paper sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-line-warm">{t("bookEyebrow")}</p>
        <h2 id="tool-book-title" className="mt-3 text-balance font-display text-[28px] font-bold leading-[1.12] text-paper sm:text-4xl">
          {t("bookHeading")}
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-paper/85 sm:text-lg">{t("bookText", COPY_PARAMS)}</p>
        <p className="mx-auto mt-4 max-w-prose text-sm font-semibold text-paper">
          {date ? t("bookDeadline", { date }) : t("bookLate")}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <BookCta />
          <p className="text-sm text-paper/85">
            <span className="font-bold tabular-nums text-paper">{th("priceFrom", { price: fromPrice })}</span>
            <span> · {tp("vatIncluded")}</span>
            <span> · {th("freeShipping")}</span>
          </p>
          <p className="text-sm text-paper/85">
            {t("bookPdfLabel")}: <span className="font-bold tabular-nums text-paper">{formatPrice(PRICING.digital_pdf.price, locale)}</span>
            <span> · {tp("vatIncluded")}</span>
          </p>
          <Link
            href={CHRISTMAS_DELIVERY_PATH}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-paper underline decoration-paper/40 underline-offset-4 hover:decoration-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden className="material-symbols-outlined !text-lg">
              local_shipping
            </span>
            {t("deadlineLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ heading, faqs }: { heading: string; faqs: { question: string; answer: string }[] }) {
  return (
    <section aria-labelledby="tool-faq-title" className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Heading id="tool-faq-title" as="h2" size="page" className="mb-8 text-balance text-center">
          {heading}
        </Heading>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
          {faqs.map((f) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

const linkCard = cx(
  "group flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-paper px-5 py-3 font-display text-base font-semibold leading-snug text-ink transition-colors hover:border-brand/40",
  focusRing,
);

export function RelatedLinks({ heading, links }: { heading: string; links: { href: string; label: string }[] }) {
  return (
    <section aria-labelledby="tool-related-title" className="border-y border-line bg-surface px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-[1200px]">
        <Heading id="tool-related-title" as="h2" size="section" className="mb-5">
          {heading}
        </Heading>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkCard}>
                <span className="min-w-0">{l.label}</span>
                <span aria-hidden className="material-symbols-outlined !text-xl shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-text">
                  arrow_forward
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A free tool page (/tools/letter-to-the-three-kings, /tools/reply-from-the-three-kings):
 * hero, the tool itself, the guide (server-rendered, indexable), the book band,
 * FAQ (+ FAQPage JSON-LD), related links. No mobile sticky "Crear su libro" bar:
 * on these pages the download is the one primary action.
 */
export default async function ToolLanding({ tool, locale, children }: { tool: ToolId; locale: ToolLocale; children: ReactNode }) {
  const t = await getTranslations({ locale, namespace: `tools.${tool}` });
  const tc = await getTranslations({ locale, namespace: "tools.common" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const tcd = await getTranslations({ locale, namespace: "christmasDelivery" });

  // FAQ: the rule ("pídelo antes del 22 de diciembre") stays true after the date too.
  const reyesDate = reyesCutoff(locale, { openOnly: false }) as string;
  const sections = t.raw("sections") as Section[];
  const ages = tool === "letter" ? (t.raw("ages") as { band: string; text: string }[]) : [];
  const faqs = (t.raw("faq") as Faq[]).map((f) => ({ question: f.q, answer: f.a.replace("{reyesDate}", reyesDate) }));
  const other: ToolId = tool === "letter" ? "reply" : "letter";
  const pageUrl = `${SITE_URL}/${locale}${toolPath(tool)}`;
  const tOther = await getTranslations({ locale, namespace: `tools.hub.cards.${other}` });

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: tc("hubBreadcrumb"), url: `${SITE_URL}/${locale}${TOOLS_HUB_PATH}` },
          { name: t("h1"), url: pageUrl },
        ]}
      />
      <FAQJsonLd questions={faqs} />
      <Navbar />

      <main>
        <PageHero className="!pb-8 sm:!pb-10">
          <Breadcrumbs
            label={ts("common.breadcrumbLabel")}
            items={[
              { label: ts("common.breadcrumbHome"), href: "/" },
              { label: tc("hubBreadcrumb"), href: TOOLS_HUB_PATH },
              { label: t("h1") },
            ]}
          />
          <div className="mt-4 max-w-3xl lg:mt-6">
            <p className={kicker}>
              {t("eyebrow")} · {tc("freeBadge")}
            </p>
            <h1 className={cx("mt-2", marketingH1)}>{t("h1")}</h1>
            <p className={cx("mt-4 max-w-2xl", marketingLead)}>{t("intro")}</p>
          </div>
        </PageHero>

        <section
          id="tool"
          aria-label={tc("toolSectionLabel")}
          className="scroll-mt-[var(--landing-nav-h,64px)] border-y border-line bg-surface px-4 py-10 sm:px-6 sm:py-14"
        >
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </section>

        <section className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1200px]">
            <GuideSections sections={sections} />
          </div>
        </section>

        {ages.length > 0 && (
          <section aria-labelledby="tool-ages-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-[1200px]">
              <Heading id="tool-ages-title" as="h2" size="page" className="mb-8 text-balance">
                {tc("agesHeading")}
              </Heading>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {ages.map((a) => (
                  <li key={a.band} className="rounded-2xl border-2 border-line bg-paper p-5">
                    <h3 className="font-display text-lg font-semibold text-ink">{a.band}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-body">{a.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <BookBand locale={locale} />

        <FaqSection heading={ts("common.faqHeading")} faqs={faqs} />

        <RelatedLinks
          heading={tc("relatedHeading")}
          links={[
            { href: toolPath(other), label: tOther("title") },
            { href: "/gifts/three-kings", label: tc("relatedGifts") },
            { href: CHRISTMAS_DELIVERY_PATH, label: tcd("footerLink") },
            { href: REYES_BLOG_PATH, label: tc("relatedBlog") },
            { href: TOOLS_HUB_PATH, label: tc("hubLink") },
            // Catalan cluster: the books written in Catalan and the tió gift page (where they exist).
            ...(["catalan", "tio"] satisfies GuideId[])
              .filter((id) => isGuideLocale(id, locale))
              .map((id) => ({ href: GUIDES[id].path, label: GUIDE_LINK_LABELS[id][locale] })),
          ]}
        />
      </main>

      <Footer />
    </>
  );
}
