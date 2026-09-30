"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonClass } from "@/components/ui";
import { SUPPORT_EMAIL } from "@/lib/support";

type Phase = "confirm" | "sending" | "done" | "error";

/** Confirm → done. `token` null = the link is not valid (tampered or cut). */
export function UnsubscribeClient({ token, maskedEmail }: { token: string | null; maskedEmail: string | null }) {
  const t = useTranslations("unsubscribe");
  const [phase, setPhase] = useState<Phase>("confirm");

  async function confirm() {
    if (!token || phase === "sending") return;
    setPhase("sending");
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      setPhase(res.ok ? "done" : "error");
    } catch {
      setPhase("error");
    }
  }

  const mailto = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-brand-text underline underline-offset-2">
      {SUPPORT_EMAIL}
    </a>
  );

  if (!token) {
    return (
      <Panel title={t("invalid.title")} testId="unsubscribe-invalid">
        <p>{t.rich("invalid.body", { mail: () => mailto })}</p>
        <HomeLink label={t("backHome")} />
      </Panel>
    );
  }

  if (phase === "done") {
    return (
      <Panel title={t("done.title")} testId="unsubscribe-done" icon="check_circle">
        <p>{t("done.body", { email: maskedEmail ?? "" })}</p>
        <p className="mt-3">{t("done.transactional")}</p>
        <HomeLink label={t("backHome")} />
      </Panel>
    );
  }

  return (
    <Panel title={t("confirm.title")} testId="unsubscribe-confirm">
      <p>{t("confirm.body", { email: maskedEmail ?? "" })}</p>
      <p className="mt-3">{t("confirm.transactional")}</p>
      <div className="mt-7">
        <Button size="md" onClick={() => void confirm()} loading={phase === "sending"} data-testid="unsubscribe-button">
          {t("confirm.button")}
        </Button>
      </div>
      {phase === "error" && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
          {t.rich("error", { mail: () => mailto })}
        </p>
      )}
    </Panel>
  );
}

function Panel({ title, icon, testId, children }: { title: string; icon?: string; testId: string; children: React.ReactNode }) {
  return (
    <section
      data-testid={testId}
      className="w-full max-w-[520px] rounded-3xl bg-surface p-6 text-base leading-relaxed text-ink-body shadow-card ring-1 ring-line sm:p-8"
    >
      {icon && (
        <span aria-hidden className="material-symbols-outlined mb-3 block text-[36px] text-success">
          {icon}
        </span>
      )}
      <h1 className="text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-3xl">{title}</h1>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HomeLink({ label }: { label: string }) {
  return (
    <div className="mt-7">
      <Link href="/" className={buttonClass({ variant: "secondary", size: "sm" })}>
        {label}
      </Link>
    </div>
  );
}
