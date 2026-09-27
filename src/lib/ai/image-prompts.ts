// Deterministic image-prompt assembly (no LLM, no truncation).
//
// Port of the 2026-09 bake-off recipe (artifacts/model-bakeoff-2026-09/prompts.py):
//   a) reference-role preamble (which attached image is what)
//   b) negative cast: every recurring character absent from the scene
//   c) SCENE: camera, action, setting, light (+ scale sentence for wide shots,
//      fold rule for panoramas)
//   d) descriptions only for the characters present — Character Bible verbatim
//   e) style suffix
// There is deliberately no length cap: the old 1000-char cap left 48–79 chars
// for the actual scene.

import type { CharacterBible } from "./character-description";
import type { ShotSpec } from "./scene-screenplay";
import { CHILD_ID, type CastMember, type WorldAsset } from "./visual-assets";
import { FULL_BLEED, WATERCOLOR_STYLE } from "./style";

/** What each attached reference image is, in attachment order. */
export type ReferenceRole =
  | { kind: "sheet"; names: string[] }
  | { kind: "extra-sheet"; names: string[] }
  /** Split preview layout: the child alone (can be rendered before the Book Plan exists) */
  | { kind: "child-sheet" }
  /** Split preview layout: the companions, rendered once the Book Plan cast is known */
  | { kind: "companion-sheet"; names: string[] }
  | { kind: "photo" }
  | { kind: "portrait" }
  | { kind: "fix" };

export interface PromptCast {
  bible: CharacterBible;
  cast: CastMember[];
  world: WorldAsset[];
}

const ORDINALS = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH"];
const CHILD_LABEL = "THE CHILD";

/** Recurring characters drawn on the main sheet (the rest go on the extra sheet). */
export const MAIN_SHEET_CAST = 2;

function label(member: CastMember): string {
  return member.name.toUpperCase();
}

