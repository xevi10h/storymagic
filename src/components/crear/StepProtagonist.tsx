"use client";

import { useTranslations } from "next-intl";
import ProtagonistAvatar, { type ProtagonistLook } from "@/components/avatar/ProtagonistAvatar";
import { AVATAR_GLASSES_SHAPES, AVATAR_HAIRSTYLES, type AvatarGlassesColour } from "@/lib/avatar/manifest";
import {
  EYE_COLORS,
  FAVORITE_COLORS,
  HAIRSTYLES,
  HAIR_COLORS,
  SKIN_TONES,
  type CharacterData,
  type ProtagonistMode,
} from "@/lib/create-store";
import { isPhotoUploadEnabled } from "@/lib/creation-flow";
import CreationFooterNav from "./CreationFooterNav";
import PhotoUploadPanel from "./PhotoUploadPanel";

interface StepProtagonistProps {
  character: CharacterData;
  protagonistMode: ProtagonistMode;
  photoPath: string | null;
  onUpdateCharacter: (updates: Partial<CharacterData>) => void;
  onSetMode: (mode: ProtagonistMode) => void;
  onPhotoChange: (photoPath: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function toAvatarTraits(c: CharacterData): ProtagonistLook {
  return {
    gender: c.gender,
    age: c.age,
    skinTone: c.skinTone,
    hairColor: c.hairColor,
    hairstyle: c.hairstyle,
    eyeColor: c.eyeColor,
    glasses: c.glasses,
    freckles: c.freckles,
  };
}

/** Glasses = shape × frame colour (avatar matrix overlays, src/lib/avatar/manifest.ts). */
const GLASSES_SHAPES = ["none", ...AVATAR_GLASSES_SHAPES] as const;
const GLASSES_FRAMES: { id: AvatarGlassesColour; color: string }[] = [
  { id: "dark", color: "#2c2626" },
  { id: "red", color: "#b23a2c" },
];

/** Light swatches need a dark check mark ("" = the "no preference" swatch). */
const LIGHT_SWATCHES = new Set(["#fce4d6", "#eebb99", "#e6c07b", "#d4a574", "#a0875b", "#FDD835", ""]);

/** Favourite colour: optional — "" (no preference) gives the book its neutral warm palette. */
const FAVORITE_COLOR_OPTIONS: { id: string; color: string }[] = [{ id: "none", color: "" }, ...FAVORITE_COLORS];

function SwatchGroup({
  id,
  label,
  options,
  value,
  labelFor,
  onChange,
  hint,
  className = "",
}: {
  id: string;
  label: string;
  options: { id: string; color: string }[];
  value: string;
  labelFor: (id: string) => string;
  onChange: (color: string) => void;
  hint?: string;
  className?: string;
}) {
  const selectedId = options.find((o) => o.color === value)?.id ?? null;
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-create-text" id={`lbl-${id}`}>
          {label}
        </span>
        {hint && <span className="text-xs text-create-text-sub">{hint}</span>}
      </div>
      <div role="radiogroup" aria-labelledby={`lbl-${id}`} className="flex flex-wrap gap-2.5">
        {options.map((o) => {
          const selected = value === o.color;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={labelFor(o.id)}
              title={labelFor(o.id)}
              onClick={() => onChange(o.color)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary ${
                o.color ? "border-black/10" : "border-dashed border-create-text-sub/50 bg-white"
              } ${selected ? "scale-105 ring-[3px] ring-create-primary ring-offset-2 ring-offset-white" : "hover:scale-105"}`}
              style={o.color ? { backgroundColor: o.color } : undefined}
            >
              {selected && (
                <span
                  aria-hidden
                  className={`material-symbols-outlined text-lg font-bold ${
                    LIGHT_SWATCHES.has(o.color) ? "text-create-text-dark" : "text-white"
                  }`}
                >
                  check
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Visible name of the current choice (colour alone is not enough) */}
      <span aria-hidden className="text-xs font-semibold text-create-text-sub" data-testid={`selected-${id}`}>
        {selectedId ? labelFor(selectedId) : "\u00a0"}
      </span>
    </div>
  );
}

/** Screen 2 — the protagonist: build the look (default) or upload a photo (flagged). */
export default function StepProtagonist({
  character,
  protagonistMode,
  photoPath,
  onUpdateCharacter,
  onSetMode,
  onPhotoChange,
  onNext,
  onBack,
}: StepProtagonistProps) {
  const t = useTranslations("crear.protagonist");
  const td = useTranslations("data");
  const photoEnabled = isPhotoUploadEnabled();
  const mode: ProtagonistMode = photoEnabled ? protagonistMode : "avatar";
  const traits = toAvatarTraits(character);
  const name = character.name.trim();
  const canContinue = mode === "avatar" || !!photoPath;
  const [glassesShape, glassesFrame] =
    character.glasses === "none"
      ? (["none", "dark"] as const)
      : (character.glasses.split("-") as [(typeof AVATAR_GLASSES_SHAPES)[number], AvatarGlassesColour]);

  const chip = (selected: boolean) =>
    `rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary ${
      selected
        ? "border-create-primary bg-create-primary/10 text-create-primary"
        : "border-create-neutral bg-white text-create-text hover:border-create-primary/40"
    }`;

  const portrait = (
    <div className="flex items-center gap-4 lg:flex-col lg:gap-5">
      <div
        className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-full bg-[#fbeee2] ring-4 ring-white shadow-[0_12px_28px_-16px_rgba(58,36,24,.6)] sm:w-28 lg:w-[300px]"
        data-testid="protagonist-portrait"
      >
        {mode === "photo" ? (
          <span className="absolute inset-0 flex items-center justify-center text-create-primary/70">
            <span aria-hidden className="material-symbols-outlined text-4xl lg:text-7xl">
              {photoPath ? "check_circle" : "add_a_photo"}
            </span>
          </span>
        ) : (
          <ProtagonistAvatar look={traits} alt={name} priority className="absolute inset-0 h-full w-full" />
        )}
      </div>
      <div className="min-w-0 lg:text-center">
        <p className="truncate font-display text-xl font-bold text-create-text-dark lg:text-2xl">{name}</p>
        <p className="text-xs font-medium text-create-text-sub lg:text-sm">
          {mode === "photo" ? t("photoNote") : t("avatarNote")}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <main className="step-in mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pb-8 pt-4 sm:px-6 lg:flex-row lg:gap-14 lg:pt-8">
        {/* Portrait: sticky strip on mobile, sticky column on desktop */}
        <aside
          className="sticky z-20 -mx-4 mb-3 border-b border-create-primary/10 bg-create-bg px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:h-fit lg:self-start lg:[--portrait-gap:2rem] lg:w-[340px] lg:shrink-0 lg:border-none lg:bg-transparent lg:p-0"
          style={{ top: "calc(var(--creation-header-h, 0px) + var(--portrait-gap, 0px))" }}
        >
          {portrait}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="text-center lg:text-left">
            <h1 className="font-display text-[26px] font-bold leading-tight text-create-text-dark sm:text-4xl">
              {t("title", { name })}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-create-text-sub sm:text-base">{t("subtitle")}</p>
          </div>

          {photoEnabled && (
            <div role="tablist" aria-label={t("tabsLabel")} className="grid grid-cols-2 gap-1 rounded-2xl bg-create-neutral p-1">
              {(["avatar", "photo"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  id={`tab-${m}`}
                  aria-selected={mode === m}
                  aria-controls={`panel-${m}`}
                  onClick={() => onSetMode(m)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                    mode === m ? "bg-white text-create-text-dark shadow-sm" : "text-create-text-sub hover:text-create-text"
                  }`}
                >
                  {m === "avatar" ? t("tabAvatar") : t("tabPhoto")}
                </button>
              ))}
            </div>
          )}

