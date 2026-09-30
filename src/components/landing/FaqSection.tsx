import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Heading } from "@/components/ui";
import { FAQJsonLd } from "@/components/seo/JsonLd";
import { PRICING, SUPPORT_EMAIL, formatPrice } from "@/lib/pricing";
import { CHRISTMAS_DELIVERY_PATH, formatDeadlines, spainToday, type SeasonOccasion } from "@/lib/shipping";
import FaqItem from "./FaqItem";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };

/** Earliest still-open printed cut-off for an occasion this season (same logic as /christmas-delivery), or null if closed. */
function openCutoff(today: string, occasion: SeasonOccasion): string | null {
  const open = (["hardcover", "softcover"] as const)
    .flatMap((f) => formatDeadlines(today, f, occasion))
    .filter((d) => d.open)
    .map((d) => d.lastOrderDate)
    .sort();
  return open[0] ?? null;
}

/**
 * Landing FAQ, ordered by what blocks a gift purchase: seeing it before paying,
 * likeness, delivery (Reyes), price, returns, then the book itself. Every answer is
 * backed by the product: preview flow, shipping.ts cut-offs, pricing.ts, the Terms.
 * The same list feeds the FAQPage JSON-LD so markup and page never drift.
 */
export default function FaqSection() {
  const t = useTranslations("landingFaq");
  const tl = useTranslations("legal");
  const locale = useLocale();

  const date = (d: string) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const today = spainToday();
  const christmas = openCutoff(today, "christmas");
  const reyes = openCutoff(today, "reyes");
  const season =
    christmas && reyes
      ? t("deliverySeason", { christmasDate: date(christmas), reyesDate: date(reyes) })
      : reyes
        ? t("deliverySeasonReyes", { reyesDate: date(reyes) })
        : t("deliverySeasonPdf");

  const price = (cents: number) => formatPrice(cents, locale);

  const items: { id: string; question: string; answer: string; extra?: ReactNode }[] = [
    { id: "preview", question: t("previewQ"), answer: t("previewA") },
    { id: "likeness", question: t("likenessQ"), answer: t("likenessA") },
    {
      id: "delivery",
      question: t("deliveryQ"),
      answer: `${t("deliveryA")} ${season}`,
      extra: (
        <Link
          href={CHRISTMAS_DELIVERY_PATH}
          className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-ink-soft underline decoration-brand/30 underline-offset-2 transition-colors hover:text-brand-text"
        >
          {t("deliveryDatesLink")}
          <span aria-hidden className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
        </Link>
      ),
    },
    {
      id: "price",
      question: t("priceQ"),
      answer: t("priceA", {
        softcover: price(PRICING.softcover.price),
        hardcover: price(PRICING.hardcover.price),
        pdf: price(PRICING.digital_pdf.price),
      }),
    },
    { id: "returns", question: t("returnsQ"), answer: t("returnsA") },
    { id: "paper", question: tl("faq.section4Title"), answer: tl("faq.section4Text") },
    { id: "size", question: tl("faq.section6Title"), answer: tl("faq.section6Text") },
  ];

  return (
    <section className="scroll-mt-[var(--landing-nav-h,64px)] border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24" id="faq" aria-labelledby="faq-title">
      <FAQJsonLd questions={items.map(({ question, answer }) => ({ question, answer }))} />
      <div className="mx-auto max-w-3xl">
        <Heading id="faq-title" size="page" as="h2" eyebrow={t("eyebrow")} subtitle={t("subtitle")} className="mb-8 text-balance text-center sm:mb-10">
          {t("title")}
        </Heading>

        <div className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
          {items.map((item) => (
            <FaqItem key={item.id} question={item.question} answer={item.answer}>
              {item.extra}
            </FaqItem>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          {t("moreQuestions")}{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex min-h-11 items-center font-semibold text-ink-soft underline decoration-brand/30 underline-offset-2 transition-colors hover:text-brand-text"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}
