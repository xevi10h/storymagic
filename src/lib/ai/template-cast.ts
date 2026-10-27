// Fixed recurring characters of a template (e.g. the Three Kings of "reyes").
//
// The Book Plan LLM writes every cast member's look itself. That is fine for a
// one-off fox, but a world whose characters are well known (Melchor, Gaspar and
// Baltasar) must look the same in every book and must never be left to the model:
// the look is canonical, the prompt hands it to the author, and normalizeBible
// overwrites whatever the model wrote (so the frozen imagePlan, the character
// sheets, every scene and the QA judge all receive these exact bytes).
//
// Rules for the descriptions: English, concrete (skin, hair, beard, crown, robe
// colours), one look per King for the whole book. Baltasar is a Black man: describe
// his natural skin and features, never make-up, paint or a costume.

import type { PlanCastMember } from "./book-plan";

export interface FixedCastMember {
  /** Stable snake_case id the plan must use. */
  id: string;
  /** English label for the illustrator (image prompts, sheets, QA). */
  label: string;
  /** Name in each book language (what the text calls him). */
  names: Record<"es" | "ca" | "en" | "fr", string>;
  /** Recognises the member when the model used another id (matched on id, name and label, accents removed). */
  match: RegExp;
  kind: PlanCastMember["kind"];
  gender: PlanCastMember["gender"];
  visual: string;
}

export interface TemplateFixedCast {
  members: FixedCastMember[];
  /** A single cast entry standing for the whole group ("the Three Kings"): gets every member's look. */
  group: { match: RegExp; label: string };
  /** One line for the author: how often they appear. */
  note: string;
}

export const TEMPLATE_FIXED_CAST: Record<string, TemplateFixedCast> = {
  reyes: {
    members: [
      {
        id: "melchor",
        label: "King Melchior",
        names: { es: "Melchor", ca: "Melcior", en: "Melchior", fr: "Melchior" },
        match: /melch|melcior/,
        kind: "character",
        gender: "male",
        visual:
          "An elderly king, a tall adult man with fair rosy skin, a long flowing snow-white beard down to his chest, white hair and kind pale-blue eyes; he wears a tall golden crown set with red rubies, a deep crimson-red velvet robe with gold embroidery and a long gold cape trimmed with white ermine.",
      },
      {
        id: "gaspar",
        label: "King Caspar",
        names: { es: "Gaspar", ca: "Gaspar", en: "Caspar", fr: "Gaspard" },
        match: /gaspar|caspar/,
        kind: "character",
        gender: "male",
        visual:
          "A middle-aged king, a tall sturdy adult man with light olive skin, rosy cheeks, a short neat auburn reddish-brown beard, wavy shoulder-length auburn hair and warm brown eyes; he wears a broad golden crown set with green emeralds, an emerald-green robe with gold embroidery and a golden-yellow cape.",
      },
      {
        id: "baltasar",
        label: "King Balthazar",
        names: { es: "Baltasar", ca: "Baltasar", en: "Balthazar", fr: "Balthazar" },
        match: /baltas|balthas|balthaz/,
        kind: "character",
        gender: "male",
        visual:
          "A younger king, a tall slender Black man with deep brown skin, a short neat black beard, close-cropped black hair and warm dark-brown eyes; he wears a golden crown with blue sapphires over a deep-purple turban, a royal-blue robe with gold embroidery and a long deep-purple cape.",
      },
    ],
    group: { match: /\b(kings?|reyes|reis|rois|magi|mages|wise men|reyes magos|reis mags|reis d orient)\b/, label: "the Three Kings" },
    note: "The Three Kings recur through most of the book: each is his own cast entry and appears in at least two scenes.",
  },
};

function key(s: string | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function memberFor(fixed: TemplateFixedCast, c: Pick<PlanCastMember, "id" | "name" | "label" | "kind">): FixedCastMember | undefined {
  const byId = fixed.members.find((m) => m.id === c.id);
  if (byId) return byId;
  // Name matching only for people: "Melchior's camel" is a creature and keeps its own look.
  if (c.kind !== "character") return undefined;
  const text = `${key(c.id)} ${key(c.name)} ${key(c.label)}`;
  const hits = fixed.members.filter((m) => m.match.test(text));
  return hits.length === 1 ? hits[0] : undefined;
}

/** The group's look: every member, in order, so a "the Three Kings" entry still draws the right three people. */
function groupVisual(fixed: TemplateFixedCast): string {
  return `${fixed.members.length} kings who always appear together. ${fixed.members.map((m) => `${m.label}: ${m.visual}`).join(" ")}`;
}

/**
 * Overwrite the look of a template's fixed characters in a plan cast (by id, else
 * by name/label). Members the model did not include are not added: they appear
 * only where the manuscript put them. Other cast members are untouched.
 */
export function applyFixedCast<T extends PlanCastMember>(templateId: string | undefined, cast: T[]): T[] {
  const fixed = templateId ? TEMPLATE_FIXED_CAST[templateId] : undefined;
  if (!fixed) return cast;
  const hasMember = cast.some((c) => memberFor(fixed, c));
  return cast.map((c) => {
    const m = memberFor(fixed, c);
    if (m) return { ...c, label: m.label, kind: m.kind, gender: m.gender, visual: m.visual };
    const text = `${key(c.id)} ${key(c.name)} ${key(c.label)}`;
    if (!hasMember && c.kind === "character" && fixed.group.match.test(text)) {
      return { ...c, label: fixed.group.label, kind: "character", gender: "male", visual: groupVisual(fixed) };
    }
    return c;
  });
}

/** Prompt section for the Book Plan author, or null when the template has no fixed cast. */
export function fixedCastPrompt(templateId: string | undefined, locale: string): string | null {
  const fixed = templateId ? TEMPLATE_FIXED_CAST[templateId] : undefined;
  if (!fixed) return null;
  const lang = (["es", "ca", "en", "fr"] as const).find((l) => l === locale) ?? "es";
  const lines = fixed.members.map(
    (m) => `- id "${m.id}" · name in the text: ${m.names[lang]} · label "${m.label}" · ${m.kind}, ${m.gender} · visual: ${m.visual}`,
  );
  return `FIXED CAST (canonical, identical in every book of this world)\n${fixed.note} Use exactly these ids, names, labels and visuals in \`cast\`, one entry per character (never one entry for the group); the text must never contradict these looks, and skin is only ever the natural skin given here (never make-up or paint).\n${lines.join("\n")}`;
}
