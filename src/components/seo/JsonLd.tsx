import { STORY_TEMPLATES } from "@/lib/create-store";
import {
  AGE_MAX,
  AGE_MIN,
  BOOK_FORMATS,
  BOOK_INNER_PAGES,
  BOOK_LANGUAGES,
  BOOK_PAPER_GSM,
  BOOK_SCENES,
  BOOK_SIZE_CM,
  BRAND_NAME,
  CONTACT_EMAIL,
  DEFECT_CLAIM_DAYS,
  DELIVERY_BUSINESS_DAYS,
  HANDLING_BUSINESS_DAYS,
  SHIPPING_COST_CENTS,
  SHIPPING_POSTCODE_RANGES,
  SITE_URL,
  SOCIAL_PROFILES,
  TRANSIT_BUSINESS_DAYS,
} from "@/lib/product-facts";
import { getShowcaseStories } from "@/lib/showcase";

const BASE_URL = SITE_URL;
const ORG_ID = `${BASE_URL}/#organization`;

type Loc = "es" | "ca" | "en" | "fr";
const asLoc = (locale: string): Loc => (locale === "ca" || locale === "en" || locale === "fr" ? locale : "es");

/** Merchant return policy (legal.terms.section5): personalised goods, defects reprinted free. */
function returnPolicy(locale: string) {
  const description: Record<Loc, string> = {
    es: `Libro personalizado: excluido del derecho de desistimiento (art. 103 c LGDCU), no admite devoluciones. Si llega con un defecto de impresión o dañado en el envío, avísanos en los ${DEFECT_CLAIM_DAYS} días siguientes y te enviamos otro sin coste.`,
    ca: `Llibre personalitzat: exclòs del dret de desistiment (art. 103 c LGDCU), no admet devolucions. Si arriba amb un defecte d'impressió o malmès en l'enviament, avisa'ns en els ${DEFECT_CLAIM_DAYS} dies següents i te n'enviem un altre sense cost.`,
    en: `Personalised book: exempt from the right of withdrawal (art. 103 c LGDCU), no returns. If it arrives with a print defect or damaged in transit, tell us within ${DEFECT_CLAIM_DAYS} days and we send a new one free of charge.`,
    fr: `Livre personnalisé : exclu du droit de rétractation (art. 103 c LGDCU), pas de retours. S'il arrive avec un défaut d'impression ou abîmé pendant le transport, prévenez-nous dans les ${DEFECT_CLAIM_DAYS} jours et nous en envoyons un nouveau sans frais.`,
  };
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "ES",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    merchantReturnLink: `${BASE_URL}/${locale}/legal`,
    description: description[asLoc(locale)],
  };
}

const qv = (r: { min: number; max: number }) => ({ "@type": "QuantitativeValue", minValue: r.min, maxValue: r.max, unitCode: "DAY" });
const BUSINESS_DAYS = {
  "@type": "OpeningHoursSpecification",
  dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => `https://schema.org/${d}`),
};

/** Free shipping to Spain. Printed: handling (Gelato print) + carrier transit = the 7-10 day promise. Digital: instant. */
function shippingDetails(printed: boolean) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: printed ? SHIPPING_COST_CENTS / 100 : 0, currency: "EUR" },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "ES",
      ...(printed
        ? {
            // Peninsula + Balearics (excludes Canarias, Ceuta, Melilla).
            postalCodeRange: SHIPPING_POSTCODE_RANGES.map((r) => ({
              "@type": "PostalCodeRangeSpecification",
              postalCodeBegin: r.begin,
              postalCodeEnd: r.end,
            })),
          }
        : {}),
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: qv(printed ? HANDLING_BUSINESS_DAYS : { min: 0, max: 0 }),
      transitTime: qv(printed ? TRANSIT_BUSINESS_DAYS : { min: 0, max: 0 }),
      businessDays: BUSINESS_DAYS,
    },
  };
}

/**
 * Organization + WebSite structured data for the landing page.
 * Renders a <script type="application/ld+json"> tag with schema.org markup.
 */
