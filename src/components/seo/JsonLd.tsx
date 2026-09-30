import { PRICING } from "@/lib/pricing";

const BASE_URL = "https://meapica.shop";

/**
 * Organization + WebSite structured data for the landing page.
 * Renders a <script type="application/ld+json"> tag with schema.org markup.
 */
export function OrganizationJsonLd({ locale }: { locale: string }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "Meapica",
        url: BASE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${BASE_URL}/images/icon-512.png`,
          width: 512,
          height: 512,
        },
        sameAs: [],
        description:
          "Personalized illustrated children's books printed on premium paper.",
      },
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        url: BASE_URL,
        name: "Meapica",
        publisher: { "@id": `${BASE_URL}/#organization` },
        inLanguage: ["es", "ca", "en", "fr"],
      },
      {
        "@type": "WebPage",
        "@id": `${BASE_URL}/${locale}/#webpage`,
        url: `${BASE_URL}/${locale}`,
        name: "Meapica",
        isPartOf: { "@id": `${BASE_URL}/#website` },
        about: { "@id": `${BASE_URL}/#organization` },
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

/**
 * Product structured data for the landing page.
 * Shows the book as a Product with pricing, enabling rich snippets in Google.
 */
export type ProductReview = { author: string; text: string; rating?: number };

export function ProductJsonLd({
  locale,
  reviews,
}: {
  locale: string;
  /**
   * Real customer reviews. ONLY pass genuine, verifiable reviews — emitting
   * Review/AggregateRating markup with fabricated testimonials violates Google's
   * structured-data policy (manual action) and EU/Spanish consumer law (fake
   * reviews are illegal). Leave undefined until real reviews exist; the markup
   * then activates automatically with no further changes.
   */
  reviews?: ProductReview[];
}) {
  const localizedNames: Record<string, string> = {
    es: "Cuento personalizado para niños",
    ca: "Conte personalitzat per a nens",
    en: "Personalized children's book",
    fr: "Livre personnalisé pour enfants",
  };

  const localizedDescriptions: Record<string, string> = {
    es: "Cuento infantil personalizado con el nombre y características de tu hijo. Impreso en papel de alta calidad con ilustraciones únicas.",
    ca: "Conte infantil personalitzat amb el nom i les característiques del teu fill. Imprès en paper d'alta qualitat amb il·lustracions úniques.",
    en: "Personalized children's book featuring your child's name and characteristics. Printed on premium paper with unique illustrations.",
    fr: "Conte personnalisé avec le nom et les caractéristiques de votre enfant. Imprimé sur du papier de haute qualité avec des illustrations uniques.",
  };

  const softcoverPrice = (PRICING.softcover.price / 100).toFixed(2);
  const hardcoverPrice = (PRICING.hardcover.price / 100).toFixed(2);

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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: localizedNames[locale] || localizedNames.es,
    description: localizedDescriptions[locale] || localizedDescriptions.es,
    image: `${BASE_URL}/images/icon-512.png`,
    brand: {
      "@type": "Brand",
      name: "Meapica",
    },
    aggregateRating,
    review,
    offers: [
      {
        "@type": "Offer",
        name: "Softcover",
        price: softcoverPrice,
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "PriceSpecification",
          price: softcoverPrice,
          priceCurrency: "EUR",
          valueAddedTaxIncluded: true,
        },
        availability: "https://schema.org/InStock",
        url: `${BASE_URL}/${locale}/crear`,
      },
      {
        "@type": "Offer",
        name: "Hardcover",
        price: hardcoverPrice,
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "PriceSpecification",
          price: hardcoverPrice,
          priceCurrency: "EUR",
          valueAddedTaxIncluded: true,
        },
        availability: "https://schema.org/InStock",
        url: `${BASE_URL}/${locale}/crear`,
      },
    ],
    category: "Personalized Children's Books",
    audience: {
      "@type": "PeopleAudience",
      suggestedMinAge: "0",
      suggestedMaxAge: "12",
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
