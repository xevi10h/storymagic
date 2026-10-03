// Readable URLs of the example books: /{locale}/examples/{slug}, the slug made from
// the book's printed title in that locale ("Noa y la llave de flor" →
// "noa-y-la-llave-de-flor"). Pure and client-safe (landing links use it too).
// Server code resolves slugs through getShowcaseRefs() (lib/showcase.ts), which
// also disambiguates two books with the same title in one locale.

/** URL slug of a book title: lowercase ASCII words joined by "-". */
export function showcaseSlug(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "book";
}

/** Locale-less path of an example book (for the i18n <Link>). */
export function showcasePath(slug: string): string {
  return `/examples/${slug}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pre-slug example URLs used the story UUID: they 308 to the slug. */
export function isStoryUuid(value: string): boolean {
  return UUID_RE.test(value);
}
