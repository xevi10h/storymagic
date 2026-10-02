/**
 * Grammar of the child's name inside UI copy: "de"/"d'" elision (ca, fr), the Catalan
 * personal article (en / la / l') and the live cover title layout.
 * Dependency-free on purpose: checked by name-grammar.check.mjs under plain node.
 */

const VOWEL_START = /^[aeiouàáâäèéêëìíîïòóôöùúûüæœy]/i;
const H_VOWEL_START = /^h[aeiouàáâäèéêëìíîïòóôöùúûü]/i;

/**
 * Catalan and French elide "de" before a vowel sound: "L'aventura d'Olívia",
 * "L'aventure d'Émile". Spanish and English never elide.
 * (Catalan exceptions like "de Ió" are rare enough to accept.)
 */
export function elidesDe(name: string, locale: string): boolean {
  if (locale !== "ca" && locale !== "fr") return false;
  const n = name.trim();
  if (!n) return false;
  if (locale === "ca" && /^[iu][aeiouàáèéíòóú]/i.test(n)) return false; // "de Iolanda", "de Uàlid" (semi-vowel)
  return VOWEL_START.test(n) || H_VOWEL_START.test(n);
}

// ── Catalan personal article ─────────────────────────────────────────────────

/** Name gender as the product knows it: from the avatar choice, or unknown (landing, neutral). */
export type NameGender = "boy" | "girl" | "neutral" | (string & {}) | null | undefined;

const CA_VOWEL_GROUPS = /[aeiouàèéíòóúü]+|ï/g;
const CA_ACCENT = /[àèéíòóú]/;

/** Whether the first syllable of a (Catalan-read) name carries the stress: "Imma", "Iris" yes; "Irene", "Ivet" no. */
function firstSyllableStressed(word: string): boolean {
  const w = word.toLowerCase().replace(/^h/, "");
  const groups = [...w.matchAll(CA_VOWEL_GROUPS)];
  if (groups.length <= 1) return true;
  const accented = groups.findIndex((g) => CA_ACCENT.test(g[0]));
  if (accented >= 0) return accented === 0;
  // Unaccented: words ending in a vowel, -s, -en, -in stress the penultimate syllable, the rest the last.
  const stressed = /([aeiou]|[aeiou]s|en|in)$/.test(w) ? groups.length - 2 : groups.length - 1;
  return stressed === 0;
}

/**
 * The Catalan personal article before a first name, by the rules of the IEC:
 * masculine "en" before a consonant and "l'" before a vowel sound ("en Pau", "l'Àlex");
 * feminine "la" before a consonant and "l'" before a vowel sound, except an unstressed
 * i/u ("la Noa", "l'Anna", "la Irene"); a semi-vowel i/u before a vowel counts as a
 * consonant ("la Iolanda", "en Ian"). Returns null when the gender is unknown and the
 * article would depend on it, so the caller can rephrase instead of guessing.
 */
export function catalanArticle(name: string, gender?: NameGender): "en" | "la" | "l'" | null {
  const n = name.trim();
  if (!n) return null;
  const semiVowel = /^h?[iu][aeiouàèéíòóú]/i.test(n);
  const vowel = !semiVowel && /^h?[aeiouàáèéíïòóúü]/i.test(n);
  const known = gender === "boy" || gender === "girl" ? gender : null;
  if (!vowel) return known === "boy" ? "en" : known === "girl" ? "la" : null;
  const unstressedIU = /^h?[iuïü]/i.test(n) && !firstSyllableStressed(n.split(/[\s-]+/)[0]);
  if (!unstressedIU) return "l'";
  // Masculine always elides ("l'Isidre"); feminine keeps "la" ("la Irene").
  return known === "boy" ? "l'" : known === "girl" ? "la" : null;
}

/**
 * "de Lucía" / "d'Olívia" (ca, fr elide) for strings like "el libro {deName}".
 * Catalan adds the personal article when it can be known: "de la Noa", "d'en Pau",
 * "de l'Anna", "de l'Àlex"; with an unknown gender and a consonant it falls back to the
 * article-less formal register ("de Noa"). English strings use the bare {name}.
 */
export function deName(name: string, locale: string, gender?: NameGender): string {
  const n = name.trim();
  if (locale === "en") return n;
  if (locale === "ca" && n) {
    const article = catalanArticle(n, gender);
    if (article === "en") return `d'en ${n}`;
    if (article === "la") return `de la ${n}`;
    if (article === "l'") return `de l'${n}`;
  }
  return elidesDe(n, locale) ? `d'${n}` : `de ${n}`;
}

/**
 * How the live cover title is laid out:
 * - "empty": no name yet → a name-less title ("La seva aventura", "Su aventura").
 * - "plain" / "elided": prefix + name ("La aventura de Lucía", "L'aventure d'Émile").
 * - "masc" / "fem" / "vowel": Catalan prefix with the personal article ("L'aventura d'en Pau").
 * - "nameFirst": Catalan with an unknown article → the name leads, no article needed
 *   ("Noa / i la seva aventura"), the way Catalan book titles put a name first.
 */
export type CoverTitleKind = "empty" | "plain" | "elided" | "masc" | "fem" | "vowel" | "nameFirst";

export function coverTitleKind(name: string, locale: string, gender?: NameGender): CoverTitleKind {
  const n = name.trim();
  if (!n) return "empty";
  if (locale === "ca") {
    const article = catalanArticle(n, gender);
    if (article === "en") return "masc";
    if (article === "la") return "fem";
    if (article === "l'") return "vowel";
    return "nameFirst";
  }
  return elidesDe(n, locale) ? "elided" : "plain";
}
