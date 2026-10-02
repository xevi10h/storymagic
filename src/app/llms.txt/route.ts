// /llms.txt (llmstxt.org): a plain-text brief of what Meapica sells, for AI
// assistants and answer engines. Every fact comes from the same constants as the
// site copy and the JSON-LD (lib/product-facts.ts, lib/pricing.ts, lib/shipping.ts),
// so the brief can never drift from the product.

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
  DEFECT_CLAIM_DAYS,
  DELIVERY_BUSINESS_DAYS,
  PDF_DELIVERY_MAX_MINUTES,
  SITE_URL,
} from "@/lib/product-facts";
import { CHRISTMAS_DELIVERY_PATH, earliestPrintedCutoff, giftSeason, spainToday } from "@/lib/shipping";
import { SEO_GIFT_SLUGS, SEO_THEME_SLUGS, seoHubPath, seoPath } from "@/lib/seo-landing";
import { TOOLS_HUB_PATH, toolPath } from "@/lib/tools/registry";
import { GUIDES } from "@/lib/guides";

// Quotes this season's order-by dates: rebuild daily.
export const revalidate = 86400;

const eur = (cents: number) => formatPrice(cents, "es");

function longDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function body(): string {
  const today = spainToday();
  const season = giftSeason(today);
  const christmasCutoff = earliestPrintedCutoff(today, "christmas");
  const reyesCutoff = earliestPrintedCutoff(today, "reyes");
  const es = (path: string) => `${SITE_URL}/es${path}`;

  return `# Meapica

> Meapica makes personalised printed picture books for children aged ${AGE_MIN} to ${AGE_MAX}: the child's name on the cover and on every page, a watercolour portrait that looks like them, and an adventure whose chapters the parent chooses. You see the cover, the portrait and the first illustrated scenes of the child's own book before paying. Run from Barcelona, sold in Spain, printed on demand in Europe.

## Prices (final, VAT included / IVA incluido)
- Hardcover: ${eur(BOOK_FORMATS.hardcover.priceCents)} IVA incluido, free shipping, PDF included
- Softcover: ${eur(BOOK_FORMATS.softcover.priceCents)} IVA incluido, free shipping, PDF included
- PDF only: ${eur(BOOK_FORMATS.digital_pdf.priceCents)} IVA incluido, emailed after payment (normally in under ${PDF_DELIVERY_MAX_MINUTES} minutes)
- Creating the book and its preview is free and needs no account.

## The book
- Size ${BOOK_SIZE_CM} x ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} pages, ${BOOK_SCENES} illustrated scenes, ${BOOK_PAPER_GSM} g silk coated paper, matte laminated cover
- Personalised: name, look (skin, hair, eyes, glasses, freckles), dedication and the 3 chapters of the story
- Ages ${AGE_MIN} to ${AGE_MAX}; age bands ${AGE_BANDS.map((b) => `${b.min}-${b.max}`).join(", ")}. Each story world has its own age range.
- Languages: Spanish, Catalan, English, French

## Delivery
- Ships to mainland Spain and the Balearic Islands only. Not to the Canary Islands, Ceuta or Melilla (the PDF works anywhere).
- Printed books arrive in ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} business days, shipping included, with tracking by email.
- Christmas ${season.christmasYear}: order the printed book by ${longDate(christmasCutoff)} to have it home on 24 December; for Reyes (home by 5 January) by ${longDate(reyesCutoff)}. The PDF is on time even on 5 January. Live dates: ${es(CHRISTMAS_DELIVERY_PATH)}

## Returns
- Personalised goods are excluded from the EU right of withdrawal (Spain, art. 103 c LGDCU): no returns.
- A book with a print defect or damaged in transit is reprinted free if reported within ${DEFECT_CLAIM_DAYS} days of delivery.

## Key pages
- Home (es): ${SITE_URL}/es · Catalan: ${SITE_URL}/ca · English: ${SITE_URL}/en · French: ${SITE_URL}/fr
- Real example books: ${es("/examples")}
- Gifts by occasion: ${es(seoHubPath("gifts"))} (${SEO_GIFT_SLUGS.map((s) => es(seoPath("gifts", s))).slice(0, 3).join(", ")}, ...)
- Books by age: ${es(seoHubPath("ages"))}
- Books by theme: ${es(seoHubPath("themes"))} (${SEO_THEME_SLUGS.length} themes)
- Delivery deadlines for Christmas and Reyes: ${es(CHRISTMAS_DELIVERY_PATH)}
- Free printables, Spanish and Catalan only (A4 PDF, no sign-up, nothing stored): letter to the Three Kings with the child's name and portrait ${es(toolPath("letter"))}, reply from the Three Kings ${es(toolPath("reply"))}; Catalan: ${SITE_URL}/ca${TOOLS_HUB_PATH}
- Books written natively in Catalan (not translated): ${SITE_URL}/ca${GUIDES.catalan.path} (Spanish page: ${es(GUIDES.catalan.path)})
- How the watercolour portrait is built from the traits the parent picks: ${es(GUIDES.likeness.path)}
- Dated, sourced comparison with other personalised-book brands sold in Spain: ${es(GUIDES.compare.path)}
- Terms, shipping, returns and FAQ: ${es("/legal")}
- Blog: ${es("/blog")}

## Contact
- ${CONTACT_EMAIL}
`;
}

export function GET() {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
