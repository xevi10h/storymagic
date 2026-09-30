// Creation flow v2 — shared, client-safe helpers (no React, no server imports).
//
// 6 screens, one progress indicator:
//   1 Name · 2 Protagonist · 3 Adventure        → /crear (state in localStorage)
//   4 Dedication while the preview is painted  → /crear/{storyId}/generar
//   5 The book (flipbook + checklist)           → /crear/{storyId}/preview
//   6 Format + payment                          → /crear/{storyId}/preview#checkout-section

import {
  INITIAL_STATE,
  FAVORITE_COLORS,
  GLASSES_OPTIONS,
  type CharacterData,
  type CreateBookState,
} from "@/lib/create-store";
import { avatarBaseKey, avatarTraitsFromCharacter, isAvatarRendered, type AvatarGlasses } from "@/lib/avatar/manifest";
import { STORAGE_KEY } from "@/hooks/usePersistedState";
import { formatChildName } from "@/lib/child-name";

// Single source for the photo policy (pure module, client-safe).
export { PHOTO_CONSENT_VERSION, PHOTO_MAX_UPLOAD_BYTES, PHOTO_MAX_EDGE, isPhotoUploadEnabled } from "@/lib/privacy/child-photo-policy";

export const CREATE_STORAGE_KEY = STORAGE_KEY;
export const TOTAL_CREATION_STEPS = 6;
/** Number of screens handled by the /crear orchestrator (1..3). */
export const CREATE_PAGE_STEPS = 3;
/** Chapters decided on the Adventure screen (depth of every story tree). */
export const ADVENTURE_CHAPTERS = 3;

/** API limits (mirrors the zod schemas in /api/stories). */
export const MAX_NAME_LENGTH = 50;
export const MAX_DEDICATION_LENGTH = 500;
export const MAX_SENDER_LENGTH = 100;

/** Template whose art dresses the live cover before a world is chosen. */
export const DEFAULT_COVER_TEMPLATE = "space";

// ── Persisted draft migration ────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/** v2 drafts before the avatar matrix stored "round" / "square" (no frame colour). */
function migrateGlasses(value: unknown): AvatarGlasses {
  if (value === "round" || value === "square") return `${value}-dark`;
  return GLASSES_OPTIONS.includes(value as AvatarGlasses) ? (value as AvatarGlasses) : "none";
}

/**
 * Accept any previously persisted draft shape and return a valid v2 state.
 *
 * v1 (El Camino, ≤ 2026-09): steps 1 character · 2 path · 3 dedication, plus
 * portraitUrl / recraftStyleId. v1 step 2 and 3 both map to v2 step 3
 * (Adventure): the dedication moved to the wait screen.
 */