          {mode === "avatar" ? (
            <div
              id="panel-avatar"
              role={photoEnabled ? "tabpanel" : undefined}
              aria-labelledby={photoEnabled ? "tab-avatar" : undefined}
              className="grid gap-6 sm:grid-cols-2"
            >
              <SwatchGroup
                id="skin"
                label={t("skin")}
                options={SKIN_TONES}
                value={character.skinTone}
                labelFor={(id) => td(`skinTones.${id}`)}
                onChange={(skinTone) => onUpdateCharacter({ skinTone })}
              />
              <SwatchGroup
                id="hairColor"
                label={t("hairColor")}
                options={HAIR_COLORS}
                value={character.hairColor}
                labelFor={(id) => td(`hairColors.${id}`)}
                onChange={(hairColor) => onUpdateCharacter({ hairColor })}
              />

              <div className="flex flex-col gap-2.5 sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-create-text" id="lbl-hairstyle">
                  {t("hairstyle")}
                </span>
                <div role="radiogroup" aria-labelledby="lbl-hairstyle" className="grid grid-cols-4 gap-2 lg:grid-cols-8">
                  {HAIRSTYLES[character.gender].filter((hs) => (AVATAR_HAIRSTYLES[character.gender] as readonly string[]).includes(hs.id)).map((hs) => {
                    const selected = character.hairstyle === hs.id;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onUpdateCharacter({ hairstyle: hs.id })}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary ${
                          selected ? "border-create-primary" : "border-create-neutral hover:border-create-primary/40"
                        }`}
                      >
                        <span className="aspect-square w-full overflow-hidden rounded-lg bg-[#fbeee2]">
                          <ProtagonistAvatar look={{ ...traits, hairstyle: hs.id, glasses: "none" }} preloadNeighbours={false} className="h-full w-full" />
                        </span>
                        <span className={`text-[11px] font-bold leading-tight ${selected ? "text-create-primary" : "text-create-text"}`}>
                          {td(`hairstyles.${hs.id}`)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <SwatchGroup
                id="eyes"
                label={t("eyes")}
                options={EYE_COLORS}
                value={character.eyeColor}
                labelFor={(id) => td(`eyeColors.${id}`)}
                onChange={(eyeColor) => onUpdateCharacter({ eyeColor })}
              />

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wide text-create-text" id="lbl-glasses">
                  {t("glasses")}
                </span>
                <div role="radiogroup" aria-labelledby="lbl-glasses" className="flex flex-wrap gap-2">
                  {GLASSES_SHAPES.map((shape) => {
                    const selected = glassesShape === shape;
                    return (
                      <button
                        key={shape}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          onUpdateCharacter({ glasses: shape === "none" ? "none" : `${shape}-${glassesFrame}` })
                        }
                        className={chip(selected)}
                      >
                        {t(`glasses_${shape}`)}
                      </button>
                    );
                  })}
                </div>
                {glassesShape !== "none" && (
                  <div role="radiogroup" aria-label={t("glassesFrame")} className="flex items-center gap-2.5">
                    {GLASSES_FRAMES.map((f) => {
                      const selected = glassesFrame === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={t(`glassesFrame_${f.id}`)}
                          title={t(`glassesFrame_${f.id}`)}
                          onClick={() => onUpdateCharacter({ glasses: `${glassesShape}-${f.id}` })}
                          className={`h-8 w-8 rounded-full border border-black/10 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary ${
                            selected ? "ring-[3px] ring-create-primary ring-offset-2 ring-offset-white" : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: f.color }}
                        />
                      );
                    })}
                    <span aria-hidden className="text-xs font-semibold text-create-text-sub" data-testid="selected-glasses-frame">
                      {t(`glassesFrame_${glassesFrame}`)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border-2 border-create-neutral bg-white px-4 py-3 sm:col-span-2">
                <span className="text-sm font-bold text-create-text" id="lbl-freckles">
                  {t("freckles")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={character.freckles}
                  aria-labelledby="lbl-freckles"
                  onClick={() => onUpdateCharacter({ freckles: !character.freckles })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-create-primary ${
                    character.freckles ? "bg-create-primary" : "bg-create-neutral"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                      character.freckles ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : (
            <div id="panel-photo" role="tabpanel" aria-labelledby="tab-photo">
              <PhotoUploadPanel name={name} photoPath={photoPath} onPhotoChange={onPhotoChange} />
            </div>
          )}

          {/* Leads the book's palette (src/lib/template-colors.ts) and the jacket colour of the Character Bible */}
          <SwatchGroup
            id="favoriteColor"
            label={t("favoriteColor")}
            hint={t("favoriteColorHint")}
            options={FAVORITE_COLOR_OPTIONS}
            value={character.favoriteColor}
            labelFor={(id) => (id === "none" ? t("favoriteColorNone") : td(`favoriteColors.${id}`))}
            onChange={(favoriteColor) => onUpdateCharacter({ favoriteColor })}
            className="border-t border-create-primary/10 pt-5"
          />
        </div>
      </main>

      <CreationFooterNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!canContinue}
        nextDisabledTooltip={t("photoRequired")}
      />
    </>
  );
}
