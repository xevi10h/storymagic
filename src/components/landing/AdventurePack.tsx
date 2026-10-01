import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClass, Card, Eyebrow } from "@/components/ui";

/**
 * Adventure Pack add-on teaser. Only rendered while ADDON_ENABLED.adventure_pack
 * is true (off today: no fulfilment pipeline yet, see src/lib/pricing.ts).
 */
export default function AdventurePack() {
  const t = useTranslations("adventurePack");

  return (
    <section className="bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <Card variant="elevated" className="mx-auto grid max-w-[1120px] items-center gap-8 p-5 sm:p-8 md:grid-cols-2 lg:gap-14 lg:p-12">
        <div className="text-center md:text-left">
          <Eyebrow tone="brand">{t("badge")}</Eyebrow>
          <h2 className="mt-2 text-balance font-display text-[28px] font-bold leading-tight text-ink sm:text-4xl">{t("title")}</h2>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-body sm:text-lg">
            {t("description")} <strong className="font-semibold text-ink">{t("letter")}</strong> {t("descriptionEnd")}
          </p>
          <Link href="/create" className={buttonClass({ variant: "secondary", className: "mt-8 max-w-full whitespace-normal text-center" })}>
            {t("cta")}
          </Link>
        </div>

        <figure className="order-first overflow-hidden rounded-2xl bg-line md:order-last">
          <Image
            alt={t("imageAlt")}
            className="aspect-square h-auto w-full object-cover"
            src="/images/gift-set.png"
            width={512}
            height={512}
            sizes="(max-width: 768px) 100vw, 520px"
          />
          <figcaption className="sr-only">{t("imageCaption")}</figcaption>
        </figure>
      </Card>
    </section>
  );
}
