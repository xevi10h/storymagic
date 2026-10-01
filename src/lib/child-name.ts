// Display form of the child's name, applied where it enters the system (name
// input on blur / Next in /create, and server-side in POST /api/stories) so the
// book, the UI, emails and the LLM title all spell it the same way.
// Pure: safe on client and server.

/** Lower-case joiners inside a full name ("María de los Ángeles", "Maria dels Àngels"). */
const PARTICLES = new Set(["de", "del", "dels", "des", "la", "las", "les", "los", "y", "i", "e", "da", "das", "do", "dos", "di", "van", "von", "der", "du"]);
/** Elided prefixes kept lower-case mid-name ("Joan d'Arc"), capitalised when first ("D'Artagnan"). */
const ELIDED = new Set(["d", "l"]);
const APOSTROPHE = /['’]/;

function upperFirst(s: string): string {
  const [first = "", ...rest] = Array.from(s);
  return first.toUpperCase() + rest.join("");
}

/**
 * Capitalises the first letter of each name part without touching the rest, so a
 * deliberate "McKenzie" or "DeShawn" survives. ALL-CAPS words of 3+ letters are
 * title-cased ("XAVI" → "Xavi"); short ones stay (initials like "JJ").
 * "xavi" → "Xavi", "maría josé" → "María José", "pau-joan" → "Pau-Joan",
 * "núria" → "Núria", "joan d'arc" → "Joan d'Arc", "o'neil" → "O'Neil".
 */
export function formatChildName(raw: string): string {
  const words = raw.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, wi) => {
      const letters = Array.from(word).filter((ch) => /\p{L}/u.test(ch));
      const shouting = letters.length >= 3 && letters.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase());
      const w = shouting ? word.toLowerCase() : word;
      if (wi > 0 && PARTICLES.has(w)) return w;
      return w
        .split("-")
        .map((part) => {
          const m = APOSTROPHE.exec(part);
          if (!m) return upperFirst(part);
          const head = part.slice(0, m.index);
          const tail = part.slice(m.index + 1);
          const keepHeadLower = wi > 0 && ELIDED.has(head.toLowerCase()) && head === head.toLowerCase();
          return `${keepHeadLower ? head : upperFirst(head)}${m[0]}${upperFirst(tail)}`;
        })
        .join("-");
    })
    .join(" ");
}
