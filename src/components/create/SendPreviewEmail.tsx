"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { trackEvent } from "@/lib/tracking/consent";

interface SendPreviewEmailProps {
  storyId: string;
  childName: string;
  /**
   * "card" (default): its own bordered card with title and hint.
   * "inline": just the field + button, for a host that already shows the title (the
   * "¿Lo decides más tarde?" options); `buttonClassName` then styles the button.
   */
  variant?: "card" | "inline";
  sendLabel?: string;
  buttonClassName?: string;
  /** The signed-in account's address, prefilled (the parent can change it). */
  defaultEmail?: string | null;
  /**
   * Offer the "recuérdamelo por email" box (abandoned-preview reminders). Only where
   * the book can still be bought. The box is never pre-ticked: ticking it is the
   * consent (LSSI 21.1 / RGPD 6.1.a) the server records with the address.
   */
  offerReminder?: boolean;
}

type Status = "idle" | "sending" | "sent" | "error" | "invalid" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Envíame la vista previa" — optional, after the wow, never a gate. */
export default function SendPreviewEmail({
  storyId,
  childName,
  variant = "card",
  sendLabel,
  buttonClassName,
  defaultEmail,
  offerReminder = false,
}: SendPreviewEmailProps) {
  const t = useTranslations("crear.sendPreview");
  const locale = useLocale();
  const uid = useId();
  // null = untouched: shows the account address once it is known (auth loads after mount).
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? defaultEmail ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [remind, setRemind] = useState(false);
  /** The server stored the reminder consent (false: not asked, already unsubscribed, or it could not be stored). */
  const [reminderOn, setReminderOn] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setStatus("invalid");
    setStatus("sending");
    try {
      const res = await fetch(`/api/stories/${storyId}/send-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, locale, ...(offerReminder && remind ? { remind: true } : {}) }),
      });
      if (res.status === 429) return setStatus("rate_limited");
      if (res.status === 400) return setStatus("invalid");
      if (!res.ok) throw new Error(`send_preview_${res.status}`);
      const data = (await res.json().catch(() => null)) as { reminder?: boolean } | null;
      const reminder = data?.reminder === true;
      setReminderOn(reminder);
      trackEvent("Lead", { content_name: reminder ? "preview_reminder" : "send_preview" });
      setStatus("sent");
    } catch (err) {
      console.warn("[preview] send preview email failed:", err);
      setStatus("error");
    }
  };

  const inline = variant === "inline";

  if (status === "sent") {
    return (
      <p
        className={
          inline
            ? "flex min-h-11 items-center gap-2 rounded-xl bg-create-bg px-3 py-2 text-sm font-medium text-create-text"
            : "mt-6 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-create-text"
        }
        role="status"
        data-testid="send-preview-sent"
      >
        <span aria-hidden className="material-symbols-outlined shrink-0 text-lg text-brand-text">mark_email_read</span>
        <span className="min-w-0 break-words">{t(reminderOn ? "sentReminder" : "sent", { email: email.trim() })}</span>
      </p>
    );
  }

  const field = (
    <input
      id={`${uid}-email`}
      type="email"
      inputMode="email"
      autoComplete="email"
      value={email}
      onChange={(e) => {
        setTypedEmail(e.target.value);
        if (status !== "idle" && status !== "sending") setStatus("idle");
      }}
      placeholder={t("placeholder")}
      aria-invalid={status === "invalid"}
      aria-label={inline ? t("placeholder") : undefined}
      className={
        inline
          ? "h-11 min-w-0 flex-1 rounded-xl border-2 border-create-neutral bg-white px-3 text-base text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-create-primary"
          : "h-12 min-w-0 flex-1 rounded-xl border-2 border-border-light bg-white px-4 text-base text-text-main outline-none focus:border-create-primary"
      }
    />
  );
  const button = (
    <button
      type="submit"
      disabled={status === "sending"}
      className={
        inline && buttonClassName
          ? buttonClassName
          : "h-12 shrink-0 rounded-xl border-2 border-create-primary px-5 text-sm font-bold text-brand-text transition-colors hover:bg-create-primary/5 disabled:opacity-60"
      }
    >
      {status === "sending" ? t("sending") : (sendLabel ?? t("send"))}
    </button>
  );
  const reminderBox = offerReminder && (
    <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-create-text-sub" data-testid="send-preview-remind">
      <input
        type="checkbox"
        checked={remind}
        onChange={(e) => setRemind(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
      />
      <span>
        {t("remindLabel")}{" "}
        <Link href="/legal#privacy" target="_blank" className="font-semibold text-brand-text underline underline-offset-2">
          {t("remindPrivacy")}
        </Link>
      </span>
    </label>
  );
  const message = (status === "invalid" || status === "error" || status === "rate_limited") && (
    <p role="alert" className="mt-2 text-xs text-red-700">
      {status === "invalid" ? t("invalid") : status === "rate_limited" ? t("rateLimited") : t("error")}
    </p>
  );

  if (inline) {
    return (
      <form onSubmit={submit} className="w-full" noValidate data-testid="send-preview">
        <div className="flex gap-2">
          {field}
          {button}
        </div>
        {reminderBox}
        {message}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-xl border border-border-light bg-white p-4" noValidate data-testid="send-preview">
      <label htmlFor={`${uid}-email`} className="block text-sm font-bold text-create-text-dark">
        {t("title", { name: childName })}
      </label>
      <p className="mt-0.5 text-xs text-text-muted">{t("hint")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {field}
        {button}
      </div>
      {reminderBox}
      {message}
    </form>
  );
}