export function migrateCreateState(raw: unknown): CreateBookState {
  if (!isRecord(raw)) return INITIAL_STATE;
  const base = INITIAL_STATE;
  const rawChar = isRecord(raw.character) ? raw.character : {};
  const glasses = rawChar.glasses;
  const character: CharacterData = {
    ...base.character,
    ...(rawChar as Partial<CharacterData>),
    name: str(rawChar.name, "").slice(0, MAX_NAME_LENGTH),
    // UI offers 2–12 (older drafts could hold 1)
    age: typeof rawChar.age === "number" ? Math.min(12, Math.max(2, Math.round(rawChar.age))) : base.character.age,
    glasses: migrateGlasses(glasses),
    freckles: rawChar.freckles === true,
    // Only palette colours (or "" = no preference) survive
    favoriteColor: FAVORITE_COLORS.some((c) => c.color === rawChar.favoriteColor) ? (rawChar.favoriteColor as string) : "",
    interests: Array.isArray(rawChar.interests)
      ? rawChar.interests.filter((i): i is string => typeof i === "string")
      : [],
  };

  const isV2 = raw.version === 2;
  const rawStep = typeof raw.currentStep === "number" ? raw.currentStep : 1;
  let currentStep = isV2 ? rawStep : rawStep >= 2 ? 3 : character.name.trim() ? 2 : 1;
  currentStep = Math.min(Math.max(1, Math.round(currentStep)), CREATE_PAGE_STEPS);

  const selectedTemplate = typeof raw.selectedTemplate === "string" ? raw.selectedTemplate : null;
  // Screens need their prerequisites: no protagonist without a name, etc.
  if (!character.name.trim()) currentStep = 1;

  const createdStory =
    isV2 && isRecord(raw.createdStory) &&
    typeof raw.createdStory.id === "string" &&
    typeof raw.createdStory.snapshot === "string"
      ? { id: raw.createdStory.id, snapshot: raw.createdStory.snapshot }
      : null;

  return {
    ...base,
    version: 2,
    currentStep,
    mode: raw.mode === "juntos" ? "juntos" : "solo",
    character,
    protagonistMode: isV2 && raw.protagonistMode === "photo" ? "photo" : "avatar",
    photoPath: isV2 && typeof raw.photoPath === "string" ? raw.photoPath : null,
    characterPrepId: isV2 && typeof raw.characterPrepId === "string" ? raw.characterPrepId : null,
    characterPrepSnapshot:
      isV2 && typeof raw.characterPrepSnapshot === "string" ? raw.characterPrepSnapshot : null,
    selectedTemplate,
    decisions: isRecord(raw.decisions) ? (raw.decisions as CreateBookState["decisions"]) : {},
    dedication: str(raw.dedication, "").slice(0, MAX_DEDICATION_LENGTH),
    senderName: str(raw.senderName, "").slice(0, MAX_SENDER_LENGTH),
    ending: typeof raw.ending === "string" ? raw.ending : null,
    endingNote: str(raw.endingNote, ""),
    createdStory,
  };
}

/**
 * Read-modify-write the persisted draft from outside /crear (wait + preview
 * screens). With `forStoryId`, only touches the draft that created that story.
 */
