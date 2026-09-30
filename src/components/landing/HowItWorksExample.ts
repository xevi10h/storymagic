/**
 * The one example child the landing's "how / proof / print" sections follow:
 * Sam, 5, a real showcase book (candy world) that exists in every locale. Its art is copied from the public `showcase` bucket to
 * /public/images/landing/sam as right-sized webp (the originals are 1–3 MB PNGs).
 * If that story ever stops being a showcase, swap the id + art here.
 */
export const LANDING_EXAMPLE = {
  childName: "Sam",
  age: 5,
  templateId: "candy",
  /** Closest pre-rendered portrait of the "Créalo tú" builder (boy · 3–6 · dark skin · dark-brown curls). */
  avatarSrc: "/images/avatar/boy/small/dark/brown-dark-curly.webp",
  skinTone: "dark",
  coverSrc: "/images/landing/sam/cover.webp",
  /** Panorama spread (1600×800) used as "the preview before paying". */
  previewScene: "/images/landing/sam/scene-3.webp",
  /** Panorama spread (1600×800) shown in the open printed book. */
  printSpread: "/images/landing/sam/scene-8.webp",
  /** Scenes shown as proof that each page is painted for the story (all 1024 px tall). */
  scenes: [
    { src: "/images/landing/sam/scene-2.webp", width: 1280, height: 1024 },
    { src: "/images/landing/sam/scene-5.webp", width: 1280, height: 1024 },
    { src: "/images/landing/sam/scene-10.webp", width: 1024, height: 1024 },
    { src: "/images/landing/sam/scene-12.webp", width: 1024, height: 1024 },
  ],
} as const;

/** The same book in each locale: its showcase story (for /ejemplo/{id}) and printed title. */
const EXAMPLE_BOOK: Record<string, { storyId: string; title: string }> = {
  es: { storyId: "fb07048b-4216-4dc5-878b-cb0dd3c24fa2", title: "Sam y la Montaña de Dulce Mar" },
  ca: { storyId: "58d5b66b-191c-4625-bb19-57a052a713b7", title: "Sam i la Muntanya Dolça del Mar" },
  en: { storyId: "83d12340-293c-4e0b-bd5c-2f88d5387982", title: "Sam and the Sea-Sweet Mountain" },
  fr: { storyId: "30bd04f6-8737-4fb1-894b-345e2c644b48", title: "Sam et la Montagne Sucrée de la Mer" },
};

export function landingExampleBook(locale: string) {
  return EXAMPLE_BOOK[locale] ?? EXAMPLE_BOOK.es;
}
