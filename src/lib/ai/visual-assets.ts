// Visual cast — the recurring secondary characters, locations and objects the
// book keeps consistent. Produced by the Book Plan (book-plan.ts →
// planToVisualCast); frozen into the story's image plan at preview time and
// reused byte-identical in the character sheets and every scene prompt.
//
// The main child is never part of the cast: their look comes only from the
// Character Bible (character-description.ts), so no LLM can re-describe or
// re-dress them.

/** Reserved id of the main child in shot `cast` lists. */
export const CHILD_ID = "child";

export interface CastMember {
  /** snake_case id, never "child" */
  id: string;
  /** Name in the book language, e.g. "las ardillas" (UI, map game) */
  name: string;
  /** English label used in prompts (upper-cased), e.g. "SQUIRRELS" — see entity-label.ts castLabel */
  label?: string;
  kind: "character" | "creature";
  /** Species/body, size relative to the child, colours, one distinctive accessory */
  description: string;
  scenes: number[];
}

export interface WorldAsset {
  id: string;
  /** Name in the book language */
  name: string;
  /** English label used in prompts — see entity-label.ts worldLabel */
  label?: string;
  kind: "location" | "object";
  description: string;
  scenes: number[];
}

export interface VisualCast {
  cast: CastMember[];
  world: WorldAsset[];
}
