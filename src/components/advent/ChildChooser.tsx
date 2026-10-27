"use client";

// "¿Para quién son los cuentos?" (NoCharacterMobile.dc.html): create the character
// (primary) or, for now, just the name (kept in this browser). The optional "the stories
// talk about…" chips give the grammar its gender (Catalan articles, "quieto/quieta");
// without a choice the stories use their gender-neutral wording.

import { useId, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { ChoiceChip, cx, focusRing } from "@/components/ui";
import { formatChildName } from "@/lib/child-name";
import type { AdventGender } from "@/lib/advent/render";

const NAME_MAX = 40;

/** The typed name as the stories use it ("" = nothing usable). */
export function cleanChildName(raw: string): string {
  return formatChildName(raw.replace(/[^\p{L}\p{M}\s'’-]/gu, "")).slice(0, NAME_MAX).trim();
}

export default function ChildChooser({
  prompt,
  nameInputRef,
  onCreate,
  onName,
  onDraftChange,
  onCancel,
  savedName,
  onUseSaved,
}: {
  /** Someone tried to open a door first: say why the chooser is here. */
  prompt: boolean;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onCreate: () => void;
  onName: (name: string, gender: AdventGender) => void;
  /** The name typed so far, so the email sign-up below can use it without "Leer". */
  onDraftChange?: (draft: { name: string; gender: AdventGender } | null) => void;
  onCancel?: () => void;
  /** Signed-in visitor with a saved character currently reading with a typed name. */
  savedName?: string;
  onUseSaved?: () => void;
}) {
  const t = useTranslations("advent.chooser");
  const tb = useTranslations("advent.builder");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<AdventGender | null>(null);
  const [error, setError] = useState(false);
  const nameId = useId();
  const errorId = useId();
  const genderId = useId();

  function report(nextName: string, nextGender: AdventGender | null) {
    const clean = cleanChildName(nextName);
    onDraftChange?.(clean ? { name: clean, gender: nextGender ?? "neutral" } : null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = cleanChildName(name);
    if (!clean) {
      setError(true);
      nameInputRef.current?.focus();
      return;
    }
    onName(clean, gender ?? "neutral");
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-[22px] border border-line bg-surface p-5" data-testid="advent-chooser">
      <div className="flex items-center gap-3.5">
        <span aria-hidden className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-line">
          <span className="font-display text-[28px] font-bold text-brand-deep">?</span>
        </span>
        <div>
          <h2 className="font-display text-[21px] font-semibold leading-tight text-ink">{t("title")}</h2>
          <p className="mt-1 text-sm leading-normal text-ink-body">{t("text")}</p>
        </div>
      </div>
      {prompt && (
        <p role="status" className="rounded-xl bg-brand-tint px-3 py-2 text-sm font-semibold text-brand-text">
          {t("pickFirst")}
        </p>
      )}
      <button
        type="button"
        onClick={onCreate}
        className={cx("min-h-[52px] rounded-[14px] bg-brand px-4 text-[19px] font-bold text-white transition-colors hover:bg-brand-hover", focusRing)}
        data-testid="advent-create-character"
      >
        {t("create")}
      </button>
      <p className="text-center text-[13px] leading-normal text-ink-muted">{t("createHint")}</p>

      <div className="flex items-center gap-2.5 text-[13px] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <label htmlFor={nameId} className="text-sm font-semibold text-ink-soft">
          {t("nameLabel")}
        </label>
        <input
          ref={nameInputRef}
          id={nameId}
          type="text"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder={t("namePlaceholder")}
          aria-invalid={error || undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setName(e.target.value);
            report(e.target.value, gender);
            if (error) setError(false);
          }}
          className="-mt-1.5 w-full rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-base text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
          data-testid="advent-name-input"
        />
        {error && (
          <p id={errorId} role="alert" className="-mt-1 text-sm text-error">
            {t("nameError")}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <span id={genderId} className="text-[13px] text-ink-muted">
            {t("genderLabel")}
          </span>
          <div role="radiogroup" aria-labelledby={genderId} className="grid grid-cols-3 gap-2">
            {(["girl", "boy", "neutral"] as const).map((g) => (
              <ChoiceChip
                key={g}
                selected={gender === g}
                onClick={() => {
                  const next = gender === g ? null : g;
                  setGender(next);
                  report(name, next);
                }}
                className="!px-2 !text-[13px]"
              >
                {t(g)}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <button
          type="submit"
          className={cx("min-h-12 rounded-xl border-[1.5px] border-brand bg-brand-tint px-4 text-[15px] font-bold text-brand-text hover:bg-surface", focusRing)}
          data-testid="advent-name-submit"
        >
          {t("read")}
        </button>
      </form>
      {savedName && onUseSaved && (
        <button
          type="button"
          onClick={onUseSaved}
          className={cx("min-h-11 rounded-xl border-[1.5px] border-line-warm bg-surface px-4 text-sm font-semibold text-ink-soft hover:border-brand", focusRing)}
          data-testid="advent-use-saved"
        >
          {t("useSaved", { name: savedName })}
        </button>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className={cx("min-h-11 self-center rounded-md px-2 text-sm font-semibold text-ink-muted underline underline-offset-2", focusRing)}>
          {tb("cancel")}
        </button>
      )}
    </section>
  );
}
