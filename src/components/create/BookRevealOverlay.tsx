"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookMockup } from "@/components/book-mockup";

interface BookRevealOverlayProps {
  coverUrl: string | null;
  childName: string;
  /** The book's title, set on the cover exactly as printed */
  title: string;
  /** Board / spine colour (getBookColors(...).gradientStart) */
  spineColor: string;
  onDone: () => void;
}

const SPARKLES: ReadonlyArray<readonly [number, number, number, number]> = [
  [12, 18, 3, 0.2], [86, 14, 2, 0.6], [20, 72, 2.5, 1.0], [78, 80, 3, 0.4],
  [50, 8, 2, 1.3], [8, 45, 2, 0.8], [92, 50, 2.5, 0.1], [64, 90, 2, 0.9],
];

/**
 * Full-screen "your book is born" moment, shown once right after generation
 * finishes and the user lands on the preview. Tap anywhere (or wait) to enter
 * the normal preview.
 */
export default function BookRevealOverlay({ coverUrl, childName, title, spineColor, onDone }: BookRevealOverlayProps) {
  const t = useTranslations("crear.preview");
  const [leaving, setLeaving] = useState(false);

  // Auto-dismiss: hold the moment, then fade into the preview
  useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), 3400);
    return () => window.clearTimeout(hold);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const fade = window.setTimeout(onDone, 450);
    return () => window.clearTimeout(fade);
  }, [leaving, onDone]);

  return (
    <button
      type="button"
      aria-label={t("freshSkip")}
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-[80] flex w-full cursor-pointer flex-col items-center justify-center bg-create-bg px-6 transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* sparkles */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {SPARKLES.map(([x, y, r, d], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r * 0.22}
            className="book-reveal-sparkle"
            style={{ animationDelay: `${d}s` }}
            fill="var(--create-gold)"
          />
        ))}
      </svg>

      {/* The printed book, same cover as the painting screen and the buy panel. Its 5:4 stage
          leaves wide margins around the book: widened and cropped so the book reads large. */}
      <span className="book-reveal-cover relative mb-6 block w-64 max-w-[68vw] sm:w-80">
        <span aria-hidden className="absolute inset-[6%] -z-10 rounded-full bg-create-primary/20 blur-3xl" />
        <span className="block overflow-hidden">
          <span className="-mx-[25%] -mb-[16%] -mt-[9%] block">
            <BookMockup
              coverUrl={coverUrl}
              title={title}
              childName={childName}
              subtitle={t("personalizedStory")}
              format="hardcover"
              spineColor={spineColor}
              showScale={false}
              interactive={false}
              priority
              alt=""
              className="[&>div:first-child]:hidden"
            />
          </span>
        </span>
      </span>

      <h2 className="book-reveal-title mb-2 text-center font-display text-2xl font-bold text-create-text sm:text-3xl">
        {t("freshTitle", { name: childName })}
      </h2>
      <p className="book-reveal-title text-center text-sm text-create-text-sub" style={{ animationDelay: "0.25s" }}>
        {t("freshSubtitle")}
      </p>
    </button>
  );
}
