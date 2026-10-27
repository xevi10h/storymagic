"use client";

// "Crear su personaje" for the Advent calendar: the same pre-rendered watercolour matrix as
// /create ("Créalo tú") through the compact picker of the free printables, plus the name
// and exact age the create flow needs. Saved with POST /api/characters (no book), under the
// signed-in account or the silent guest session, so /create?characterId= reuses it later.

import { useState } from "react";
import { useTranslations } from "next-intl";
import Sheet from "@/components/create/Sheet";
import WatercolorAvatar from "@/components/avatar/WatercolorAvatar";
import AvatarPicker, { DEFAULT_TOOL_AVATAR, displayTraits, type ToolAvatarState } from "@/components/tools/AvatarPicker";
import { Button, ChoiceChip } from "@/components/ui";
import { AVATAR_EYE_COLORS, AVATAR_HAIR_COLORS, AVATAR_SKIN_TONES, AVATAR_BASE_EYE_COLOR, ageBandFor, avatarBaseKey, isAvatarRendered } from "@/lib/avatar/manifest";
import { formatChildName } from "@/lib/child-name";
import { ensureGuestSession } from "@/lib/guest-session";
import type { AdventLocale } from "@/lib/advent/render";

const AGES = Array.from({ length: 11 }, (_, i) => i + 2); // 2–12, as on /create
const NAME_MAX = 40;
const hexOf = <T extends { id: string; hex: string }>(list: readonly T[], id: string) => list.find((x) => x.id === id)?.hex ?? list[0].hex;

export default function CharacterBuilder({
  open,
  locale,
  initialName,
  onClose,
  onSaved,
}: {
  open: boolean;
  locale: AdventLocale;
  initialName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations("advent.builder");
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<number | null>(null);
  const [avatar, setAvatar] = useState<ToolAvatarState>(DEFAULT_TOOL_AVATAR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const band = age ? ageBandFor(age) : avatar.ageBand;
  const look: ToolAvatarState = { ...avatar, ageBand: band };

  async function save() {
    const clean = formatChildName(name.replace(/[^\p{L}\p{M}\s'’-]/gu, "")).slice(0, NAME_MAX).trim();
    if (!clean) return setError(t("nameError"));
    if (!age) return setError(t("ageError"));
    setError(null);
    setSaving(true);
    try {
      await ensureGuestSession(locale);
      const base = displayTraits(look);
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clean,
          gender: look.gender,
          age,
          skinTone: hexOf(AVATAR_SKIN_TONES, look.skinTone),
          hairColor: hexOf(AVATAR_HAIR_COLORS, look.hairColor),
          eyeColor: hexOf(AVATAR_EYE_COLORS, AVATAR_BASE_EYE_COLOR),
          hairstyle: look.hairstyle,
          glasses: look.glasses,
          freckles: look.freckles,
          ...(isAvatarRendered(base) ? { avatarAssetPath: `/images/avatar/${avatarBaseKey(base)}.webp` } : {}),
        }),
      });
      if (!res.ok) throw new Error(`characters ${res.status}`);
      await onSaved();
    } catch (err) {
      console.warn("[advent] saving the character failed:", err);
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={t("title")}
      onClose={onClose}
      closeLabel={t("cancel")}
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <Button block onClick={() => void save()} loading={saving} data-testid="advent-builder-save">
            {t("save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6" data-testid="advent-builder">
        <p className="text-sm leading-relaxed text-ink-body">{t("intro")}</p>
        <div className="flex items-center gap-4">
          <span className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-paper ring-2 ring-line-warm">
            <WatercolorAvatar traits={displayTraits(look)} alt="" size="fill" />
          </span>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink-soft">
            {t("nameLabel")}
            <input
              type="text"
              value={name}
              maxLength={NAME_MAX}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-[1.5px] border-line bg-paper px-3 py-3 text-base font-normal text-ink focus:border-brand focus:outline-none"
              data-testid="advent-builder-name"
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <span id="advent-age-label" className="text-sm font-semibold text-ink-soft">
            {t("ageLabel")}
          </span>
          <div role="radiogroup" aria-labelledby="advent-age-label" className="grid grid-cols-6 gap-2">
            {AGES.map((a) => (
              <ChoiceChip key={a} selected={age === a} onClick={() => setAge(a)} aria-label={t("years", { age: a })}>
                {a}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <AvatarPicker value={look} onChange={setAvatar} hideAgeBand />
      </div>
    </Sheet>
  );
}
