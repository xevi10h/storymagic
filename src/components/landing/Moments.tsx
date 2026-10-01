"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import BrandLogo from "@/components/BrandLogo";
import LiveCover from "@/components/create/LiveCover";
import { deName, firstName } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import { useHeroName } from "./HeroNameStore";
import { LANDING_EXAMPLE } from "./HowItWorksExample";
import styles from "./Moments.module.css";

type MomentId = "firstLook" | "bedtime" | "keepsake";

/**
 * "Lo que de verdad le regalas": the emotional band of the landing (full-bleed, warm
 * night brown). Three true moments of the gift, each with real product art: the cover
 * with their name, bedtime ("otra vez"), and the dedication page the parent writes.
 * It follows the name typed in the hero (HeroNameStore); before a name exists it shows
 * Sam, the landing's example child, with his real painted cover.
 */
export default function Moments() {
  const t = useTranslations("moments");
  const locale = useLocale();
  const typed = firstName(formatChildName(useHeroName()));
  const name = typed || LANDING_EXAMPLE.childName;
  const withName = !!typed;
  const revealRef = useReveal();

  const text = (id: MomentId) =>
    withName ? t(`items.${id}.textWithName`, { name, deName: deName(name, locale) }) : t(`items.${id}.text`);

  const visuals: Record<MomentId, ReactNode> = {
    firstLook: (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-6">
        <div className={`relative w-[min(58%,260px)] ${styles.cover}`}>
          {/* Page block under the board, as in the hero: a book, not a card */}
          <div
            aria-hidden
            className="absolute inset-0 translate-x-[3%] translate-y-[2.2%] rounded-[4px_14px_14px_4px] bg-surface shadow-book ring-1 ring-line-warm"
          />
          {withName ? (
            <LiveCover name={name} templateId={null} sizes="230px" />
          ) : (
            <LiveCover
              name={name}
              // No world kicker: on the painted cover it would sit over the child's face.
              templateId={null}
              imageUrl={LANDING_EXAMPLE.coverSrc}
              sizes="230px"
            />
          )}
        </div>
      </div>
    ),
    bedtime: (
      <Image
        src="/images/landing/bedtime.webp"
        alt={t("items.bedtime.alt")}
        fill
        sizes="(min-width: 1024px) 370px, (min-width: 640px) 560px, 100vw"
        className="object-cover"
      />
    ),
    keepsake: (
      <div className="flex h-full items-center justify-center px-6 py-6">
        <DedicationPage
          title={t("dedication.title", { name, deName: deName(name, locale) })}
          text={t("dedication.text", { name })}
          sender={t("dedication.sender")}
        />
      </div>
    ),
  };

  const ids: MomentId[] = ["firstLook", "bedtime", "keepsake"];

  return (
    <section
      id="moments"
      aria-labelledby="moments-title"
      className="scroll-mt-[var(--landing-nav-h,64px)] bg-brand-deep py-20 text-paper sm:py-28"
    >
      <div ref={revealRef} className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-line-warm">{t("eyebrow")}</p>
          <h2
            id="moments-title"
            className="mt-3 text-balance font-display text-[32px] font-bold leading-[1.1] text-paper sm:text-5xl lg:text-[56px]"
          >
            {withName ? t("titleWithName", { name }) : t("title")}
          </h2>
        </div>

        <ol className="mx-auto mt-12 grid max-w-[560px] gap-14 sm:mt-16 lg:max-w-none lg:grid-cols-3 lg:gap-8">
          {ids.map((id) => (
            <li key={id} className={`flex flex-col ${styles.item}`}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-paper">{visuals[id]}</div>
              <h3 className="mt-6 text-xs font-bold uppercase tracking-wide text-line-warm">{t(`items.${id}.kicker`)}</h3>
              <p className="mt-2 text-pretty font-display text-[22px] font-medium leading-[1.3] text-paper sm:text-2xl lg:text-[22px] xl:text-2xl">
                {text(id)}
              </p>
              {id === "keepsake" && <p className="mt-3 text-sm text-paper/75">{t("dedication.caption")}</p>}
              {id === "firstLook" && !withName && <TypeNameButton label={t("typeName")} />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The book's title + dedication page (p1), drawn at any size with container units. */
function DedicationPage({ title, text, sender }: { title: string; text: string; sender: string }) {
  return (
    <div
      className="relative aspect-square w-[min(70%,280px)] rotate-[1.5deg] rounded-[2px] bg-surface shadow-book ring-1 ring-line [container-type:inline-size]"
      role="img"
      aria-label={`${title}. ${text} ${sender}`}
    >
      <div aria-hidden className="absolute inset-[5%] rounded-[2px] border border-brand/25" />
      <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center px-[13%] text-center">
        <BrandLogo className="h-[5cqi] text-brand-deep/45" />
        <p className="mt-[3cqi] font-display font-semibold leading-tight text-ink" style={{ fontSize: "7cqi" }}>
          {title}
        </p>
        <div className="mt-[3.5cqi] flex w-[34%] items-center gap-[2cqi]">
          <span className="h-px flex-1 bg-gold/60" />
          <svg viewBox="0 0 24 24" className="size-[3.6cqi] fill-gold/80">
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 5 6.4 5c2.1 0 3.6 1.2 4.6 2.7C12 6.2 13.5 5 15.6 5 19 5 21.1 8.5 19.6 11.8 17.5 16.4 12 21 12 21z" />
          </svg>
          <span className="h-px flex-1 bg-gold/60" />
        </div>
        <p className="mt-[3.5cqi] italic leading-[1.45] text-ink-soft" style={{ fontSize: "4.7cqi" }}>
          «{text}»
        </p>
        <p className="mt-[2.5cqi] text-ink-muted" style={{ fontSize: "4cqi" }}>
          — {sender}
        </p>
      </div>
    </div>
  );
}

/** Quiet link back to the hero's name field: "type their name and see it here". */
function TypeNameButton({ label }: { label: string }) {
  function onClick() {
    const input = document.getElementById("hero-name") as HTMLInputElement | null;
    if (!input) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    input.focus({ preventScroll: true });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
    >
      {label}
      <span aria-hidden className="material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-lg leading-5">
        arrow_upward
      </span>
    </button>
  );
}

/**
 * Plays the entrance once, when the band scrolls into view. Server HTML and no-JS
 * visitors get the content visible; it is only hidden ("armed") after mount if the band
 * is still below the fold, so nothing a visitor has already seen ever disappears.
 * The classes are toggled on the DOM directly (the className prop stays static, so
 * React never resets them), which keeps the reveal out of React's render cycle.
 */
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    el.classList.add(styles.armed);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.replace(styles.armed, styles.shown);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
