"use client";

import { useTranslations } from "next-intl";
import WatercolorAvatar from "@/components/avatar/WatercolorAvatar";
import { ChoiceChip, Eyebrow, cx, focusRing } from "@/components/ui";
import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRSTYLES,
  AVATAR_SKIN_TONES,
  normaliseHairstyle,
  type AvatarTraits,
} from "@/lib/avatar/manifest";
import type { ToolAvatar } from "@/lib/tools/schema";

/** Picker state = the API's avatar input (eye colour is not offered: too small in print). */
export type ToolAvatarState = ToolAvatar;

export const DEFAULT_TOOL_AVATAR: ToolAvatarState = {
  gender: "girl",
  ageBand: "small",
  skinTone: "medium-light",
  hairColor: "brown-dark",
  hairstyle: "long",
  glasses: "none",
  freckles: false,
};

/** Display traits for WatercolorAvatar (base eye colour, as printed). */
export function displayTraits(a: ToolAvatarState): AvatarTraits {
  return { ...a, eyeColor: "brown" } as AvatarTraits;
}

const LIGHT_SWATCHES = new Set(["#fce4d6", "#eebb99", "#e6c07b", "#d4a574"]);
const GLASSES = ["none", "round-dark", "square-dark"] as const;
const GLASSES_LABEL: Record<(typeof GLASSES)[number], string> = {
  none: "glasses_none",
  "round-dark": "glasses_round",
  "square-dark": "glasses_square",
};

function Swatches({
  id,
  label,
  options,
  value,
  labelFor,
  onChange,
}: {
  id: string;
  label: string;
  options: readonly { id: string; hex: string }[];
  value: string;
  labelFor: (id: string) => string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow as="span" id={`lbl-${id}`}>
        {label}
      </Eyebrow>
      <div role="radiogroup" aria-labelledby={`lbl-${id}`} className="flex flex-wrap gap-2.5">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={labelFor(o.id)}
              title={labelFor(o.id)}
              onClick={() => onChange(o.id)}
              className={cx(
                "flex h-11 w-11 items-center justify-center rounded-full border border-black/10 transition-transform",
                focusRing,
                selected ? "scale-105 ring-[3px] ring-brand ring-offset-2 ring-offset-surface" : "hover:scale-105",
              )}
              style={{ backgroundColor: o.hex }}
            >
              {selected && (
                <span aria-hidden className={cx("material-symbols-outlined !text-lg font-bold", LIGHT_SWATCHES.has(o.hex) ? "text-ink" : "text-white")}>
                  check
                </span>
              )}
            </button>
          );
        })}
      </div>
      <span aria-hidden className="text-xs font-semibold text-ink-muted">
        {labelFor(value)}
      </span>
    </div>
  );
}

/**
 * The "Créalo tú" portrait picker, compact: gender, age band, skin, hair colour,
 * hairstyle (live thumbnails), glasses and freckles, over the same pre-rendered
 * watercolour matrix as /create (src/lib/avatar/manifest.ts). No photo, no cost.
 */
export default function AvatarPicker({
  value,
  onChange,
  showGenderHint = false,
}: {
  value: ToolAvatarState;
  onChange: (next: ToolAvatarState) => void;
  showGenderHint?: boolean;
}) {
  const t = useTranslations("tools.common");
  const tp = useTranslations("crear.protagonist");
  const td = useTranslations("data");
  const set = (patch: Partial<ToolAvatarState>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Eyebrow as="span" id="lbl-tool-gender">
          {t("genderLabel")}
        </Eyebrow>
        <div role="radiogroup" aria-labelledby="lbl-tool-gender" className="grid grid-cols-3 gap-2">
          {(["girl", "boy", "neutral"] as const).map((g) => (
            <ChoiceChip
              key={g}
              selected={value.gender === g}
              onClick={() => set({ gender: g, hairstyle: normaliseHairstyle(g, value.hairstyle) })}
            >
              {t(g === "girl" ? "genderGirl" : g === "boy" ? "genderBoy" : "genderNeutral")}
            </ChoiceChip>
          ))}
        </div>
        {showGenderHint && <p className="text-xs text-ink-muted">{t("genderHint")}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow as="span" id="lbl-tool-age-band">
          {t("ageBand")}
        </Eyebrow>
        <div role="radiogroup" aria-labelledby="lbl-tool-age-band" className="grid grid-cols-2 gap-2">
          {(["small", "big"] as const).map((band) => (
            <ChoiceChip key={band} selected={value.ageBand === band} onClick={() => set({ ageBand: band })}>
              {t(band === "small" ? "ageSmall" : "ageBig")}
            </ChoiceChip>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Swatches
          id="tool-skin"
          label={tp("skin")}
          options={AVATAR_SKIN_TONES}
          value={value.skinTone}
          labelFor={(id) => td(`skinTones.${id}`)}
          onChange={(id) => set({ skinTone: id as ToolAvatarState["skinTone"] })}
        />
        <Swatches
          id="tool-hair"
          label={tp("hairColor")}
          options={AVATAR_HAIR_COLORS}
          value={value.hairColor}
          labelFor={(id) => td(`hairColors.${id}`)}
          onChange={(id) => set({ hairColor: id as ToolAvatarState["hairColor"] })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Eyebrow as="span" id="lbl-tool-hairstyle">
          {tp("hairstyle")}
        </Eyebrow>
        <div role="radiogroup" aria-labelledby="lbl-tool-hairstyle" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {AVATAR_HAIRSTYLES[value.gender].map((hs) => {
            const selected = value.hairstyle === hs;
            return (
              <button
                key={hs}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set({ hairstyle: hs })}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl border-2 bg-surface p-1.5 transition-colors",
                  focusRing,
                  selected ? "border-brand bg-brand-tint" : "border-line hover:border-brand/40",
                )}
              >
                <span className="aspect-square w-full overflow-hidden rounded-lg bg-line">
                  <WatercolorAvatar
                    traits={displayTraits({ ...value, hairstyle: hs, glasses: "none" })}
                    alt=""
                    size="fill"
                    round={false}
                    preloadNeighbours={false}
                  />
                </span>
                <span className={cx("text-[11px] font-bold leading-tight", selected ? "text-brand-text" : "text-ink-soft")}>
                  {td(`hairstyles.${hs}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Eyebrow as="span" id="lbl-tool-glasses">
            {tp("glasses")}
          </Eyebrow>
          <div role="radiogroup" aria-labelledby="lbl-tool-glasses" className="grid grid-cols-3 gap-2">
            {GLASSES.map((g) => (
              <ChoiceChip key={g} selected={value.glasses === g} onClick={() => set({ glasses: g })}>
                {tp(GLASSES_LABEL[g])}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border-2 border-line bg-surface px-4 py-2 sm:min-w-40">
          <span className="text-sm font-bold text-ink-soft" id="lbl-tool-freckles">
            {tp("freckles")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={value.freckles}
            aria-labelledby="lbl-tool-freckles"
            onClick={() => set({ freckles: !value.freckles })}
            className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", focusRing, value.freckles ? "bg-brand" : "bg-line")}
          >
            <span
              aria-hidden
              className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left]", value.freckles ? "left-6" : "left-1")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
