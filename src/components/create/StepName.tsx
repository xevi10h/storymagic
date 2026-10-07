"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterData, Gender } from "@/lib/create-store";
import { MAX_NAME_LENGTH } from "@/lib/creation-flow";
import { formatChildName } from "@/lib/child-name";
import LiveCover from "./LiveCover";
import CreationFooterNav from "./CreationFooterNav";

interface StepNameProps {
  character: CharacterData;
  /** Age / gender explicitly picked by the parent (never preselected). */
  basicsConfirmed: { age: boolean; gender: boolean };
  selectedTemplate: string | null;
  onUpdateCharacter: (updates: Partial<CharacterData>) => void;
  onPickAge: (age: number) => void;
  onPickGender: (gender: Gender) => void;
  onNext: () => void;
}

// 2–12: the youngest book plan is written for 2–4 (refrain mode); ages 2–6 use the
// "small" avatar band. Age 1 is not offered (no reading plan for it).
const AGES = Array.from({ length: 11 }, (_, i) => i + 2);
const GENDERS: { id: Gender; key: "genderBoy" | "genderGirl" | "genderNeutral" }[] = [
  { id: "girl", key: "genderGirl" },
  { id: "boy", key: "genderBoy" },
  { id: "neutral", key: "genderNeutral" },
];

/**
 * Screen 1 — the name, with the cover rendered live on every keystroke, plus age and gender.
 * Age and gender start unselected: the story is written in the child's grammatical gender and
 * for their age, so a silent default ("un niño", 5) would print the wrong book.
 */
export default function StepName({
  character,
  basicsConfirmed,
  selectedTemplate,
  onUpdateCharacter,
  onPickAge,
  onPickGender,
  onNext,
}: StepNameProps) {
  const t = useTranslations("crear.name");
  const hasName = character.name.trim().length > 0;
  // Same rule as the other screens: "next" stays disabled until every required answer is in,
  // and the footer says which one is missing.
  const missingHint = !hasName
    ? t("nameRequired")
    : !basicsConfirmed.age
      ? t("ageRequired")
      : !basicsConfirmed.gender
        ? t("genderRequired")
        : undefined;
  // Errors show only after Enter in the name field with answers missing (no red on arrival).
  const [attempted, setAttempted] = useState(false);
  const ageRef = useRef<HTMLFieldSetElement>(null);
  const genderRef = useRef<HTMLFieldSetElement>(null);
  const ageMissing = attempted && !basicsConfirmed.age;
  const genderMissing = attempted && !basicsConfirmed.gender;

  const tryNext = () => {
    if (!hasName) return;
    if (basicsConfirmed.age && basicsConfirmed.gender) {
      onNext();
      return;
    }
    setAttempted(true);
    // Bring the first missing question into view and put focus on its first option.
    const target = !basicsConfirmed.age ? ageRef.current : genderRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.querySelector<HTMLButtonElement>("[role=radio]")?.focus({ preventScroll: true });
  };

  const chipBase =
    "flex items-center justify-center rounded-xl border-2 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary";

  return (
    <>
      <main className="step-in mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pb-8 pt-5 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:pt-10">
        <div className="mx-auto w-[min(56vw,230px)] shrink-0 sm:w-[300px] lg:mx-0 lg:w-[440px]">
          <LiveCover
            name={character.name}
            gender={basicsConfirmed.gender ? character.gender : undefined}
            templateId={selectedTemplate}
            priority
          />
        </div>

        <form
          className="flex w-full min-w-0 flex-1 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            tryNext();
          }}
        >
          <div className="text-center lg:text-left">
            <h1 className="font-display text-[26px] font-bold leading-tight text-create-text-dark sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-create-text-sub sm:text-base">{t("subtitle")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="child-name" className="text-xs font-bold uppercase tracking-wide text-create-text">
              {t("nameLabel")}
            </label>
            <input
              id="child-name"
              type="text"
              value={character.name}
              onChange={(e) => onUpdateCharacter({ name: e.target.value })}
              onBlur={(e) => {
                const name = formatChildName(e.target.value);
                if (name !== e.target.value) onUpdateCharacter({ name });
              }}
              placeholder={t("namePlaceholder")}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              autoFocus
              className="h-16 w-full rounded-2xl border-2 border-create-neutral bg-white px-5 font-display text-2xl font-semibold text-create-text-dark outline-none transition-colors placeholder:font-normal placeholder:text-create-text-sub/45 focus:border-create-primary"
            />
          </div>

          <fieldset ref={ageRef} className="flex scroll-mt-24 flex-col gap-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-create-text">{t("ageLabel")}</legend>
            <div
              role="radiogroup"
              aria-label={t("ageLabel")}
              aria-required
              aria-invalid={ageMissing || undefined}
              aria-describedby={ageMissing ? "age-error" : "age-hint"}
              className={`grid grid-cols-6 gap-2 rounded-2xl transition-shadow ${ageMissing ? "ring-2 ring-red-300 ring-offset-4 ring-offset-create-bg" : ""}`}
            >
              {AGES.map((age) => {
                const selected = basicsConfirmed.age && character.age === age;
                return (
                  <button
                    key={age}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t("ageOption", { age })}
                    onClick={() => {
                      onPickAge(age);
                      // On a phone the last question sits under the footer: bring it up,
                      // since "next" stays disabled until it is answered.
                      if (!basicsConfirmed.gender) genderRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className={`${chipBase} h-11 text-base tabular-nums ${
                      selected
                        ? "border-brand bg-brand-tint text-brand-text"
                        : "border-create-neutral bg-white text-create-text hover:border-create-primary/40"
                    }`}
                  >
                    {age}
                  </button>
                );
              })}
            </div>
            {ageMissing ? (
              <p id="age-error" role="alert" className="text-xs font-semibold text-red-700">
                {t("ageRequired")}
              </p>
            ) : (
              <p id="age-hint" className="text-xs text-create-text-sub">{t("ageHint")}</p>
            )}
          </fieldset>

          <fieldset ref={genderRef} className="flex scroll-mt-24 flex-col gap-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-create-text">{t("genderLabel")}</legend>
            <div
              role="radiogroup"
              aria-label={t("genderLabel")}
              aria-required
              aria-invalid={genderMissing || undefined}
              aria-describedby={genderMissing ? "gender-error" : "gender-hint"}
              className={`grid grid-cols-3 gap-2 rounded-2xl transition-shadow ${genderMissing ? "ring-2 ring-red-300 ring-offset-4 ring-offset-create-bg" : ""}`}
            >
              {GENDERS.map((g) => {
                const selected = basicsConfirmed.gender && character.gender === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onPickGender(g.id)}
                    className={`${chipBase} min-h-11 px-2 py-2 text-sm leading-tight ${
                      selected
                        ? "border-create-primary bg-brand-tint text-brand-text"
                        : "border-create-neutral bg-white text-create-text hover:border-create-primary/40"
                    }`}
                  >
                    {t(g.key)}
                  </button>
                );
              })}
            </div>
            {genderMissing ? (
              <p id="gender-error" role="alert" className="text-xs font-semibold text-red-700">
                {t("genderRequired")}
              </p>
            ) : (
              <p id="gender-hint" className="text-xs text-create-text-sub">{t("genderHint")}</p>
            )}
          </fieldset>
          {/* Enter in the name field submits the form */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </main>

      <CreationFooterNav
        onNext={tryNext}
        nextDisabled={!!missingHint}
        nextDisabledTooltip={missingHint}
      />
    </>
  );
}
