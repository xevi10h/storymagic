"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { trackEvent } from "@/lib/tracking/consent";

interface SendPreviewEmailProps {
  storyId: string;
  childName: string;
  /** The signed-in account's address, prefilled (the parent can change it). */
  defaultEmail?: string | null;
  /**
   * false = the preview is still painting (waiting screen): the address is held and the link
   * goes out the moment this turns true. With "Envíamelo y recuérdamelo" the consent is
   * stored right away, so the reminders still arrive if the parent closes the tab.
   */
  ready?: boolean;
  /** An address is being held for the ready moment: the parent must keep this mounted. */
  onQueued?: () => void;
}

type Status = "idle" | "sending" | "queued" | "sent" | "error" | "invalid" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Envíamelo y recuérdamelo" under the book: optional, after the wow, never a gate.
 * Pressing that button, with the notice right below it, is the consent to the reminders
 * (LSSI 21.1 / RGPD 6.1.a), recorded by the server; the plain send beside it keeps the
 * link free of any reminder.
 */
export default function SendPreviewEmail({ storyId, childName, defaultEmail, ready = true, onQueued }: SendPreviewEmailProps) {
  const t = useTranslations("crear.sendPreview");
  const locale = useLocale();
  const uid = useId();
  // null = untouched: shows the account address once it is known (auth loads after mount).
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? defaultEmail ?? "";
  const [status, setStatus] = useState<Status>("idle");
  /** The server stored the reminder consent (false: not asked, already unsubscribed, or it could not be stored). */
  const [reminderOn, setReminderOn] = useState(false);
  /** Held while painting; sent once when `ready` turns true. */
  const [pending, setPending] = useState<{ email: string; remind: boolean } | null>(null);
  const pendingSent = useRef(false);

  const post = (value: string, remind: boolean) =>
    fetch(`/api/stories/${storyId}/send-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value, locale, ...(remind ? { remind: true } : {}) }),
      keepalive: true, // the waiting screen may navigate to the book while this is in flight
    });

  useEffect(() => {
    if (!ready || !pending || pendingSent.current) return;
    pendingSent.current = true;
    void post(pending.email, pending.remind)
      .then((res) => {
        if (res.ok) setStatus("sent");
      })
      .catch((err) => console.warn("[preview] deferred preview email failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per held address
  }, [ready, pending]);

  const send = async (remind: boolean) => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setStatus("invalid");
    setStatus("sending");
    if (!ready) {
      // Painting: store the consent now (reminders only), send the link when the book is ready.
      try {
        let reminder = false;
        if (remind) {
          const res = await fetch(`/api/stories/${storyId}/send-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: value, locale, remind: true }),
          });
          if (res.status === 429) return setStatus("rate_limited");
          if (res.status === 400) return setStatus("invalid");
          // 404: it finished in the meantime (status no longer "generating"); the held send covers it.
          // The held send (also with `remind`) records the consent then.
          if (!res.ok && res.status !== 404) throw new Error(`send_preview_${res.status}`);
          reminder = res.status === 404 || ((await res.json().catch(() => null)) as { reminder?: boolean } | null)?.reminder === true;
        }
        setReminderOn(reminder);
        setPending({ email: value, remind });
        onQueued?.();
        trackEvent("Lead", { content_name: reminder ? "preview_reminder" : "send_preview" });
        setStatus("queued");
      } catch (err) {
        console.warn("[preview] send preview email failed:", err);
        setStatus("error");
      }
      return;
    }
    try {
      const res = await post(value, remind);
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

  if (status === "sent" || status === "queued") {
    return (
      <p
        className="mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-2xl bg-create-bg px-4 py-3 text-sm font-medium text-create-text"
        role="status"
        data-testid="send-preview-sent"
      >
        <span aria-hidden className="material-symbols-outlined shrink-0 text-lg text-brand-text" data-icon="mark_email_read" />
        <span className="min-w-0 break-words">{status === "queued"
            ? t(reminderOn ? "queuedReminder" : "queued", { email: email.trim() })
            : t(reminderOn ? "sentReminder" : "sent", { email: email.trim() })}</span>
      </p>
    );
  }

  const sending = status === "sending";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(true);
      }}
      className="mx-auto mt-5 max-w-xl rounded-2xl bg-white p-4 ring-1 ring-create-neutral sm:p-5"
      noValidate
      data-testid="send-preview"
    >
      <label htmlFor={`${uid}-email`} className="block font-display text-base font-bold text-create-text-dark">
        {t(ready ? "title" : "titleWaiting", { name: childName })}
      </label>
      <p className="mt-0.5 text-sm text-create-text-sub">{t(ready ? "hint" : "hintWaiting")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setTypedEmail(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder={t("placeholder")}
          aria-invalid={status === "invalid"}
          className="h-12 w-full min-w-0 rounded-xl border-2 border-create-neutral sm:w-auto sm:flex-1 bg-white px-3 text-base text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-create-primary"
        />
        <button
          type="submit"
          disabled={sending}
          data-testid="send-preview-remind"
          className="h-12 shrink-0 rounded-xl border-2 border-create-primary px-4 text-sm font-bold text-brand-text transition-colors hover:bg-create-primary/5 disabled:opacity-60"
        >
          {sending ? t("sending") : t("remind")}
        </button>
      </div>
      {(status === "invalid" || status === "error" || status === "rate_limited") && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {status === "invalid" ? t("invalid") : status === "rate_limited" ? t("rateLimited") : t("error")}
        </p>
      )}
      <p className="mt-3 text-xs leading-snug text-create-text-sub">
        {t("remindNotice")}{" "}
        <Link href="/legal#privacy" target="_blank" className="font-semibold text-brand-text underline underline-offset-2">
          {t("remindPrivacy")}
        </Link>
      </p>
      <button
        type="button"
        disabled={sending}
        onClick={() => void send(false)}
        data-testid="send-preview-only"
        className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-create-text-sub underline underline-offset-2 hover:text-create-text-dark disabled:opacity-60"
      >
        {t("sendOnly")}
      </button>
    </form>
  );
}
