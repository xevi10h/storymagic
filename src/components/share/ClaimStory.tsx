"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import CreationHeader from "@/components/create/CreationHeader";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { ensureGuestSession } from "@/lib/guest-session";

type State = "opening" | "invalid" | "error";

const BUTTON =
  "min-h-12 inline-flex items-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-[19px] font-bold leading-tight text-white transition-colors hover:bg-create-primary-hover";

/**
 * /[locale]/continue/[token]: gets this browser a session (the usual BotID-checked guest
 * session when there is none), asks the server to move the story here, then opens the
 * preview with the buy panel.
 */
export default function ClaimStory({ token, valid }: { token: string; valid: boolean }) {
  const t = useTranslations("claimStory");
  const router = useRouter();
  const [state, setState] = useState<State>(valid ? "opening" : "invalid");
  const started = useRef(false);

  const claim = useCallback(async () => {
    setState("opening");
    try {
      await ensureGuestSession();
      const res = await fetch("/api/stories/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 410) return setState("invalid");
      if (!res.ok) throw new Error(`claim_${res.status}`);
      const { storyId } = (await res.json()) as { storyId: string };
      router.replace(`/create/${storyId}/preview`);
    } catch {
      setState("error");
    }
  }, [token, router]);

  useEffect(() => {
    if (!valid || started.current) return;
    started.current = true;
    void claim();
  }, [valid, claim]);

  if (state === "opening") {
    return (
      <div className="flex min-h-screen flex-col bg-create-bg" data-testid="claim-opening">
        <CreationHeader rightAction="none" />
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <BrandLoader size="lg" caption={t("opening")} />
        </div>
      </div>
    );
  }

  const invalid = state === "invalid";
  return (
    <div className="flex min-h-screen flex-col bg-create-bg" data-testid={invalid ? "claim-invalid" : "claim-error"}>
      <CreationHeader rightAction="none" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <span aria-hidden className="material-symbols-outlined text-5xl text-brand-text" data-icon={invalid ? "link_off" : "cloud_off"} />
          <h1 className="mt-4 font-display text-2xl font-bold text-secondary">{t(invalid ? "invalidTitle" : "errorTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{t(invalid ? "invalidBody" : "errorBody")}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {invalid ? (
              <>
                <Link href="/create" className={BUTTON}>
                  <span aria-hidden className="material-symbols-outlined text-lg" data-icon="auto_stories" />
                  {t("createCta")}
                </Link>
                <Link href="/auth/login?next=/dashboard" className="text-sm text-text-muted transition-colors hover:text-brand-text">
                  {t("login")}
                </Link>
              </>
            ) : (
              <>
                <button type="button" onClick={() => void claim()} className={BUTTON}>
                  {t("retry")}
                </button>
                <Link href="/" className="text-sm text-text-muted transition-colors hover:text-brand-text">
                  {t("home")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
