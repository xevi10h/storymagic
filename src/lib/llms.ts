// /llms.txt and /llms-full.txt (llmstxt.org): what Meapica sells, for AI assistants and
// answer engines. Every fact comes from the same constants as the site copy and the
// JSON-LD (lib/product-facts.ts, lib/pricing.ts, lib/shipping.ts) and the full file
// reuses the page copy modules (lib/guide-copy/*) and the blog rows, so neither file
// can drift from the site.

import { formatPrice } from "@/lib/pricing";
import {
  AGE_BANDS,
  AGE_MAX,
  AGE_MIN,
  BOOK_FORMATS,
  BOOK_INNER_PAGES,
  BOOK_PAPER_GSM,
  BOOK_SCENES,
  BOOK_SIZE_CM,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  DEFECT_CLAIM_DAYS,
  DELIVERY_BUSINESS_DAYS,
  FOUNDER,
  PDF_DELIVERY_MAX_MINUTES,
  PREVIEW_SCENES,
  SITE_URL,
} from "@/lib/product-facts";
import { CHRISTMAS_DELIVERY_PATH, earliestPrintedCutoff, giftSeason, spainToday } from "@/lib/shipping";
import { SEO_GIFT_SLUGS, SEO_THEME_SLUGS, seoHubPath, seoPath } from "@/lib/seo-landing";
import { TOOLS_HUB_PATH, toolPath } from "@/lib/tools/registry";
import { GUIDES, guideUpdated, type GuideId } from "@/lib/guides";
import { getPost, getPublishedPosts } from "@/lib/blog";
import { guideFacts } from "@/lib/guide-copy/facts";
import type { GuideFaq, GuideSection } from "@/lib/guide-copy/types";
import { ABOUT_GUIDE_COPY } from "@/lib/guide-copy/about";
import { CATALAN_GUIDE_COPY } from "@/lib/guide-copy/catalan";
import { CATALAN_AGES_GUIDE_COPY } from "@/lib/guide-copy/catalan-ages";
import { COMPARE_BRANDS, COMPARE_CHECKED_ON, COMPARE_GUIDE_COPY, COMPARE_ROWS, COMPARE_SOURCES, type CompareGuideCopy } from "@/lib/guide-copy/compare";
import { LIKENESS_GUIDE_COPY, type LikenessGuideCopy } from "@/lib/guide-copy/likeness";
import { TIO_GUIDE_COPY } from "@/lib/guide-copy/tio";
import { isPhotoUploadEnabled, PHOTO_MAX_AGE_HOURS } from "@/lib/privacy/child-photo-policy";

const eur = (cents: number) => formatPrice(cents, "es");
const es = (path: string) => `${SITE_URL}/es${path}`;

function longDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** /llms.txt: the short brief (llmstxt.org). */
export function llmsBrief(): string {
  const today = spainToday();
  const season = giftSeason(today);
  const christmasCutoff = earliestPrintedCutoff(today, "christmas");
  const reyesCutoff = earliestPrintedCutoff(today, "reyes");
  const photoUpload = isPhotoUploadEnabled();

  return `# Meapica

> Meapica makes personalised printed picture books for children aged ${AGE_MIN} to ${AGE_MAX}: the child's name on the cover and on every page, a watercolour portrait that looks like them, and an adventure whose chapters the parent chooses. You see the cover, the portrait and the first ${PREVIEW_SCENES} illustrated scenes of the child's own book before paying. Run from Barcelona, sold in Spain, printed on demand in Europe.

- Made by: ${FOUNDER.legalName} (${FOUNDER.city}, Spain), the person named in the legal notice. Facts sheet: ${es(GUIDES.about.path)} (Catalan: ${SITE_URL}/ca${GUIDES.about.path})
- How it is made: the story and the illustrations are generated with AI from the parent's choices, so every book is unique.
- Full text of the guides, the facts sheet and the blog in one file: ${SITE_URL}/llms-full.txt

## Prices (final, VAT included / IVA incluido)
- Hardcover: ${eur(BOOK_FORMATS.hardcover.priceCents)} IVA incluido, free shipping, PDF included
- Softcover: ${eur(BOOK_FORMATS.softcover.priceCents)} IVA incluido, free shipping, PDF included
- PDF only: ${eur(BOOK_FORMATS.digital_pdf.priceCents)} IVA incluido, emailed after payment (normally in under ${PDF_DELIVERY_MAX_MINUTES} minutes)
- Creating the book and its preview is free and needs no account.
- Payment by card through Stripe.

## The book
- Size ${BOOK_SIZE_CM} x ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} pages, ${BOOK_SCENES} illustrated scenes, ${BOOK_PAPER_GSM} g silk coated paper, matte laminated cover
- Personalised: name, look (skin, hair, eyes, glasses, freckles), dedication and the 3 chapters of the story
- Ages ${AGE_MIN} to ${AGE_MAX}; age bands ${AGE_BANDS.map((b) => `${b.min}-${b.max}`).join(", ")}. Each story world has its own age range.
- Languages: Spanish, Catalan, English, French
- No photo of the child is needed: the portrait is painted from the traits the parent picks (skin, hair, eyes, glasses, freckles).${photoUpload ? ` An optional photo, with parental consent, is used only to paint the portrait and deleted within ${PHOTO_MAX_AGE_HOURS} hours; the book never uses it.` : ""}

## Delivery
- Ships to mainland Spain and the Balearic Islands only. Not to the Canary Islands, Ceuta or Melilla (the PDF works anywhere).
- Printed books arrive in ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} business days, shipping included, with tracking by email.
- Christmas ${season.christmasYear}: order the printed book by ${longDate(christmasCutoff)} to have it home on 24 December; for Reyes (home by 5 January) by ${longDate(reyesCutoff)}. The PDF is on time even on 5 January. Live dates: ${es(CHRISTMAS_DELIVERY_PATH)}

## Returns
- Personalised goods are excluded from the EU right of withdrawal (Spain, art. 103 c LGDCU): no returns.
- A book with a print defect or damaged in transit is reprinted free if reported within ${DEFECT_CLAIM_DAYS} days of delivery.

## Key pages
- What Meapica is (facts sheet): ${es(GUIDES.about.path)}
- Home (es): ${SITE_URL}/es · Catalan: ${SITE_URL}/ca · English: ${SITE_URL}/en · French: ${SITE_URL}/fr
- Real example books: ${es("/examples")}
- Gifts by occasion: ${es(seoHubPath("gifts"))} (${SEO_GIFT_SLUGS.map((s) => es(seoPath("gifts", s))).slice(0, 3).join(", ")}, ...)
- Books by age: ${es(seoHubPath("ages"))}
- Books by theme: ${es(seoHubPath("themes"))} (${SEO_THEME_SLUGS.length} themes)
- Delivery deadlines for Christmas and Reyes: ${es(CHRISTMAS_DELIVERY_PATH)}
- Free printables, Spanish and Catalan only (A4 PDF, no sign-up, nothing stored): letter to the Three Kings with the child's name and portrait ${es(toolPath("letter"))}, reply from the Three Kings ${es(toolPath("reply"))}; Catalan: ${SITE_URL}/ca${TOOLS_HUB_PATH}
- Books written natively in Catalan (not translated): ${SITE_URL}/ca${GUIDES.catalan.path} (Spanish page: ${es(GUIDES.catalan.path)})
- Catalan only: a personalised book as the Tió de Nadal gift ${SITE_URL}/ca${GUIDES.tio.path}; Catalan books by age and reading stage ${SITE_URL}/ca${GUIDES.catalanAges.path}
- How the watercolour portrait is built from the traits the parent picks: ${es(GUIDES.likeness.path)}
- Dated, sourced comparison with other personalised-book brands sold in Spain: ${es(GUIDES.compare.path)}
- Terms, shipping, returns and FAQ: ${es("/legal")}
- Blog: ${es("/blog")}

## Contact
- ${CONTACT_EMAIL}
- ${CONTACT_PHONE}
`;
}

// ── /llms-full.txt ──────────────────────────────────────────────────────────

type PageText = {
  h1: string;
  lead: string;
  sections: GuideSection[];
  faq: GuideFaq[];
};

const FAQ_HEADING: Record<string, string> = { es: "Preguntas frecuentes", ca: "Preguntes freqüents" };

