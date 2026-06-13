"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface BookRevealOverlayProps {
  coverUrl: string | null;
  childName: string;
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
export default function BookRevealOverlay({ coverUrl, childName, onDone }: BookRevealOverlayProps) {
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

      {/* cover */}
      <span className="book-reveal-cover relative mb-8 block w-56 max-w-[60vw] overflow-hidden rounded-xl shadow-[0_32px_70px_-28px_rgba(44,24,16,.55)] sm:w-64">
        <span className="absolute -inset-6 -z-10 rounded-full bg-create-primary/15 blur-3xl" />
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- one-shot reveal; the cover is already optimized for the flipbook
          <img src={coverUrl} alt="" className="block aspect-square w-full object-cover" />
        ) : (
          <span className="block aspect-square w-full bg-gradient-to-br from-amber-400 to-orange-600" />
        )}
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
