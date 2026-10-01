import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Heading, buttonClass } from "@/components/ui";
import { COPY_PARAMS } from "@/lib/product-facts";
import { LANDING_EXAMPLE, landingExampleBook } from "./HowItWorksExample";

const POINTS = ["written", "painted", "colour", "dedication"] as const;

/**
 * The differentiator, with proof: not a template with a face pasted in. Four
 * real pages of one child's book (Noa) show the same child painted scene by
 * scene, next to the four things that make the book theirs.
 */
export default function UniqueEdition() {
  const t = useTranslations("uniqueEdition");
  const name = LANDING_EXAMPLE.childName;
  const book = landingExampleBook(useLocale());

  return (
    <section id="unique-edition" aria-labelledby="unique-edition-title" className="scroll-mt-[var(--landing-nav-h,64px)] border-y border-line bg-surface py-16 sm:py-24">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-x-16 lg:gap-y-8">
        <Heading
          size="page"
          as="h2"
          id="unique-edition-title"
          eyebrow={t("eyebrow")}
          subtitle={t("subtitle", { name, age: LANDING_EXAMPLE.age, gender: LANDING_EXAMPLE.gender })}
          className="lg:col-start-2 lg:row-start-1 lg:self-end [&_h2]:text-balance"
        >
          {t("title")}
        </Heading>

        <figure className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-2 lg:gap-3">
            {LANDING_EXAMPLE.scenes.map((scene, i) => (
              <li
                key={scene.src}
                className="relative aspect-square w-[42%] shrink-0 snap-start overflow-hidden rounded-2xl border-2 border-line bg-surface sm:w-auto"
              >
                <Image
                  src={scene.src}
                  alt={t("sceneAlt", { name, n: i + 1 })}
                  fill
                  sizes="(min-width: 1024px) 300px, (min-width: 640px) 25vw, 42vw"
                  className="object-contain p-1.5"
                />
              </li>
            ))}
          </ul>
          <figcaption className="mt-2.5 text-xs text-ink-muted">
            {t("caption", { title: book.title })}
          </figcaption>
        </figure>

        <div className="lg:col-start-2 lg:row-start-2 lg:self-start">
          <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {POINTS.map((id) => (
              <li key={id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                </span>
                <div>
                  <h3 className="font-display text-base font-bold leading-tight text-ink">{t(`points.${id}.title`)}</h3>
                  <p className="mt-0.5 text-sm leading-snug text-ink-body">{t(`points.${id}.text`, COPY_PARAMS)}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            {/* Phones already have the sticky "Crear su libro" bar: one CTA per viewport. */}
            <Link href="/create" className={buttonClass({ size: "md", className: "max-sm:hidden" })}>
              {t("cta")}
              <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </Link>
            <Link
              href={`/examples/${book.storyId}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline decoration-ink-soft/30 underline-offset-2 hover:text-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {t("seeInside", { name, gender: LANDING_EXAMPLE.gender })}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