export function patchStoredDraft(patch: Partial<CreateBookState>, forStoryId?: string): void {
  try {
    const raw = localStorage.getItem(CREATE_STORAGE_KEY);
    if (forStoryId && !raw) return;
    const current = migrateCreateState(JSON.parse(raw ?? "null"));
    if (forStoryId && current.createdStory?.id !== forStoryId) return;
    localStorage.setItem(CREATE_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // storage unavailable — the draft simply isn't updated
  }
}

export function readStoredDraft(): CreateBookState | null {
  try {
    const raw = localStorage.getItem(CREATE_STORAGE_KEY);
    return raw ? migrateCreateState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearStoredDraft(): void {
  try {
    localStorage.removeItem(CREATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── Request payloads (one builder → prepare and stories can never disagree) ──

/**
 * Everything the Character Bible is built from. POST /api/characters/prepare and
 * POST /api/stories both send exactly this object, so the prepared child sheet's
 * Bible hash matches the story's and the generate route can reuse it.
 */
export function characterLookPayload(c: CharacterData) {
  return {
    gender: c.gender,
    age: c.age,
    skinTone: c.skinTone,
    hairColor: c.hairColor,
    eyeColor: c.eyeColor,
    hairstyle: c.hairstyle,
    favoriteColor: c.favoriteColor,
    glasses: c.glasses,
    freckles: c.freckles,
  };
}

/**
 * Public path of the pre-rendered watercolor avatar base for these traits (the
 * face anchor of the character sheet), or null while the matrix does not contain
 * it yet. Overlays (glasses, freckles) are not part of the anchor: the Bible text
 * carries them.
 */
export function avatarAssetPathFor(c: CharacterData): string | null {
  const traits = avatarTraitsFromCharacter(c);
  return isAvatarRendered(traits) ? `/images/avatar/${avatarBaseKey(traits)}.webp` : null;
}

/** Body of POST /api/characters/prepare for a draft. */
export function characterPrepareBody(state: Pick<CreateBookState, "character" | "protagonistMode" | "photoPath">) {
  const usePhoto = state.protagonistMode === "photo" && !!state.photoPath;
  const avatarAssetPath = usePhoto ? null : avatarAssetPathFor(state.character);
  return {
    ...characterLookPayload(state.character),
    ...(usePhoto ? { photoPath: state.photoPath } : {}),
    ...(avatarAssetPath ? { avatarAssetPath } : {}),
  };
}

/** `character` + avatar fields of POST /api/stories for a draft. */
export function storyCharacterBody(state: Pick<CreateBookState, "character" | "protagonistMode" | "photoPath">) {
  const c = state.character;
  const usePhoto = state.protagonistMode === "photo" && !!state.photoPath;
  const avatarAssetPath = usePhoto ? null : avatarAssetPathFor(c);
  return {
    character: {
      ...characterLookPayload(c),
      name: formatChildName(c.name),
      city: c.city,
      interests: c.interests,
      favoriteCompanion: c.favoriteCompanion,
      futureDream: c.futureDream,
    },
    ...(avatarAssetPath ? { avatarAssetPath } : {}),
  };
}

// ── Snapshots (change detection) ─────────────────────────────────────────────

/** Traits that define how the protagonist looks (what the character prep depends on). */
export function protagonistSnapshot(state: Pick<CreateBookState, "character" | "protagonistMode" | "photoPath">): string {
  const c = state.character;
  return JSON.stringify({
    gender: c.gender,
    age: c.age,
    skinTone: c.skinTone,
    hairColor: c.hairColor,
    hairstyle: c.hairstyle,
    eyeColor: c.eyeColor,
    favoriteColor: c.favoriteColor,
    glasses: c.glasses,
    freckles: c.freckles,
    mode: state.protagonistMode,
    photoPath: state.protagonistMode === "photo" ? state.photoPath : null,
  });
}

/** Everything that changes the book the story POST would create. */
export function storyInputSnapshot(state: CreateBookState, locale: string): string {
  return JSON.stringify({
    locale,
    name: state.character.name.trim(),
    protagonist: protagonistSnapshot(state),
    template: state.selectedTemplate,
    treePath: state.decisions.treePath ?? [],
  });
}

// ── Typography helpers ───────────────────────────────────────────────────────

const VOWEL_START = /^[aeiouàáâäèéêëìíîïòóôöùúûüæœy]/i;
const H_VOWEL_START = /^h[aeiouàáâäèéêëìíîïòóôöùúûü]/i;

/**
 * Catalan and French elide "de" before a vowel sound: "L'aventura d'Olívia",
 * "L'aventure d'Émile". Spanish and English never elide.
 * (Catalan exceptions like "de Ió" are rare enough to accept.)
 */
export function elidesDe(name: string, locale: string): boolean {
  if (locale !== "ca" && locale !== "fr") return false;
  const n = name.trim();
  if (!n) return false;
  if (locale === "ca" && /^[iu][aeiouàáèéíòóú]/i.test(n)) return false; // "de Iolanda", "de Uàlid" (semi-vowel)
  return VOWEL_START.test(n) || H_VOWEL_START.test(n);
}

/**
 * Cover name font size (px) for a given container width: long or compound names
 * shrink so no word is ever cut, short names get the full display size.
 */
export function coverNameFontSize(name: string, width: number): number {
  const n = name.trim();
  const longestWord = n.split(/\s+/).reduce((m, w) => Math.max(m, [...w].length), 0);
  const total = [...n].length;
  // Fredoka glyphs average ~0.56em; keep the longest word within ~84% of the width.
  const byWord = longestWord > 0 ? (width * 0.84) / (longestWord * 0.56) : width;
  const byTotal = total > 14 ? (width * 1.9) / (total * 0.56) : width;
  const max = width * 0.2;
  const min = Math.max(14, width * 0.075);
  return Math.round(Math.min(max, Math.max(min, Math.min(byWord, byTotal))));
}

/**
 * First given name for affectionate copy (default dedication): "Lucía Núria l'Olivé" → "Lucía".
 * The cover and the story keep the full name as typed.
 */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * "de Lucía" / "d'Olívia" (ca, fr elide) for strings like "el libro {deName}".
 * English strings use the bare {name}; this returns it unchanged there.
 */
export function deName(name: string, locale: string): string {
  const n = name.trim();
  if (locale === "en") return n;
  return elidesDe(n, locale) ? `d'${n}` : `de ${n}`;
}
