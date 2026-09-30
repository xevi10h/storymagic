"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";

/** Reading-club signup in the footer (on brand-deep). POSTs to /api/newsletter. */
export default function NewsletterForm() {
  const t = useTranslations("footer");
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-white">
        <span aria-hidden className="material-symbols-outlined text-lg">
          check
        </span>
        {t("subscribed")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-col">
      <label htmlFor={inputId} className="sr-only">
        {t("emailPlaceholder")}
      </label>
      <input
        id={inputId}
        className="h-12 w-full min-w-0 shrink-0 rounded-2xl sm:w-auto sm:flex-1 lg:w-full lg:flex-none border-2 border-white/20 bg-white/10 px-4 text-base text-white outline-none transition-colors placeholder:text-white/60 focus:border-white"
        placeholder={t("emailPlaceholder")}
        type="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="send"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        aria-invalid={status === "error" || undefined}
        aria-describedby={status === "error" ? `${inputId}-error` : undefined}
        required
      />
      <button
        type="submit"
        disabled={status === "loading"}
        aria-busy={status === "loading" || undefined}
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 text-sm font-bold text-brand-deep transition-colors hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
      >
        {status === "loading" && (
          <Spinner className="text-lg" />
        )}
        {t("joinClub")}
      </button>
      {status === "error" && (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-medium text-white sm:basis-full">
          {t("subscribeError")}
        </p>
      )}
    </form>
  );
}
