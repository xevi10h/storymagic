"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { setHeroName } from "@/components/landing/HeroNameStore";
import { ChoiceChip, Eyebrow, cx } from "@/components/ui";
import { formatChildName } from "@/lib/child-name";
import { LETTER_COPY } from "@/lib/tools/letter-copy";
import { TOOL_AGE_MAX, TOOL_AGE_MIN, TOOL_NAME_PATTERN } from "@/lib/tools/limits";
import type { ToolLocale } from "@/lib/tools/registry";
import type { LetterInput } from "@/lib/tools/schema";
import AvatarPicker, { DEFAULT_TOOL_AVATAR, type ToolAvatarState } from "./AvatarPicker";
import ToolDownload, { ReminderOptIn } from "./ToolDownload";
import { FieldGroup, ToolNameField, ToolPortrait, type NameError } from "./ToolFields";

const AGES = Array.from({ length: TOOL_AGE_MAX - TOOL_AGE_MIN + 1 }, (_, i) => TOOL_AGE_MIN + i);

/** Paper mock of the printed letter (desktop): updates live with the name, portrait, age and layout. */
function LetterPreview({
  locale,
  name,
  age,
  layout,
  avatar,
  portraitAlt,
}: {
  locale: ToolLocale;
  name: string;
  age: number | null;
  layout: "write" | "draw";
  avatar: ToolAvatarState;
  portraitAlt: string;
}) {
  const copy = LETTER_COPY[locale];
  const line = <span className="block h-px w-full bg-line-warm" />;
  return (
    <div aria-hidden className="aspect-[210/297] w-full rounded-lg border border-line bg-white p-[7%] shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-bold uppercase tracking-wide text-brand-text">{copy.kicker}</p>
          <p className="mt-1 font-display text-xl font-bold leading-tight text-ink">{copy.salutation}</p>
        </div>
        <ToolPortrait avatar={avatar} alt={portraitAlt} className="w-16 ring-2" />
      </div>
      <p className="mt-3 truncate text-[11px] text-ink-soft">
        {copy.introName} <span className="font-display text-sm font-bold text-brand-deep">{name || "…"}</span> {copy.introAge}{" "}
        <span className="font-display text-sm font-bold text-brand-deep">{age ?? "__"}</span> {copy.years}
      </p>
      <p className="mt-3 font-display text-[11px] font-semibold text-ink">{copy.behavedHeading}</p>
      <div className="mt-1.5 flex gap-3 text-[9px] text-ink-soft">
        {copy.behavedOptions.map((o) => (
          <span key={o} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px] border border-brand-deep" />
            {o}
          </span>
        ))}
      </div>
      <p className="mt-3 font-display text-[11px] font-semibold text-ink">{copy.wishesHeading}</p>
      {layout === "draw" ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className="block aspect-[4/5] rounded-md border border-dashed border-line-warm" />
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {line}
          {line}
          {line}
        </div>
      )}
      <p className="mt-3 font-display text-[11px] font-semibold text-ink">{copy.kindnessHeading}</p>
      <div className="mt-3 flex flex-col gap-3">
        {line}
        {layout === "write" && line}
      </div>
      <div className="mt-3 h-[22%] rounded-md border border-dashed border-line-warm p-1.5 text-[8px] font-semibold text-ink-muted">
        {copy.drawingHeading}
      </div>
    </div>
  );
}

export default function LetterTool({ locale }: { locale: ToolLocale }) {
  const t = useTranslations("tools.common");
  const tl = useTranslations("tools.letter");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<ToolAvatarState>(DEFAULT_TOOL_AVATAR);
  const [age, setAge] = useState<number | null>(null);
  const [layout, setLayout] = useState<"write" | "draw">("write");
  const [nameError, setNameError] = useState<NameError>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const display = formatChildName(name);
  const portraitAlt = display ? t("portraitAlt", { name: display }) : t("portraitAltNoName");

  const buildInput = (): LetterInput | null => {
    if (!name.trim() || !TOOL_NAME_PATTERN.test(name.trim())) return null;
    return { tool: "letter", locale, name: name.trim(), avatar, age, layout };
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* Desktop: live paper preview, sticky under the header */}
      <aside className="hidden lg:block lg:self-start lg:sticky" style={{ top: "calc(var(--landing-nav-h, 64px) + 1.5rem)" }}>
        <LetterPreview locale={locale} name={display} age={age} layout={layout} avatar={avatar} portraitAlt={portraitAlt} />
        <p className="mt-3 text-center text-xs text-ink-muted">{tl("previewCaption")}</p>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        {/* Phone: portrait + name strip, sticky under the header while the picker scrolls */}
        <div
          className="sticky z-20 -mx-4 -mt-2 flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden"
          style={{ top: "var(--landing-nav-h, 56px)" }}
        >
          <ToolPortrait avatar={avatar} alt={portraitAlt} className="w-14 ring-2" />
          <div className="min-w-0">
            {display && <p className="truncate font-display text-lg font-bold leading-tight text-ink">{display}</p>}
            <p className="text-xs text-ink-muted">{tl("previewCaption")}</p>
          </div>
        </div>

        <ToolNameField
          ref={nameRef}
          id="letter-name"
          value={name}
          error={nameError}
          onChange={(v) => {
            setName(v);
            setHeroName(v);
            if (nameError) setNameError(null);
          }}
        />

        <FieldGroup id="letter-portrait" title={t("portraitHeading")} hint={t("portraitHint")}>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </FieldGroup>

        <FieldGroup id="letter-options" title={tl("layoutLabel")} hint={tl("layoutHint")}>
          <div role="radiogroup" aria-labelledby="letter-options" className="grid grid-cols-2 gap-2">
            {(["write", "draw"] as const).map((l) => (
              <ChoiceChip key={l} selected={layout === l} onClick={() => setLayout(l)}>
                {tl(l === "write" ? "layoutWrite" : "layoutDraw")}
              </ChoiceChip>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow as="label" htmlFor="letter-age">
              {tl("ageLabel")}
            </Eyebrow>
            <select
              id="letter-age"
              value={age ?? ""}
              onChange={(e) => setAge(e.target.value ? Number(e.target.value) : null)}
              aria-describedby="letter-age-hint"
              className={cx(
                "h-12 w-full rounded-2xl border-2 border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-brand sm:max-w-xs",
              )}
              data-testid="letter-age"
            >
              <option value="">{tl("ageNone")}</option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {tl("ageOption", { age: a })}
                </option>
              ))}
            </select>
            <p id="letter-age-hint" className="text-xs text-ink-muted">
              {tl("ageHint")}
            </p>
          </div>
        </FieldGroup>

        <div className="flex flex-col gap-4 border-t border-line pt-6">
          <ToolDownload
            tool="letter"
            label={tl("download")}
            buildInput={buildInput}
            onInvalid={() => {
              setNameError(name.trim() ? "invalid" : "required");
              nameRef.current?.focus();
            }}
          />
          <ReminderOptIn />
        </div>
      </div>
    </div>
  );
}
