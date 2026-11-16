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
  /**
   * A single cast entry standing for the whole group ("the Three Kings"): gets every member's look.
   * Only for worlds whose fixed characters travel together.
   */
  group?: { match: RegExp; label: string; /** Opening line of the group look */ lead: string; gender: PlanCastMember["gender"] };
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
    group: {
      match: /\b(kings?|reyes|reis|rois|magi|mages|wise men|reyes magos|reis mags|reis d orient)\b/,
      label: "the Three Kings",
      lead: "3 kings who always appear together.",
      gender: "male",
    },
    note: "The Three Kings recur through most of the book: each is his own cast entry (never one entry for the group) and appears in at least two scenes. Skin is only ever the natural skin given here (never make-up or paint).",
  },
  christmas: {
    members: [
      {
        id: "papa_noel",
        label: "Father Christmas",
        names: { es: "Papá Noel", ca: "Pare Noel", en: "Father Christmas", fr: "Père Noël" },
        // Never "claus" alone (Mrs Claus) and never an elf/reindeer "of" Papá Noel.
        match: /^(?!.*\b(elf|elves|elfo|elfos|elfs|follet|follets|lutin|lutins|mrs|mama|mare|mere|senora|madame|reindeer|reno|renos|ren|rens|renne|rennes)\b).*\b(papa noel|pare noel|pere noel|father christmas|santa claus|santa|saint nicholas|st nicholas)\b/,
        kind: "character",
        gender: "male",
        visual:
          "A jolly, round, elderly man, short and plump with a big round tummy, fair skin with rosy red cheeks and a rosy nose, a full fluffy snow-white beard down to his chest, a curly white moustache, white hair, bushy white eyebrows and kind twinkling blue eyes behind small round gold-rimmed glasses; he wears a long bright-red coat with thick white fur trim at the collar, cuffs, front and hem, a wide black leather belt with a square gold buckle, red trousers, shiny black boots, white gloves and a red stocking cap with white fur trim and a white pompom.",
      },
    ],
    note: "Papá Noel recurs through most of the book: one cast entry, in at least three scenes; every other character (elves, reindeer, animals) is the author's own.",
  },
  tio: {
    members: [
      {
        id: "tio",
        label: "the Tió (magic Christmas log)",
        names: { es: "el Tió", ca: "el Tió", en: "the Tió", fr: "le Tió" },
        // key() strips accents, so "tio" also matches Spanish "tío" (uncle): only used
        // together with the kind gate below (members match only cast entries of their own kind).
        match: /\b(tio|tio de nadal|caga tio|christmas log|magic log)\b/,
        kind: "creature",
        gender: "none",
        visual:
          "A small magic Christmas log about the size of a loaf of bread: a short, round, chunky log with rough grey-brown bark and a pale cut end at the front where a friendly face is painted (two round black eyes, rosy pink cheeks, a small round nose and a wide happy smile); it stands on two short straight wooden stick legs at the front end; it wears a floppy red barretina cap (a soft red Catalan stocking cap whose long tip flops forward) and a red-and-white checked blanket draped over its back. No arms, no other clothes; it always has its cap and its blanket.",
      },
    ],
    note: "The Tió is the heart of the book: one cast entry with exactly this id and look, in at least four scenes (the empty spot by the fireplace does not count). It never loses its barretina or its blanket.",
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
  // Name matching only within the same kind: "Melchior's camel" is a creature and keeps its own look.
  const text = `${key(c.id)} ${key(c.name)} ${key(c.label)}`;
  const hits = fixed.members.filter((m) => m.kind === c.kind && m.match.test(text));
  return hits.length === 1 ? hits[0] : undefined;
}

/** The group's look: every member, in order, so a "the Three Kings" entry still draws the right three people. */
function groupVisual(fixed: TemplateFixedCast, lead: string): string {
  return `${lead} ${fixed.members.map((m) => `${m.label}: ${m.visual}`).join(" ")}`;
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
    const group = fixed.group;
    if (group && !hasMember && c.kind === "character" && group.match.test(text)) {
      return { ...c, label: group.label, kind: "character", gender: group.gender, visual: groupVisual(fixed, group.lead) };
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
  return `FIXED CAST (canonical, identical in every book of this world)\n${fixed.note} Use exactly these ids, names, labels and visuals in \`cast\`; the text must never contradict these looks.\n${lines.join("\n")}`;
}
