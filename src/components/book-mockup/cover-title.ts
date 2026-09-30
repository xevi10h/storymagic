/**
 * Front-cover title lockup for the on-screen book mockup.
 *
 * `splitTitleOnName` mirrors the print rule in src/lib/pdf/cover-art.tsx (same regex, same
 * results). It is duplicated because cover-art.tsx imports @react-pdf and the font measurer,
 * which cannot ship to the browser. If the two ever diverge, move the print version into a
 * pure module and import it from both places.
 *
 * Sizes are in `cqw` of the cover face (the face is a size container), scaled from the print
 * lockup on a 200 mm (567 pt) panel: name 32–62 pt, rest 16–28 pt at 38–50 % of the name,
 * uniform title 18–36 pt, subtitle 11 pt, 15 mm safe margin.
 */

export interface TitleSplit {
  pre: string;
  hero: string;
  post: string;
}

/**
 * Splits the title around the child's name (whole word, case-insensitive). A possessive,
 * trailing punctuation, opening marks and an elided article stay on the name's line:
 * "Martina's", "Núria,", "¡Leo", "d’Émile".
 */
export function splitTitleOnName(title: string, name: string): TitleSplit | null {
  const n = name.trim();
  if (!n) return null;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "iu").exec(title);
  if (!match) return null;
  let pre = title.slice(0, match.index);
  let post = title.slice(match.index + match[0].length);
  const tail = /^(?:['’]s)?[,;:!?.…»”"')]*/u.exec(post)?.[0] ?? "";
  post = post.slice(tail.length);
  const lead = /(?<!\p{L})(?:\p{L}{1,2}['’]|[¡¿«“"(]+)$/u.exec(pre)?.[0] ?? "";
  pre = pre.slice(0, pre.length - lead.length);
  return { pre: pre.trim(), hero: `${lead}${match[0]}${tail}`, post: post.trim() };
}

/** Percent of the panel width (pt / 567 pt × 100) */
const PT = 100 / 567;
const HERO = { max: 62 * PT, min: 32 * PT };
const REST = { max: 28 * PT, min: 16 * PT };
const UNIFORM = { max: 36 * PT, min: 18 * PT };
/** Usable measure inside the 15 mm safe margins */
const MEASURE = 85;
/** Average Fredoka 600 advance per character, in em — deliberately generous (caps, wide glyphs) */
const EM_PER_CHAR = 0.6;

export type CoverLockup =
  | { kind: "split"; split: TitleSplit; heroCqw: number; restCqw: number }
  | { kind: "uniform"; sizeCqw: number };

/** Largest lockup that keeps the name on one line and the title within ~3 lines (estimate). */
export function coverLockup(title: string, name: string): CoverLockup {
  const split = splitTitleOnName(title, name);
  if (split) {
    const heroFit = MEASURE / (Math.max(split.hero.length, 1) * EM_PER_CHAR);
    const heroCqw = Math.min(HERO.max, heroFit);
    if (heroCqw >= HERO.min) {
      const restCqw = Math.min(REST.max, heroCqw * 0.5, Math.max(REST.min, heroCqw * 0.42));
      return { kind: "split", split, heroCqw, restCqw };
    }
  }
  const fit = (3 * MEASURE) / (Math.max(title.length, 1) * EM_PER_CHAR);
  return { kind: "uniform", sizeCqw: Math.max(UNIFORM.min, Math.min(UNIFORM.max, fit * 0.9)) };
}
