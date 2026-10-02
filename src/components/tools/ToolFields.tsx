"use client";

import { forwardRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import WatercolorAvatar from "@/components/avatar/WatercolorAvatar";
import { cx } from "@/components/ui";
import { TOOL_NAME_MAX } from "@/lib/tools/limits";
import { displayTraits, type ToolAvatarState } from "./AvatarPicker";

export type NameError = null | "required" | "invalid";

/** The child's name, in the landing's "¿Cómo se llama?" style (question = label, Fredoka). */
export const ToolNameField = forwardRef<
  HTMLInputElement,
  { id: string; value: string; onChange: (v: string) => void; error: NameError }
>(function ToolNameField({ id, value, onChange, error }, ref) {
  const t = useTranslations("tools.common");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-display text-lg font-semibold text-ink">
        {t("nameLabel")}
      </label>
      <input
        ref={ref}
        id={id}
        type="text"
        value={value}
        maxLength={TOOL_NAME_MAX}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        spellCheck={false}
        placeholder={t("namePlaceholder")}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={cx(
          "h-14 w-full rounded-2xl border-2 bg-surface px-4 font-display text-xl text-ink outline-none transition-colors placeholder:text-ink-muted/45 focus:border-brand",
          error ? "border-red-300" : "border-line",
        )}
        data-testid="tool-name"
      />
      <p id={`${id}-hint`} className={cx("flex justify-between gap-3 text-xs", error ? "font-medium text-red-700" : "text-ink-muted")}>
        <span role={error ? "alert" : undefined}>{error === "invalid" ? t("nameInvalid") : error ? t("nameRequired") : t("nameHint")}</span>
        <span aria-hidden className="tabular-nums">
          {value.length}/{TOOL_NAME_MAX}
        </span>
      </p>
    </div>
  );
});

/** A titled block of the tool form. */
export function FieldGroup({ title, hint, children, id }: { title: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-line pt-6">
      <div>
        <h3 id={id} className="font-display text-lg font-semibold leading-snug text-ink">
          {title}
        </h3>
        {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Round watercolour portrait with the paper ring used across the brand. */
export function ToolPortrait({ avatar, alt, className }: { avatar: ToolAvatarState; alt: string; className?: string }) {
  return (
    <div className={cx("relative aspect-square shrink-0 overflow-hidden rounded-full bg-line shadow-portrait ring-4 ring-white", className)}>
      <WatercolorAvatar traits={displayTraits(avatar)} alt={alt} size="fill" priority />
    </div>
  );
}

