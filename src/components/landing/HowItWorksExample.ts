/**
 * The one example child the landing's "how / proof / print" sections follow:
 * Hugo, 5, a real showcase book (forest world) that exists in every locale. Its art is copied from the public `showcase` bucket to
 * /public/images/landing/hugo as right-sized webp (the originals are 2–4 MB PNGs).
 * If that story ever stops being a showcase, swap the id + art here (and the ca strings that say "d'en {name}" if the child is a girl).
 */
export const LANDING_EXAMPLE = {
  childName: "Hugo",
  age: 5,
  templateId: "forest",
  /** Hugo's own pre-rendered portrait of the "Créalo tú" builder (boy · 3–6 · light skin · short dark-brown hair). */
  avatarSrc: "/images/avatar/boy/small/light/brown-dark-short.webp",
  skinTone: "light",
  coverSrc: "/images/landing/hugo/cover.webp",
  /** Panorama spread (1600×800) used as "the preview before paying". */
  previewScene: "/images/landing/hugo/scene-3.webp",
  /** Panorama spread (1600×800) shown in the open printed book. */
  printSpread: "/images/landing/hugo/scene-8.webp",
  /** Scenes shown as proof that each page is painted for the story (all 1024 px). */
  scenes: [
    { src: "/images/landing/hugo/scene-5.webp", width: 1024, height: 1024 },
    { src: "/images/landing/hugo/scene-7.webp", width: 1024, height: 1024 },
    { src: "/images/landing/hugo/scene-10.webp", width: 1024, height: 1024 },
    { src: "/images/landing/hugo/scene-11.webp", width: 1024, height: 1024 },
  ],
} as const;

/** The same book in each locale: its showcase story (for /ejemplo/{id}) and printed title. */
const EXAMPLE_BOOK: Record<string, { storyId: string; title: string }> = {
  es: { storyId: "1a924f3c-969a-488e-9da8-1164680c57e5", title: "Hugo y la llave de flor" },
  ca: { storyId: "2152a65e-b1f3-4a46-8f96-2c06f906d0a5", title: "En Hugo i la clau de flor" },
  en: { storyId: "2b1d4dfb-468b-4c5a-83b2-2cf77aed3bf4", title: "Hugo and the Flower Key" },
  fr: { storyId: "305c2236-dc03-4957-bcc0-9d931fad4466", title: "Hugo et la Clé-Fleur" },
};

export function landingExampleBook(locale: string) {
  return EXAMPLE_BOOK[locale] ?? EXAMPLE_BOOK.es;
}
