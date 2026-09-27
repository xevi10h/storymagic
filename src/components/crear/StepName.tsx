"use client";

import { useTranslations } from "next-intl";
import type { CharacterData, Gender } from "@/lib/create-store";
import { MAX_NAME_LENGTH } from "@/lib/creation-flow";
import LiveCover from "./LiveCover";
import CreationFooterNav from "./CreationFooterNav";

interface StepNameProps {
  character: CharacterData;
  selectedTemplate: string | null;
  onUpdateCharacter: (updates: Partial<CharacterData>) => void;
  onNext: () => void;
}

const AGES = Array.from({ length: 12 }, (_, i) => i + 1);
const GENDERS: { id: Gender; key: "genderBoy" | "genderGirl" | "genderNeutral" }[] = [
  { id: "girl", key: "genderGirl" },
  { id: "boy", key: "genderBoy" },
  { id: "neutral", key: "genderNeutral" },
];

/** Screen 1 — the name, with the cover rendered live on every keystroke. */
export default function StepName({ character, selectedTemplate, onUpdateCharacter, onNext }: StepNameProps) {
  const t = useTranslations("crear.name");
  const canContinue = character.name.trim().length > 0;

  const chipBase =
    "flex items-center justify-center rounded-xl border-2 font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary";

  return (
    <>
      <main className="step-in mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 pb-8 pt-5 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:pt-10">
        <div className="mx-auto w-[min(56vw,230px)] shrink-0 sm:w-[300px] lg:mx-0 lg:w-[440px]">
          <LiveCover name={character.name} templateId={selectedTemplate} priority />
        </div>

        <form
          className="flex w-full min-w-0 flex-1 flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue) onNext();
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

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-create-text">{t("ageLabel")}</legend>
            <div role="radiogroup" aria-label={t("ageLabel")} className="grid grid-cols-6 gap-2">
              {AGES.map((age) => {
                const selected = character.age === age;
                return (
                  <button
                    key={age}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t("ageOption", { age })}
                    onClick={() => onUpdateCharacter({ age })}
                    className={`${chipBase} h-11 text-base tabular-nums ${
                      selected
                        ? "border-create-primary bg-create-primary text-white"
                        : "border-create-neutral bg-white text-create-text hover:border-create-primary/40"
                    }`}
                  >
                    {age}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-create-text">{t("genderLabel")}</legend>
            <div role="radiogroup" aria-label={t("genderLabel")} className="grid grid-cols-3 gap-2">
              {GENDERS.map((g) => {
                const selected = character.gender === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onUpdateCharacter({ gender: g.id })}
                    className={`${chipBase} min-h-11 px-2 py-2 text-sm leading-tight ${
                      selected
                        ? "border-create-primary bg-create-primary/10 text-create-primary"
                        : "border-create-neutral bg-white text-create-text hover:border-create-primary/40"
                    }`}
                  >
                    {t(g.key)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-create-text-sub">{t("genderHint")}</p>
          </fieldset>
          {/* Enter in the name field submits the form */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </main>

      <CreationFooterNav
        onNext={onNext}
        nextDisabled={!canContinue}
        nextDisabledTooltip={t("nameRequired")}
      />
    </>
  );
}
