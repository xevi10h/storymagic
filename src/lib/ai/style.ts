/**
 * Illustration style directive — appended verbatim to every image prompt
 * (portrait, character sheet, scenes, cover) so all images share one look.
 *
 * Ported from the 2026-09 model bake-off (artifacts/model-bakeoff-2026-09/prompts.py,
 * STYLE), plus a muted/desaturated palette note (the bake-off's main gap was a
 * slightly "digital" watercolor feel).
 */
export const WATERCOLOR_STYLE =
  "Traditional hand-painted children's picture-book watercolor illustration: loose wet-on-wet washes with soft bleeding edges, " +
  "visible cold-press watercolor paper grain, granulating pigment, gentle gouache highlights, delicate hand-drawn ink linework, " +
  "muted warm storybook palette, slightly desaturated (Beatrix Potter meets Quentin Blake meets Studio Ghibli backgrounds). " +
  "Painterly and analog, NOT digital, NOT vector, NOT 3D render, NOT glossy, NOT a photograph. No text, no letters, no signature, no watermark.";

/** Scenes and covers: the art must reach every edge (print bleed). */
export const FULL_BLEED = "Full bleed edge to edge, no borders, no frames, no white margins.";