/** Absolute links: the file is read outside the site. */
const absolute = (md: string, locale: string) =>
  md.replace(/\]\(\/(?!\/)/g, `](${SITE_URL}/`).replace(/\]\(#/g, `](${SITE_URL}/${locale}#`);

function guideText(id: GuideId, locale: string, copy: PageText, extra: string[] = []): string {
  const url = `${SITE_URL}/${locale}${GUIDES[id].path}`;
  const out = [`## ${copy.h1}`, "", `URL: ${url} · Language: ${locale} · Updated: ${guideUpdated(id)} · Author: ${FOUNDER.name}`, "", copy.lead, ""];
  out.push(...extra);
  for (const s of copy.sections) {
    out.push(`### ${s.heading}`, "", ...s.paragraphs.flatMap((p) => [p, ""]));
    if (s.link) out.push(`${s.link.label}: ${SITE_URL}/${locale}${s.link.href}`, "");
  }
  if (copy.faq.length > 0) {
    out.push(`### ${FAQ_HEADING[locale] ?? FAQ_HEADING.es}`, "");
    for (const q of copy.faq) out.push(`**${q.question}**`, q.answer, "");
  }
  return out.join("\n");
}

function compareTable(copy: CompareGuideCopy): string[] {
  const lang = copy.langKey;
  const out = [`### ${copy.tableHeading} (${copy.checkedLabel})`, ""];
  for (const row of COMPARE_ROWS) {
    out.push(`- ${copy.rowLabels[row]}: Meapica: ${copy.meapica[row]}; ${COMPARE_BRANDS.map((b) => `${b.name}: ${b.cells[row].text[lang]}`).join("; ")}`);
  }
  out.push("", ...copy.tableNotes.map((n) => `- ${n}`), "", `Sources (official sites, read on ${COMPARE_CHECKED_ON}):`);
  COMPARE_SOURCES.forEach((s, i) => out.push(`${i + 1}. ${s.brand}, ${s.what[lang]}: ${s.url}`));
  out.push("");
  return out;
}

async function blogText(locale: string): Promise<string[]> {
  const metas = await getPublishedPosts(locale);
  const posts = await Promise.all(metas.map((m) => getPost(locale, m.slug)));
  return posts
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) =>
      [
        `## ${p.title}`,
        "",
        `URL: ${SITE_URL}/${locale}/blog/${p.slug} · Language: ${locale} · Published: ${p.publishedAt?.slice(0, 10) ?? "n/a"} · Updated: ${p.updatedAt?.slice(0, 10) ?? "n/a"} · Author: ${p.author}`,
        "",
        // Post headings start at h2: push them one level down under the post title.
        absolute(p.bodyMarkdown.trim(), locale).replace(/^(#{1,5}) /gm, "#$1 "),
        "",
      ].join("\n"),
    );
}

/** Same rule as the likeness page: its "no photo" paragraph and FAQ only while photo upload is off. */
function withNoPhoto(copy: LikenessGuideCopy): PageText {
  const [first, second, ...rest] = copy.sections;
  return {
    ...copy,
    sections: [first, { ...second, paragraphs: [...second.paragraphs, copy.noPhoto.paragraph] }, ...rest],
    faq: [...copy.faq.slice(0, 2), copy.noPhoto.faq, ...copy.faq.slice(2)],
  };
}

/**
 * /llms-full.txt: the brief, then the full text of the facts sheet, the guides and the
 * blog (Spanish editions; Catalan for the Catalan-only pages), as Markdown.
 */
export async function llmsFull(): Promise<string> {
  const photoUpload = isPhotoUploadEnabled();
  const esFacts = guideFacts("es");
  const caFacts = guideFacts("ca");

  const about = ABOUT_GUIDE_COPY.es(esFacts, { photoUpload });
  const likeness = LIKENESS_GUIDE_COPY.es(esFacts, PREVIEW_SCENES);
  const compare = COMPARE_GUIDE_COPY.es(esFacts, PREVIEW_SCENES);

  const pages = [
    guideText("about", "es", about, [...about.facts.map((f) => `- **${f.term}**: ${f.value}`), ""]),
    guideText("catalan", "es", CATALAN_GUIDE_COPY.es(esFacts)),
    guideText("likeness", "es", photoUpload ? likeness : withNoPhoto(likeness)),
    guideText("compare", "es", compare, compareTable(compare)),
    guideText("tio", "ca", TIO_GUIDE_COPY.ca(caFacts, PREVIEW_SCENES)),
    guideText("catalanAges", "ca", CATALAN_AGES_GUIDE_COPY.ca(caFacts, PREVIEW_SCENES)),
  ];

  let blog: string[] = [];
  try {
    blog = await blogText("es");
  } catch {
    // The blog is a bonus: the file stands without it.
  }

  return [
    llmsBrief().trimEnd(),
    "",
    "# Full text",
    "",
    "The pages below are copied from the site (the page copy is the source). Prices are final, VAT included (IVA incluido).",
    "",
    ...pages,
    ...(blog.length > 0 ? ["# Blog", "", ...blog] : []),
  ].join("\n");
}
