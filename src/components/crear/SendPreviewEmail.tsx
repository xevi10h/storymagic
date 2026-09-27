"use client";

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface SendPreviewEmailProps {
  storyId: string;
  childName: string;
}

type Status = "idle" | "sending" | "sent" | "error" | "invalid" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Envíame la preview" — optional, after the wow, never a gate. */
export default function SendPreviewEmail({ storyId, childName }: SendPreviewEmailProps) {
  const t = useTranslations("crear.sendPreview");
  const locale = useLocale();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return setStatus("invalid");
    setStatus("sending");
    try {
      const res = await fetch(`/api/stories/${storyId}/send-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, locale }),
      });
      if (res.status === 429) return setStatus("rate_limited");
      if (res.status === 400) return setStatus("invalid");
      if (!res.ok) throw new Error(`send_preview_${res.status}`);
      setStatus("sent");
    } catch (err) {
      console.warn("[preview] send preview email failed:", err);
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-create-text" role="status" data-testid="send-preview-sent">
        <span aria-hidden className="material-symbols-outlined text-lg text-create-primary">mark_email_read</span>
        {t("sent", { email: email.trim() })}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-xl border border-border-light bg-white p-4" noValidate data-testid="send-preview">
      <label htmlFor={`${uid}-email`} className="block text-sm font-bold text-create-text-dark">
        {t("title", { name: childName })}
      </label>
      <p className="mt-0.5 text-xs text-text-muted">{t("hint")}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status !== "idle" && status !== "sending") setStatus("idle");
          }}
          placeholder={t("placeholder")}
          aria-invalid={status === "invalid"}
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-border-light bg-white px-4 text-base text-text-main outline-none focus:border-create-primary"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-12 shrink-0 rounded-xl border-2 border-create-primary px-5 text-sm font-bold text-create-primary transition-colors hover:bg-create-primary/5 disabled:opacity-60"
        >
          {status === "sending" ? t("sending") : t("send")}
        </button>
      </div>
      {(status === "invalid" || status === "error" || status === "rate_limited") && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {status === "invalid" ? t("invalid") : status === "rate_limited" ? t("rateLimited") : t("error")}
        </p>
      )}
    </form>
  );
}
