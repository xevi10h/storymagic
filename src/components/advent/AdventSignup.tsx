"use client";

// "Cada mañana, la puerta en tu correo": the daily email opt-in (unticked box, the exact
// promise "un email al día del 1 al 24 de diciembre", unsubscribe in every email).
// Portrait PDFs only to the signed-in account's own confirmed address: the form prefills
// it and says so; any other address gets name-only PDFs (the server decides, not the UI).

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cx, focusRing } from "@/components/ui";
import { trackEvent } from "@/lib/tracking/consent";
import type { AdventLocale } from "@/lib/advent/render";
import type { AdventChild } from "./child-store";

type Phase = "idle" | "sending" | "done";

export default function AdventSignup({
  locale,
  child,
  portraitEmail,
  beforeStart,
  onNeedName,
}: {
  locale: AdventLocale;
  child: AdventChild | null;
  portraitEmail: string | null;
  beforeStart: boolean;
  onNeedName: () => void;
}) {
  const t = useTranslations("advent.signup");
  // Prefilled with the account's own address once known; whatever is typed wins.
  const [typed, setEmail] = useState<string | null>(null);
  const email = typed ?? portraitEmail ?? "";
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  /** Double opt-in: guests (and other addresses) must confirm by email first. */
  const [pending, setPending] = useState(false);
  const emailId = useId();
  const consentId = useId();

  const withPortrait = child?.source === "character" && !!child.traits && !!portraitEmail && email.trim().toLowerCase() === portraitEmail;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "sending") return;
    if (!child) {
      setError(t("needName"));
      onNeedName();
      return;
    }
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return setError(t("emailError"));
    if (!consent) return setError(t("consentError"));
    setError(null);
    setPhase("sending");
    try {
      const res = await fetch("/api/advent/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          consent: true,
          locale,
          name: child.name,
          gender: child.gender,
          characterId: child.source === "character" ? child.id : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error === "invalid_email" ? t("emailError") : t("error"));
        setPhase("idle");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { state?: string };
      setPending(body.state === "pending");
      setPhase("done");
      trackEvent("advent_signup", { portrait: withPortrait, pending: body.state === "pending" });
      trackEvent("Lead", { content_name: "advent" });
    } catch {
      setError(t("error"));
      setPhase("idle");
    }
  }

  if (phase === "done") {
    return (
      <div role="status" className="rounded-[20px] border border-line bg-surface p-5" data-testid="advent-signup-done">
        <p className="flex items-start gap-2.5 text-[15px] font-semibold leading-relaxed text-ink">
          <span aria-hidden className={`material-symbols-outlined mt-0.5 shrink-0 !text-xl ${pending ? "text-brand" : "text-success"}`} data-icon={pending ? "mail" : "check_circle"} />
          {pending ? t("donePending") : beforeStart ? t("done") : t("doneOpen")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-5" data-testid="advent-signup">
      <p className="font-display text-[19px] font-semibold text-ink">{beforeStart ? t("titleTeaser") : t("title")}</p>
      <label htmlFor={consentId} className="flex cursor-pointer items-start gap-2.5 text-sm leading-normal text-ink-soft">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#E86C3A]"
          data-testid="advent-consent"
        />
        <span>{t("consent")}</span>
      </label>
      <label htmlFor={emailId} className="text-xs text-ink-muted">
        {t("emailLabel")}
      </label>
      <input
        id={emailId}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        placeholder={t("emailPlaceholder")}
        onChange={(e) => setEmail(e.target.value)}
        className="-mt-2 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
        data-testid="advent-email"
      />
      {child?.source === "character" && email.trim() && (
        <p className="-mt-1 text-xs leading-normal text-ink-muted" data-testid="advent-portrait-note">
          {withPortrait ? t("portraitNote") : t("nameOnlyNote")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={phase === "sending"}
        className={cx(
          "min-h-12 rounded-xl border-[1.5px] border-brand bg-brand-tint px-4 text-[15px] font-bold text-brand-text transition-colors hover:bg-surface disabled:opacity-60",
          focusRing,
        )}
        data-testid="advent-signup-submit"
      >
        {t("submit")}
      </button>
      <p className="text-xs leading-normal text-ink-muted">
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href="/legal#privacy" className="underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
