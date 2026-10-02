"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, cx, focusRing } from "@/components/ui";
import { trackEvent } from "@/lib/tracking/consent";
import type { ToolId } from "@/lib/tools/registry";
import type { ToolInput } from "@/lib/tools/schema";

type DownloadState = { kind: "idle" } | { kind: "loading" } | { kind: "done"; url: string; filename: string } | { kind: "error"; message: string };

const FILENAME_RE = /filename="([^"]+)"/;

/**
 * Primary action of a tool page: POSTs the form to /api/tools/pdf and saves the
 * PDF (blob + <a download>, which also works in iOS Safari, where the file opens
 * in the viewer with "Share › Save to Files"). A visible "open it here" link stays
 * as a fallback. Double-click safe (in-flight ref), errors announced.
 */
export default function ToolDownload({
  tool,
  label,
  buildInput,
  onInvalid,
}: {
  tool: ToolId;
  label: string;
  /** The validated payload, or null when a required field is missing (onInvalid is then called). */
  buildInput: () => ToolInput | null;
  onInvalid: () => void;
}) {
  const t = useTranslations("tools.common");
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const inFlight = useRef(false);
  const lastUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    },
    [],
  );

  async function download() {
    if (inFlight.current) return;
    const input = buildInput();
    if (!input) {
      onInvalid();
      return;
    }
    inFlight.current = true;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/tools/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        setState({ kind: "error", message: res.status === 429 ? t("errorRateLimited") : t("errorGeneric") });
        return;
      }
      const blob = await res.blob();
      const filename = FILENAME_RE.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "meapica.pdf";
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const url = URL.createObjectURL(blob);
      lastUrl.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState({ kind: "done", url, filename });
      trackEvent("ToolDownload", { tool });
    } catch {
      setState({ kind: "error", message: t("errorGeneric") });
    } finally {
      inFlight.current = false;
    }
  }

  const loading = state.kind === "loading";

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" block onClick={download} loading={loading} leadingIcon="download" data-testid="tool-download">
        {loading ? t("downloading") : label}
      </Button>

      <div aria-live="polite" className="min-h-0">
        {state.kind === "done" && (
          <div className="rounded-2xl border-2 border-line bg-paper px-4 py-3 text-sm text-ink-soft" data-testid="tool-download-done">
            <p className="flex items-center gap-2 font-bold text-success">
              <span aria-hidden className="material-symbols-outlined !text-lg">
                check_circle
              </span>
              {t("downloaded")}
            </p>
            <p className="mt-1">{t("printTip")}</p>
            <a
              href={state.url}
              target="_blank"
              rel="noopener"
              download={state.filename}
              className={cx("mt-1 inline-flex min-h-11 items-center font-semibold text-brand-text underline decoration-brand/30 underline-offset-2", focusRing)}
            >
              {t("openPdf")}
            </a>
          </div>
        )}
        {state.kind === "error" && (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" data-testid="tool-download-error">
            {state.message}
          </p>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-muted">
        <span aria-hidden className="material-symbols-outlined mt-px !text-base shrink-0">
          lock
        </span>
        {t("privacyNote")}
      </p>
    </div>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Optional, unchecked opt-in: "Avísame antes de la fecha límite de Reyes". Ticking
 * it reveals the email field; the consent is recorded by /api/newsletter with
 * source "reyes_reminder" (that reminder only). Never required for the download.
 */
export function ReminderOptIn() {
  const t = useTranslations("tools.common");
  const locale = useLocale();
  const id = useId();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error" | "invalid">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("invalid");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: "reyes_reminder", locale }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("done");
      trackEvent("Lead", { content_name: "reyes_reminder" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-paper px-4 py-3 text-sm font-semibold text-success" data-testid="reminder-done">
        <span aria-hidden className="material-symbols-outlined !text-lg">
          check
        </span>
        {t("reminderDone")}
      </p>
    );
  }

  const errorText = status === "invalid" ? t("reminderInvalid") : status === "error" ? t("reminderError") : null;

  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-4">
      <label htmlFor={`${id}-check`} className="flex cursor-pointer items-start gap-3">
        <input
          id={`${id}-check`}
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-brand"
          data-testid="reminder-check"
        />
        <span>
          <span className="block text-sm font-bold text-ink-soft">{t("reminderLabel")}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
            {t("reminderHint")}{" "}
            <Link href="/legal#privacy" className="font-semibold text-ink-muted underline decoration-ink-muted/40 underline-offset-2">
              {t("privacyLink")}
            </Link>
          </span>
        </span>
      </label>

      {checked && (
        <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${id}-email`} className="sr-only">
            {t("reminderEmail")}
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="send"
            maxLength={254}
            placeholder={t("reminderEmail")}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "invalid" || status === "error") setStatus("idle");
            }}
            aria-invalid={errorText ? true : undefined}
            aria-describedby={errorText ? `${id}-error` : undefined}
            className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-brand"
            data-testid="reminder-email"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-12" loading={status === "sending"} data-testid="reminder-submit">
            {status === "sending" ? t("reminderSending") : t("reminderSubmit")}
          </Button>
        </form>
      )}
      {errorText && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">
          {errorText}
        </p>
      )}
    </div>
  );
}
