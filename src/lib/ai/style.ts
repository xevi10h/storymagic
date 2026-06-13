/**
 * Shared illustration style directives for the FLUX.2 pipeline.
 *
 * The reinforced-watercolor look was validated in the engine A/B (artifacts/benchmark-watercolor):
 * with this suffix, FLUX.2 produces an authentic hand-painted watercolor texture (paper grain,
 * soft washes, bleeding edges) that fits meapica's "artisanal, not AI-render" positioning.
 *
 * Used by both scene generation (scene-screenplay.ts) and reference-sheet generation
 * (visual-assets.ts) so scenes and their references share one visual distribution —
 * which is what keeps character/world consistency high.
 */

/** Appended to every scene/cover fluxPrompt. Keep in sync with the validated A/B prompt. */
export const WATERCOLOR_STYLE_SUFFIX =
  " Traditional hand-painted children's book watercolor illustration: loose wet-on-wet washes with soft bleeding edges, " +
  "visible cold-press watercolor paper grain, granulating pigment, gentle gouache highlights, delicate ink linework, " +
  "muted warm storybook palette (Studio Ghibli meets Beatrix Potter meets Quentin Blake). " +
  "Painterly and analog, NOT digital, NOT vector, NOT 3D render, NOT glossy, NOT a photograph. " +
  "Full bleed edge-to-edge. No borders, no white edges, no text, no signature, no watermark, no branded logos.";

/** Style framing for reference-sheet generation (same look, neutral background). */
export const WATERCOLOR_REF_STYLE =
  "Traditional hand-painted children's book watercolor illustration style: soft washes, visible paper grain, " +
  "delicate ink linework, muted warm palette, cute storybook proportions with large expressive eyes. " +
  "NOT digital, NOT vector, NOT 3D, NOT a photograph.";
