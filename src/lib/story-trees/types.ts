// Branching "choose-your-own-adventure" story trees (Fase B).
// Each template has a tree: chapters branch (each choice → different next options),
// then converge to a shared ending. Depth 3 (c1→c2→c3) + ending.
//
// Text is stored per-locale inline (trees are a content type independent of the
// next-intl message files). Image is a seed/URL; narrative is the prompt fragment
// fed to the story generator for the chosen path.

export type Locale = "es" | "ca" | "en" | "fr";
export type LocalizedText = Partial<Record<Locale, string>> & { es: string };

export interface TreeOption {
  id: string;
  title: LocalizedText;
  desc: LocalizedText;
  /** Image seed (picsum placeholder for now → real AI art keyed by this id later). */
  imageSeed: string;
  /** Material Symbols Outlined icon name for the option card visual. */
  icon: string;
  /** Prompt fragment describing this choice, used to compose the final story. */
  narrative: LocalizedText;
  /** Child node id, or null if this option leads straight to the ending. */
  next: string | null;
}

export interface TreeNode {
  id: string;
  chapter: number;
  question: LocalizedText;
  options: TreeOption[];
}

export interface StoryTree {
  templateId: string;
  root: string;
  /** Terminal node id reached after the branching chapters (shared ending). */
  ending: string;
  nodes: Record<string, TreeNode>;
}

/** Resolve localized text with es fallback. */
export function tx(t: LocalizedText, locale: string): string {
  return (t as Record<string, string>)[locale] ?? t.es;
}
