/**
 * The child's name as it may appear in a mail we send to an address the user typed:
 * letters, combining marks, spaces, hyphens and apostrophes only (no dots, slashes,
 * digits or symbols, so it cannot carry a URL or a spam message), max 40 chars.
 */
export function mailSafeName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\s'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}
