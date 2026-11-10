import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Heading, buttonClass, cx } from "@/components/ui";
import { getTemplateConfig } from "@/lib/create-store";
import { PRICING, formatPrice } from "@/lib/pricing";
import { kicker } from "./MarketingHeader";

/** STORY_TEMPLATES id of the seasonal Reyes world ("Paje Real por una Noche"). */
export const REYES_TEMPLATE_ID = "reyes";

const INTL_LOCALE: Record<string, string> = { es: "es-ES", ca: "ca-ES", en: "en-GB", fr: "fr-FR" };
const PRINTED_FORMATS = ["hardcover", "softcover"] as const;

/**
 * The seasonal Reyes edition as a product on the Reyes gift page: the story, who it is
 * for, until when it can be ordered and the price of each printed format (VAT included).
 * Every fact comes from the catalogue (STORY_TEMPLATES, PRICING); the copy is
 * seo.gifts.three-kings.edition. The caller renders it only while the world is on sale
 * (isTemplateAvailable), so it disappears by itself the day after `availableUntil`.
 * It is also the landing page of the Reyes items in the Merchant feed (lib/merchant-feed.ts):
 * keep the story title and both printed prices visible here.
 */
export default async function ReyesEdition({ locale }: { locale: string }) {
  const template = getTemplateConfig(REYES_TEMPLATE_ID);
  if (!template) return null;
  const t = await getTranslations({ locale, namespace: "seo.gifts.three-kings.edition" });
  const td = await getTranslations({ locale, namespace: "data" });
  const tp = await getTranslations({ locale, namespace: "pricing" });
  const th = await getTranslations({ locale, namespace: "hero" });

  const title = td(`templates.${REYES_TEMPLATE_ID}.title`);
  const until = template.availableUntil
    ? new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
        new Date(`${template.availableUntil}T00:00:00Z`),
      )
    : null;

  return (
    <section id="reyes-edition" aria-labelledby="reyes-edition-title" className="border-t border-line bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-[1200px] items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-2xl border-2 border-line bg-line md:max-w-none">
          <Image src={template.image} alt={t("imageAlt", { title })} fill sizes="(max-width: 768px) 300px, 480px" className="object-cover" />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-ink-soft shadow-sm tabular-nums">
            {td("ageRange", { min: template.ageMin, max: template.ageMax })}
          </span>
        </div>

        <div>
          <p className={kicker}>{t("kicker")}</p>
          <Heading id="reyes-edition-title" as="h2" size="page" className="mt-2 text-balance">
            {t("heading", { title })}
          </Heading>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">{t("text")}</p>

          <dl className="mt-6 grid max-w-md grid-cols-2 gap-3">
            {PRINTED_FORMATS.map((format) => (
              <div key={format} className="rounded-2xl border-2 border-line bg-surface px-4 py-3">
                <dt className="text-sm font-semibold text-ink-soft">{tp(`${format}.label`)}</dt>
                <dd className="mt-0.5">
                  <span className="font-display text-xl font-bold tabular-nums text-brand-deep">{formatPrice(PRICING[format].price, locale)}</span>
                  <span className="block text-xs text-ink-muted">{tp("vatIncluded")}</span>
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-5 flex flex-col gap-2 text-sm text-ink-soft">
            {[until ? t("until", { date: until }) : null, th("freeShipping"), th("trustPreview")].filter(Boolean).map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span aria-hidden className="material-symbols-outlined !text-xl shrink-0 text-brand" data-icon="check_circle" />
                {line}
              </li>
            ))}
          </ul>

          <Link
            href={`/create?template=${REYES_TEMPLATE_ID}&from=seo`}
            className={cx(buttonClass({ className: "mt-7 min-h-14 w-full sm:w-auto sm:px-8" }))}
          >
            {t("cta")}
            <span aria-hidden className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1" data-icon="arrow_forward" />
          </Link>
        </div>
      </div>
    </section>
  );
}
