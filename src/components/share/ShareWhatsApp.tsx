"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { deName } from "@/lib/creation-flow";
import { trackEvent } from "@/lib/tracking/consent";
import { requestShareUrl } from "./SharePreviewButton";

type Target = "partner" | "grandparents";

/**
 * "¿Lo decidís entre dos?" under the preview book: two WhatsApp buttons (partner, grandparents)
 * that open a chat with a ready message + the read-only share link of this preview (the same
 * signed link as "Compartir"; minting it writes nothing). Why: nobody comes back after the
 * first visit and a gift is often decided by two people (funnel of 2026-11-17).
 */
export default function ShareWhatsApp({ storyId, childName, childGender }: { storyId: string; childName: string; childGender?: string }) {
  const t = useTranslations("crear.preview.whatsapp");
  const locale = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // Minted ahead of the tap so each button is a real link (in-app browsers block window.open).
  useEffect(() => {
    let alive = true;
    requestShareUrl(storyId, locale)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [storyId, locale]);

  const names = { name: childName, deName: deName(childName, locale, childGender) };
  const href = (target: Target) => `https://wa.me/?text=${encodeURIComponent(`${t(`${target}Text`, names)} ${url ?? ""}`)}`;

  return (
    <section aria-labelledby="whatsapp-share-title" data-testid="whatsapp-share" className="mx-auto mt-5 max-w-xl rounded-2xl bg-white p-4 ring-1 ring-create-neutral sm:p-5">
      <h2 id="whatsapp-share-title" className="font-display text-base font-bold text-create-text-dark">
        {t("title")}
      </h2>
      <p className="mt-0.5 text-sm text-create-text-sub">{t("body", names)}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {(["partner", "grandparents"] as const).map((target) => (
          <a
            key={target}
            href={url ? href(target) : undefined}
            aria-disabled={!url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("preview_share_whatsapp", { target })}
            data-testid={`whatsapp-${target}`}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-success px-4 text-sm font-bold text-success transition-colors hover:bg-success/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success ${
              url ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.2A8.5 8.5 0 1 1 21 12z" />
            </svg>
            {t(target)}
          </a>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {t("error")}
        </p>
      )}
    </section>
  );
}
