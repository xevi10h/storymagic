import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { HollySprig, SeasonStar } from "./HollySprig";
import { Heading, cx, focusRing } from "@/components/ui";
import { getTemplateConfig, isTemplateAvailable } from "@/lib/create-store";
import { seoPath } from "@/lib/seo-landing";
import { CHRISTMAS_DELIVERY_PATH, earliestPrintedCutoff, seasonBanner, spainToday, type SeasonOccasion } from "@/lib/shipping";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };
const REYES_TEMPLATE_ID = "reyes";
/** Seasonal worlds featured here, in calendar order, with the night their printed book is for. */
const SEASON_WORLDS: { id: string; occasion: SeasonOccasion; isNew: boolean }[] = [
  { id: "christmas", occasion: "christmas", isNew: true },
  { id: "tio", occasion: "christmas", isNew: true },
  { id: REYES_TEMPLATE_ID, occasion: "reyes", isNew: false },
];

/** "10 de diciembre" for a YYYY-MM-DD date. */
function dayMonth(date: string, locale: string): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * ── CHRISTMAS / REYES 2026 HOME BLOCK: REMOVE IN JANUARY 2027 (docs/roadmap.md) ──────────
 * Seasonal section of the home: three links (Christmas book, Reyes book, delivery deadlines)
 * with this season's order-by dates. To remove it: delete its import and its one line in
 * src/app/[locale]/page.tsx, this file, and the `seo.home.season` messages (4 locales).
 *
 * Safe if forgotten: it renders nothing outside the gift season (1 Nov – 5 Jan, the same
 * window as the seasonal banner). Dates are never typed here: they come from lib/shipping.ts
 * (the same cut-offs /christmas-delivery shows) and the Reyes edition from STORY_TEMPLATES.
 * Server component; the home re-renders hourly (revalidate), so a passed cut-off flips to
 * the PDF line by itself.
 */
export default async function HomeSeasonBlock({ locale }: { locale: string }) {
  const today = spainToday();
  if (!seasonBanner(today)) return null;

  const t = await getTranslations({ locale, namespace: "seo.home.season" });
  const tcd = await getTranslations({ locale, namespace: "christmasDelivery" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const td = await getTranslations({ locale, namespace: "data" });

  const pdfLine = `${tp("digital_pdf.label")} · ${tcd("pdfAlwaysOnTime")}`;
  /** Printed order-by date of an occasion while it is still open, else the PDF line. */
  const status = (occasion: SeasonOccasion) => {
    const cutoff = earliestPrintedCutoff(today, occasion);
    return cutoff >= today ? tcd("orderBy", { date: dayMonth(cutoff, locale) }) : pdfLine;
  };

  const reyes = getTemplateConfig(REYES_TEMPLATE_ID);
  const reyesText =
    reyes && isTemplateAvailable(reyes, today) ? t("reyesText", { title: td(`templates.${REYES_TEMPLATE_ID}.title`) }) : t("reyesTextEvergreen");

  const worlds = SEASON_WORLDS.flatMap((w) => {
    const config = getTemplateConfig(w.id);
    return config && isTemplateAvailable(config, today) ? [{ ...w, image: config.image }] : [];
  });
  const tAdv = await getTranslations({ locale, namespace: "crear.adventure" });

  const cards = [
    { href: seoPath("gifts", "christmas"), kicker: tcd("occasion.christmas"), title: t("christmasTitle"), text: t("christmasText"), status: status("christmas") },
    { href: seoPath("gifts", "three-kings"), kicker: tcd("occasion.reyes"), title: t("reyesTitle"), text: reyesText, status: status("reyes") },
    { href: CHRISTMAS_DELIVERY_PATH, kicker: t("deliveryKicker"), title: t("deliveryTitle"), text: t("deliveryText"), status: pdfLine },
  ];

  return (
    <section id="season" aria-labelledby="season-title" className="border-y border-line bg-surface px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="relative">
          <HollySprig className="pointer-events-none absolute -top-6 right-0 hidden w-24 sm:block lg:w-28" />
          <Heading as="h2" id="season-title" size="page" eyebrow={t("kicker")} subtitle={t("intro")} className="max-w-2xl text-balance">
            {t("title")}
          </Heading>
        </div>

        {/* The season's story worlds, each opening the creation flow on its own world. */}
        {worlds.length > 0 && (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {worlds.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/create?template=${w.id}&from=home`}
                  className={cx("group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-line bg-paper transition-colors hover:border-brand/40", focusRing)}
                >
                  <span className="relative block aspect-[3/2] w-full bg-line">
                    <Image src={w.image} alt="" fill sizes="(max-width: 768px) 100vw, 380px" className="object-cover" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs font-bold text-season shadow-sm">
                      <SeasonStar className="h-3 w-3" />
                      {w.isNew ? tAdv("badgeNew") : tAdv("badgeSeason")}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col p-5">
                    <span className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold leading-tight text-ink text-balance sm:text-xl">{td(`templates.${w.id}.title`)}</h3>
                      <span
                        aria-hidden
                        className="material-symbols-outlined !text-xl shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-brand-text"
                        data-icon="arrow_forward"
                      />
                    </span>
                    <span className="mt-2 text-sm leading-snug text-ink-muted">{td(`templates.${w.id}.description`)}</span>
                    <span className="mt-auto pt-4">
                      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-bold text-success">{status(w.occasion)}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Gift guides and the delivery deadlines stay one tap away (internal links for search too). */}
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          {cards.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className={cx("text-brand-text underline decoration-brand-text/30 underline-offset-4 hover:decoration-brand-text", focusRing)}>
                {card.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
