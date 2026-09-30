import Image from "next/image";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LiveCover from "@/components/crear/LiveCover";
import { BookMockup } from "@/components/book-mockup";
import { Heading, buttonClass } from "@/components/ui";
import { AVATAR_SKIN_TONES } from "@/lib/avatar/manifest";
import { LANDING_EXAMPLE, landingExampleBook } from "./HowItWorksExample";

// Screen 2 offers "Sube una foto" only behind this flag (docs/user-experience.md).
const PHOTO_UPLOAD_ENABLED = process.env.NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED === "true";

// Chapter-1 art of the candy world, exactly as shown on screen 3 (Aventura).
const ADVENTURE_CHOICES = ["candy-c1-bridge", "candy-c1-gummy", "candy-c1-jar"] as const;
const CHOSEN_ADVENTURE = 1;

type StepId = "name" | "look" | "adventure" | "preview" | "print";

/**
 * "Cómo funciona": the real creation flow (/crear) in five cards, each with the
 * product's own art following one example child (Sam, a real showcase book).
 * Mobile/tablet: horizontal snap carousel; desktop: 5-column grid.
 */
export default function HowItWorks() {
  const t = useTranslations("howItWorks");
  const name = LANDING_EXAMPLE.childName;
  const book = landingExampleBook(useLocale());

  const visuals: Record<StepId, ReactNode> = {
    name: (
      <div className="flex w-full flex-col items-center gap-2.5 px-6">
        <div
          aria-hidden
          className="flex h-9 w-full max-w-[180px] items-center rounded-xl border-2 border-brand bg-surface px-3 font-display text-lg font-bold text-ink"
        >
          {name}
          <span className="ml-0.5 h-5 w-0.5 animate-pulse bg-brand motion-reduce:animate-none" />
        </div>
        <div className="w-[112px]">
          <LiveCover name={name} templateId={LANDING_EXAMPLE.templateId} sizes="112px" />
        </div>
      </div>
    ),
    look: (
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-[108px] overflow-hidden rounded-full bg-line shadow-portrait ring-4 ring-white">
          <Image
            src={LANDING_EXAMPLE.avatarSrc}
            alt={t("lookAlt", { name })}
            fill
            sizes="146px"
            className="scale-[1.35] object-cover object-[50%_42%]"
          />
        </div>
        <div aria-hidden className="flex gap-1.5">
          {AVATAR_SKIN_TONES.map((tone) => (
            <span
              key={tone.id}
              className={
                tone.id === LANDING_EXAMPLE.skinTone
                  ? "size-5 rounded-full ring-2 ring-brand ring-offset-2 ring-offset-paper"
                  : "size-5 rounded-full"
              }
              style={{ backgroundColor: tone.hex }}
            />
          ))}
        </div>
      </div>
    ),
    adventure: (
      <div aria-hidden className="flex w-full flex-col gap-1.5 px-5">
        {ADVENTURE_CHOICES.map((id, i) => (
          <div
            key={id}
            className={
              i === CHOSEN_ADVENTURE
                ? "relative h-[46px] overflow-hidden rounded-xl border-2 border-brand"
                : "relative h-[46px] overflow-hidden rounded-xl border-2 border-line opacity-70"
            }
          >
            <Image src={`/images/path/candy/${id}.webp`} alt="" fill sizes="240px" className="object-cover" />
            {i === CHOSEN_ADVENTURE && (
              <span className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white">
                <span className="material-symbols-outlined text-base">check</span>
              </span>
            )}
          </div>
        ))}
      </div>
    ),
    preview: (
      <div className="relative w-full px-5">
        <div className="relative aspect-[2/1] overflow-hidden rounded-lg bg-surface shadow-book">
          <Image
            src={LANDING_EXAMPLE.previewScene}
            alt={t("previewAlt", { name })}
            fill
            sizes="(min-width: 1024px) 200px, 260px"
            className="object-cover"
          />
          {/* Gutter of the open book */}
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        </div>
        <span className="absolute -top-2.5 right-3 rounded-full bg-brand-deep px-2.5 py-0.5 text-[11px] font-bold text-white">
          {t("previewBadge")}
        </span>
      </div>
    ),
    print: (
      <BookMockup
        coverUrl={LANDING_EXAMPLE.coverSrc}
        title={book.title}
        childName={name}
        format="hardcover"
        alt={t("printAlt", { name })}
        showScale={false}
        interactive={false}
        className="w-[210px]"
      />
    ),
  };

  const steps: { id: StepId; text: string }[] = [
    { id: "name", text: t("steps.name.text") },
    { id: "look", text: t(PHOTO_UPLOAD_ENABLED ? "steps.look.textPhoto" : "steps.look.text") },
    { id: "adventure", text: t("steps.adventure.text") },
    { id: "preview", text: t("steps.preview.text") },
    { id: "print", text: t("steps.print.text") },
  ];

  return (
    <section id="manifesto" aria-labelledby="how-it-works-title" className="scroll-mt-[var(--landing-nav-h,64px)] border-y border-line bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <Heading
          size="page"
          as="h2"
          id="how-it-works-title"
          eyebrow={t("eyebrow")}
          subtitle={t("subtitle")}
          className="text-balance sm:text-center [&_h2]:text-balance"
        >
          {t("title")}
        </Heading>

        <ol
          aria-label={t("stepsLabel")}
          className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:mt-10 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0"
        >
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="relative flex w-[78%] max-w-[290px] shrink-0 snap-start flex-col rounded-2xl border-2 border-line bg-surface lg:w-auto lg:max-w-none"
            >
              <div className="flex h-[168px] items-center justify-center overflow-hidden rounded-t-[14px] bg-paper">
                {visuals[step.id]}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <h3 className="flex items-center gap-2 font-display text-base font-bold leading-tight text-ink">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="sr-only">{t("stepNumber", { n: i + 1 })} </span>
                  {t(`steps.${step.id}.title`)}
                </h3>
                <p className="text-sm leading-snug text-ink-body">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 hidden justify-center lg:flex">
          <Link href="/crear" className={buttonClass({ size: "md" })}>
            {t("cta")}
            <span aria-hidden className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