export function OrganizationJsonLd({ locale }: { locale: string }) {
  const description: Record<Loc, string> = {
    es: "Cuentos infantiles personalizados con el nombre y el retrato a acuarela del niño, impresos bajo demanda en Europa y enviados a España.",
    ca: "Contes infantils personalitzats amb el nom i el retrat a aquarel·la de l'infant, impresos sota demanda a Europa i enviats a Espanya.",
    en: "Personalised children's books with the child's name and watercolour portrait, printed on demand in Europe and shipped within Spain.",
    fr: "Livres pour enfants personnalisés avec le prénom et le portrait à l'aquarelle de l'enfant, imprimés à la demande en Europe et livrés en Espagne.",
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: BRAND_NAME,
        url: BASE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${BASE_URL}/images/icon-512.png`,
          width: 512,
          height: 512,
        },
        email: CONTACT_EMAIL,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT_EMAIL,
          availableLanguage: ["es", "ca", "en", "fr"],
        },
        address: { "@type": "PostalAddress", addressLocality: "Barcelona", addressCountry: "ES" },
        areaServed: { "@type": "Country", name: "ES" },
        ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES } : {}),
        hasMerchantReturnPolicy: returnPolicy(locale),
        description: description[asLoc(locale)],
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        url: BASE_URL,
        name: BRAND_NAME,
        publisher: { "@id": ORG_ID },
        inLanguage: ["es", "ca", "en", "fr"],
      },
      {
        "@type": "WebPage",
        "@id": `${BASE_URL}/${locale}/#webpage`,
        url: `${BASE_URL}/${locale}`,
        name: BRAND_NAME,
        isPartOf: { "@id": `${BASE_URL}/#website` },
        about: { "@id": ORG_ID },
        inLanguage: locale,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/** Real book covers for the Product image: showcase books, falling back to the template cover art. */
async function productImages(locale: string): Promise<string[]> {
  let covers: string[] = [];
  try {
    covers = (await getShowcaseStories(locale, 6)).map((s) => s.coverImage).filter((u): u is string => Boolean(u));
  } catch {
    // Structured data must never break the page: fall back to static art.
  }
  const fallback = STORY_TEMPLATES.slice(0, 3).map((t) => `${BASE_URL}${t.image}`);
  return [...new Set([...covers, ...fallback])].slice(0, 6);
}

/**
 * Product structured data: the home and every programmatic SEO landing (gifts /
 * ages / themes) sell the same book, so they emit the same Product; only the
 * offers' `url` changes (the page carrying it). Offers for every format with the
 * final VAT-inclusive price (B2C), free shipping to Spain and the return policy.
 */
export type ProductReview = { author: string; text: string; rating?: number };

export async function ProductJsonLd({
  locale,
  url,
  reviews,
}: {
  locale: string;
  /** Indexable page that sells the book and carries this markup (default: the home). */
  url?: string;
  /**
   * Real customer reviews. ONLY pass genuine, verifiable reviews — emitting
   * Review/AggregateRating markup with fabricated testimonials violates Google's
   * structured-data policy (manual action) and EU/Spanish consumer law (fake
   * reviews are illegal). Leave undefined until real reviews exist; the markup
   * then activates automatically with no further changes.
   */
  reviews?: ProductReview[];
}) {
  const loc = asLoc(locale);
  const localizedNames: Record<Loc, string> = {
    es: "Cuento personalizado para niños",
    ca: "Conte personalitzat per a nens",
    en: "Personalised children's book",
    fr: "Livre personnalisé pour enfant",
  };

  const localizedDescriptions: Record<Loc, string> = {
    es: `Cuento infantil personalizado de ${AGE_MIN} a ${AGE_MAX} años: su nombre en la portada, su retrato a acuarela y la aventura que eliges. ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} páginas, ${BOOK_SCENES} escenas ilustradas, papel de ${BOOK_PAPER_GSM} g. Tapa dura, tapa blanda o PDF. Impreso en Europa, envío gratis a España peninsular y Baleares en ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} días laborables.`,
    ca: `Conte infantil personalitzat de ${AGE_MIN} a ${AGE_MAX} anys: el seu nom a la portada, el seu retrat a l'aquarel·la i l'aventura que tries. ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} pàgines, ${BOOK_SCENES} escenes il·lustrades, paper de ${BOOK_PAPER_GSM} g. Tapa dura, tapa tova o PDF. Imprès a Europa, enviament gratuït a l'Espanya peninsular i les Balears en ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} dies laborables.`,
    en: `Personalised children's book for ages ${AGE_MIN} to ${AGE_MAX}: their name on the cover, a watercolour portrait and the adventure you choose. ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} pages, ${BOOK_SCENES} illustrated scenes, ${BOOK_PAPER_GSM} g paper. Hardcover, softcover or PDF. Printed in Europe, free shipping to mainland Spain and the Balearic Islands in ${DELIVERY_BUSINESS_DAYS.min}-${DELIVERY_BUSINESS_DAYS.max} business days.`,
    fr: `Livre personnalisé pour enfant de ${AGE_MIN} à ${AGE_MAX} ans : son prénom sur la couverture, son portrait à l'aquarelle et l'aventure que vous choisissez. ${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm, ${BOOK_INNER_PAGES} pages, ${BOOK_SCENES} scènes illustrées, papier ${BOOK_PAPER_GSM} g. Couverture rigide, souple ou PDF. Imprimé en Europe, livraison offerte en Espagne péninsulaire et aux Baléares en ${DELIVERY_BUSINESS_DAYS.min} à ${DELIVERY_BUSINESS_DAYS.max} jours ouvrés.`,
  };

  const offerNames: Record<Loc, Record<keyof typeof BOOK_FORMATS, string>> = {
    es: { hardcover: "Tapa dura (incluye PDF)", softcover: "Tapa blanda (incluye PDF)", digital_pdf: "PDF digital" },
    ca: { hardcover: "Tapa dura (inclou PDF)", softcover: "Tapa tova (inclou PDF)", digital_pdf: "PDF digital" },
    en: { hardcover: "Hardcover (PDF included)", softcover: "Softcover (PDF included)", digital_pdf: "Digital PDF" },
    fr: { hardcover: "Couverture rigide (PDF inclus)", softcover: "Couverture souple (PDF inclus)", digital_pdf: "PDF numérique" },
  };

  const hasReviews = Array.isArray(reviews) && reviews.length > 0;
  const aggregateRating = hasReviews
    ? {
        "@type": "AggregateRating",
        ratingValue: (
          reviews!.reduce((sum, r) => sum + (r.rating ?? 5), 0) / reviews!.length
        ).toFixed(1),
        reviewCount: String(reviews!.length),
        bestRating: "5",
        worstRating: "1",
      }
    : undefined;
  const review = hasReviews
    ? reviews!.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(r.rating ?? 5),
          bestRating: "5",
        },
        reviewBody: r.text,
      }))
    : undefined;

  // The indexable page that sells the book (/create is noindex).
  const offerUrl = url ?? `${BASE_URL}/${locale}`;
  const policy = returnPolicy(locale);
  const offers = (Object.keys(BOOK_FORMATS) as (keyof typeof BOOK_FORMATS)[]).map((format) => {
    const { priceCents, printed } = BOOK_FORMATS[format];
    const price = (priceCents / 100).toFixed(2);
    return {
      "@type": "Offer",
      name: offerNames[loc][format],
      sku: `meapica-${format.replace("_", "-")}`,
      price,
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: "EUR",
        valueAddedTaxIncluded: true,
      },
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: offerUrl,
      seller: { "@id": ORG_ID },
      shippingDetails: shippingDetails(printed),
      hasMerchantReturnPolicy: policy,
    };
  });

  const property = (name: string, value: string | number) => ({ "@type": "PropertyValue", name, value });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localizedNames[loc],
    description: localizedDescriptions[loc],
    image: await productImages(locale),
    brand: { "@type": "Brand", name: BRAND_NAME },
    aggregateRating,
    review,
    offers,
    size: `${BOOK_SIZE_CM} × ${BOOK_SIZE_CM} cm`,
    additionalProperty: [
      property("pages", BOOK_INNER_PAGES),
      property("illustratedScenes", BOOK_SCENES),
      property("paperWeightGsm", BOOK_PAPER_GSM),
      property("languages", BOOK_LANGUAGES.join(", ")),
    ],
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: AGE_MIN,
      suggestedMaxAge: AGE_MAX,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * BreadcrumbList structured data — improves SERP navigation display.
 * `items` are ordered from home → current page; the last item is the page itself.
 */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * FAQ structured data for the legal page (specifically the FAQ section).
 */
export function FAQJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