function namesList(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function describeRole(role: ReferenceRole): string {
  switch (role.kind) {
    case "sheet":
      return `the character model sheet: the single source of truth for how ${namesList([CHILD_LABEL, ...role.names])} look`;
    case "extra-sheet":
      return `a second character model sheet: the single source of truth for how ${namesList(role.names)} look`;
    case "child-sheet":
      return `the character model sheet of ${CHILD_LABEL}: the single source of truth for how ${CHILD_LABEL} looks`;
    case "companion-sheet":
      return `the character model sheet of the companions: the single source of truth for how ${namesList(role.names)} look`;
    case "photo":
      return "a photo of the real child: use it for facial likeness only (face shape and features); do NOT copy its photographic style, clothing, background or lighting";
    case "portrait":
      return `the approved portrait of this same child: match ${CHILD_LABEL}'s face, skin tone, hair and eye colour exactly`;
    case "fix":
      return "a finished illustration of this book that needs one correction";
  }
}

function preamble(roles: ReferenceRole[]): string {
  if (roles.length === 0) return "";
  const lines = roles.map((r, i) => `The ${ORDINALS[i]} attached image is ${describeRole(r)}.`);
  return lines.join(" ");
}

function identityLock(bible: CharacterBible, present: CastMember[], childPresent: boolean): string {
  const parts: string[] = [];
  if (childPresent) {
    parts.push(
      `${CHILD_LABEL} must have exactly the same face, skin tone, hair, eye colour and outfit as on the sheet: the same ${bible.age}-year-old ${bible.genderWord}, same age, never change gender.`,
    );
  }
  for (const m of present) parts.push(`${label(m)} must look exactly as on the sheet.`);
  return parts.join(" ");
}

function negativeCast(plan: PromptCast, shot: ShotSpec): string {
  const absent = plan.cast.filter((m) => !shot.cast.includes(m.id)).map(label);
  const lines: string[] = [];
  if (!shot.cast.includes(CHILD_ID)) lines.push(`${CHILD_LABEL} is NOT in this scene.`);
  for (const name of absent) lines.push(`${name} is NOT in this scene.`);
  const presentNames = [shot.cast.includes(CHILD_ID) ? CHILD_LABEL : null, ...plan.cast.filter((m) => shot.cast.includes(m.id)).map(label)].filter(
    (n): n is string => !!n,
  );
  if (absent.length > 0 && presentNames.length > 0) lines.push(`From the book's recurring cast, only ${namesList(presentNames)} appear${presentNames.length === 1 ? "s" : ""}, each exactly once.`);
  else if (presentNames.length > 0) lines.push(`${namesList(presentNames)} appear${presentNames.length === 1 ? "s" : ""} exactly once — never duplicate a character.`);
  return lines.join(" ");
}

function characterBlock(plan: PromptCast, shot: ShotSpec): string {
  const lines: string[] = [];
  if (shot.cast.includes(CHILD_ID)) lines.push(`${CHILD_LABEL}: ${plan.bible.description}.`);
  for (const m of plan.cast) if (shot.cast.includes(m.id)) lines.push(`${label(m)}: ${m.description}`);
  return lines.join("\n");
}

function worldBlock(plan: PromptCast, shot: ShotSpec): string {
  return plan.world
    .filter((w) => shot.world.includes(w.id))
    .map((w) => `The ${w.name} looks like this: ${w.description}`)
    .join(" ");
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function sceneBody(plan: PromptCast, shot: ShotSpec): string {
  const lines = [`${sentence(shot.camera)} ${sentence(shot.action)} Setting: ${sentence(shot.setting)} Light: ${sentence(shot.light)}`];
  if (shot.shotScale === "wide" && shot.cast.includes(CHILD_ID)) {
    lines.push(`Long shot: ${CHILD_LABEL} is small in the frame — less than one tenth of the image height, in the lower-left third — and the environment fills the picture.`);
  }
  if (shot.frame === "panorama") {
    lines.push(
      "This is a double-page panorama that will be folded exactly down the vertical centre line: every face and key subject must stay out of the central strip (the middle fifth of the image width), placed clearly in the left or right part of the picture — this overrides any placement mentioned above — and only continuous scenery crosses the middle.",
    );
  }
  const world = worldBlock(plan, shot);
  if (world) lines.push(world);
  return lines.join(" ");
}

/** Present cast members that live on the extra sheet (for reference selection). */
export function extraSheetCast(plan: PromptCast): CastMember[] {
  return plan.cast.slice(MAIN_SHEET_CAST);
}

export function mainSheetCast(plan: PromptCast): CastMember[] {
  return plan.cast.slice(0, MAIN_SHEET_CAST);
}

// ── Scene / cover ────────────────────────────────────────────────────────────

export function buildScenePrompt(plan: PromptCast, shot: ShotSpec, roles: ReferenceRole[]): string {
  const present = plan.cast.filter((m) => shot.cast.includes(m.id));
  const head = [
    preamble(roles),
    identityLock(plan.bible, present, shot.cast.includes(CHILD_ID)),
    "Do NOT copy the sheet layout, the poses or its plain paper background: draw a brand-new full-bleed scene.",
    negativeCast(plan, shot),
  ]
    .filter(Boolean)
    .join(" ");

  const scene =
    shot.frame === "cover"
      ? `BOOK COVER illustration, portrait format: ${sceneBody(plan, shot)} Keep the bottom third of the picture calm and simple (soft ground, grass or water, no faces and no important details) because the title is printed there, and keep a little calm space at the very top. Keep every face in the middle of the picture, well away from the outer edges (they wrap around the book board). Do NOT write any title, letters or text.`
      : `SCENE: ${sceneBody(plan, shot)}`;

  return [head, scene, characterBlock(plan, shot), `${WATERCOLOR_STYLE} ${FULL_BLEED}`].filter(Boolean).join("\n\n");
}

/** Edit instruction: correct a failing illustration (refs: [failing image, sheet, …]). */
export function buildRepairPrompt(plan: PromptCast, shot: ShotSpec, roles: ReferenceRole[], fix: string): string {
  const present = plan.cast.filter((m) => shot.cast.includes(m.id));
  return [
    [
      preamble(roles),
      `Redraw the ${ORDINALS[0]} image as the corrected final illustration: keep its composition, setting, lighting and painting style, and fix only this: ${sentence(fix)}`,
      identityLock(plan.bible, present, shot.cast.includes(CHILD_ID)),
      negativeCast(plan, shot),
    ]
      .filter(Boolean)
      .join(" "),
    `SCENE (for reference): ${sceneBody(plan, shot)}`,
    characterBlock(plan, shot),
    `${WATERCOLOR_STYLE} ${FULL_BLEED}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Character sheets ─────────────────────────────────────────────────────────

function headsTall(age: number): string {
  if (age <= 3) return "about 4 heads tall";
  if (age <= 6) return "about 5 heads tall";
  if (age <= 9) return "about 5.5 heads tall";
  return "about 6 heads tall";
}

export function buildMainSheetPrompt(plan: PromptCast, roles: ReferenceRole[]): string {
  const companions = mainSheetCast(plan);
  const g = plan.bible.genderWord;
  const bottom =
    companions.length === 0
      ? `Bottom row: four head-and-shoulders close-ups of ${CHILD_LABEL} with different expressions (big joyful laugh, surprised, calm and curious, determined).`
      : `Bottom row, left: three head-and-shoulders close-ups of ${CHILD_LABEL} with different expressions (big joyful laugh, surprised, calm and curious). Bottom row, right: ${companions
          .map((m) => `${label(m)} full body, front view and side view`)
          .join("; ")}.`;
  return [
    [preamble(roles), roles.length ? `Keep that exact child; the text below defines the outfit.` : ""].filter(Boolean).join(" "),
    `Character model sheet for a premium children's picture book, on plain warm off-white watercolor paper.`,
    [`${CHILD_LABEL}: ${plan.bible.description}.`, ...companions.map((m) => `${label(m)}: ${m.description}`)].join("\n"),
    `Top row: ${CHILD_LABEL} full body, standing, four views of the exact same ${g} in the same outfit: front view, three-quarter view, side profile, back view. ${bottom} Consistent proportions (${CHILD_LABEL} is ${headsTall(plan.bible.age)}, cute storybook proportions). Each character appears only in the listed views. No text labels, no letters, no captions.`,
    WATERCOLOR_STYLE,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildExtraSheetPrompt(plan: PromptCast): string {
  return buildCompanionSheetPrompt(extraSheetCast(plan));
}

/**
 * Child-only sheet (split preview layout): the main sheet without companion
 * rows. It needs only the Character Bible, so it can be rendered before the
 * Book Plan exists (POST /api/characters/prepare).
 */
export function buildChildSheetPrompt(bible: CharacterBible, roles: ReferenceRole[]): string {
  return buildMainSheetPrompt({ bible, cast: [], world: [] }, roles);
}

/** Sheet with exactly these companions (the extra sheet, or the split layout's companion sheet). */
export function buildCompanionSheetPrompt(members: CastMember[]): string {
  return [
    `Character model sheet for a premium children's picture book, on plain warm off-white watercolor paper. ${members.length} characters side by side, each shown full body in a front view and a side view, drawn at their true size relative to a small child.`,
    members.map((m) => `${label(m)}: ${m.description}`).join("\n"),
    "No other characters. No text labels, no letters, no captions.",
    WATERCOLOR_STYLE,
  ].join("\n\n");
}

// ── Avatar portrait ──────────────────────────────────────────────────────────

export function buildPortraitPrompt(bible: CharacterBible, roles: ReferenceRole[]): string {
  return [
    preamble(roles),
    `Character portrait for a premium children's picture book: ${CHILD_LABEL}, chest-up, centred, three-quarter view, warm friendly smile, on plain warm off-white watercolor paper.`,
    `${CHILD_LABEL}: ${bible.description}.`,
    WATERCOLOR_STYLE,
  ]
    .filter(Boolean)
    .join("\n\n");
}
