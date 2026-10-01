"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { MAX_DEDICATION_LENGTH, MAX_SENDER_LENGTH } from "@/lib/creation-flow";
import type { SaveState } from "@/hooks/useDedicationAutosave";

interface DedicationEditorProps {
  name: string;
  dedication: string;
  senderName: string;
  saveState: SaveState;
  onChange: (patch: { dedication?: string; senderName?: string }) => void;
  /** Hide the live page mock (e.g. inside the preview sheet where the book itself updates). */
  showPage?: boolean;
}

/** The dedication, written by the parent and rendered live on a page mock. Stored verbatim. */
export default function DedicationEditor({
  name,
  dedication,
  senderName,
  saveState,
  onChange,
  showPage = true,
}: DedicationEditorProps) {
  const t = useTranslations("crear.dedication");
  const uid = useId();
  const remaining = MAX_DEDICATION_LENGTH - dedication.length;

  return (
    <div className="flex flex-col gap-4">
      {showPage && (
        <div
          aria-hidden
          data-testid="dedication-page"
          className="relative mx-auto flex aspect-square w-full max-w-[250px] sm:max-w-[340px] flex-col items-center justify-center overflow-hidden rounded-[3px_10px_10px_3px] bg-[#fffaf3] px-[12%] text-center shadow-[0_16px_30px_-20px_rgba(58,36,24,.55),0_1px_4px_rgba(58,36,24,.1)]"
        >
          <span aria-hidden className="absolute inset-y-0 left-0 w-[5%] bg-gradient-to-r from-black/10 to-transparent" />
          <p className="max-h-[70%] overflow-hidden whitespace-pre-line font-display text-[15px] italic leading-relaxed text-create-text sm:text-base [overflow-wrap:anywhere]">
            {dedication || <span className="text-create-text-sub/50">{t("pageEmpty", { name })}</span>}
          </p>
          {senderName.trim() && (
            <p className="mt-3 font-display text-sm font-semibold text-brand-text [overflow-wrap:anywhere]">{senderName}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor={`${uid}-text`} className="text-xs font-bold uppercase tracking-wide text-create-text">
            {t("label")}
          </label>
          <span
            className={`text-xs tabular-nums ${remaining < 40 ? "font-bold text-brand-text" : "text-create-text-sub"}`}
            aria-live="polite"
            data-testid="dedication-counter"
          >
            {dedication.length}/{MAX_DEDICATION_LENGTH}
          </span>
        </div>
        <textarea
          id={`${uid}-text`}
          value={dedication}
          onChange={(e) => onChange({ dedication: e.target.value })}
          maxLength={MAX_DEDICATION_LENGTH}
          rows={4}
          className="w-full resize-none rounded-2xl border-2 border-create-neutral bg-white px-4 py-3 text-base leading-relaxed text-create-text-dark outline-none transition-colors focus:border-create-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-sender`} className="text-xs font-bold uppercase tracking-wide text-create-text">
          {t("senderLabel")}
        </label>
        <input
          id={`${uid}-sender`}
          type="text"
          value={senderName}
          onChange={(e) => onChange({ senderName: e.target.value })}
          placeholder={t("senderPlaceholder")}
          maxLength={MAX_SENDER_LENGTH}
          autoComplete="off"
          className="h-12 w-full rounded-2xl border-2 border-create-neutral bg-white px-4 text-base text-create-text-dark outline-none transition-colors placeholder:text-create-text-sub/50 focus:border-create-primary"
        />
      </div>

      <p className="min-h-5 text-xs text-create-text-sub" aria-live="polite" data-testid="dedication-save-state">
        {saveState === "saving" && t("saving")}
        {saveState === "saved" && (
          <span className="inline-flex items-center gap-1 text-create-text">
            <span aria-hidden className="material-symbols-outlined text-sm text-brand-text">check</span>
            {t("saved")}
          </span>
        )}
        {saveState === "error" && <span className="text-red-700">{t("saveError")}</span>}
        {saveState === "idle" && t("verbatimNote")}
      </p>
    </div>
  );
}
