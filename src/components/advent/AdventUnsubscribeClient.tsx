"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonClass } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/support";
import { ADVENT_PATH } from "@/lib/advent/calendar";

type Phase = "confirm" | "sending" | "done" | "error";

/** Confirm → done. `token` null = the link is not valid (cut or tampered). */
export default function AdventUnsubscribeClient({ token }: { token: string | null }) {
  const t = useTranslations("advent.unsubscribe");
  const [phase, setPhase] = useState<Phase>("confirm");

  async function confirm() {
    if (!token || phase === "sending") return;
    setPhase("sending");
    try {
      const res = await fetch("/api/advent/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      setPhase(res.ok ? "done" : "error");
    } catch {
      setPhase("error");
    }
  }

  const mail = () => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-text underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  );
  const back = (
    <div className="mt-7">
      <Link href={ADVENT_PATH} className={buttonClass({ variant: "secondary", size: "sm" })}>
        {t("back")}
      </Link>
    </div>
  );

  const title = !token ? t("invalidTitle") : phase === "done" ? t("doneTitle") : t("title");
  return (
    <section
      data-testid={!token ? "advent-unsubscribe-invalid" : phase === "done" ? "advent-unsubscribe-done" : "advent-unsubscribe-confirm"}
      className="w-full max-w-[520px] rounded-3xl bg-surface p-6 text-base leading-relaxed text-ink-body shadow-card ring-1 ring-line sm:p-8"
    >
      {phase === "done" && <span aria-hidden className="material-symbols-outlined mb-3 block text-[36px] text-success" data-icon="check_circle" />}
      <h1 className="text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-3xl">{title}</h1>
      <div className="mt-3">
        {!token ? (
          <>
            <p>{t.rich("invalidBody", { mail, email: SUPPORT_EMAIL })}</p>
            {back}
          </>
        ) : phase === "done" ? (
          <>
            <p>{t("doneBody")}</p>
            {back}
          </>
        ) : (
          <>
            <p>{t("body")}</p>
            <div className="mt-7">
              <Button size="md" onClick={() => void confirm()} loading={phase === "sending"} data-testid="advent-unsubscribe-button">
                {t("button")}
              </Button>
            </div>
            {phase === "error" && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                {t.rich("error", { mail, email: SUPPORT_EMAIL })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
