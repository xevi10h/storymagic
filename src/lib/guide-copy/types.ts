// Copy shapes of the guide pages (src/lib/guides.ts). Copy lives in typed modules
// (one per page, written natively per locale, not translated) instead of the
// message files: each page has its own long-form text and only exists in some
// locales. Facts are interpolated from product-facts.ts, never hardcoded.

import type { factParams } from "@/lib/product-facts";

export type GuideFacts = ReturnType<typeof factParams> & {
  /** This season's printed-book Reyes cut-off, e.g. "22 de diciembre". */
  reyesDate: string;
  /** This season's printed-book cut-off to have it home on 24 December. */
  christmasDate: string;
};

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  /** Optional internal link under the paragraphs (locale-less path). */
  link?: { href: string; label: string };
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideBaseCopy {
  metaTitle: string;
  metaDescription: string;
  /** Short name of the page (breadcrumb, OG eyebrow). */
  breadcrumb: string;
  eyebrow: string;
  h1: string;
  lead: string;
  cta: string;
  ctaNote?: string;
  trust: string[];
  sections: GuideSection[];
  faq: GuideFaq[];
  relatedHeading: string;
  /** Closing band, where the landing FinalCta does not fit. */
  closing?: { eyebrow: string; heading: string; text: string };
}
