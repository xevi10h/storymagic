// Advent calendar, client side: who the stories are for.
//  - "character": the signed-in visitor's saved character (GET /api/advent/me), with portrait;
//  - "name": "Solo su nombre", kept in this browser only (localStorage, try/catch: private
//    mode and blocked storage fall back to memory for this page view).

import type { AvatarTraits } from "@/lib/avatar/manifest";
import type { AdventGender } from "@/lib/advent/render";

export type AdventChild =
  | { source: "character"; id: string; name: string; gender: AdventGender; traits: AvatarTraits | null }
  | { source: "name"; name: string; gender: AdventGender };

export interface AdventAccountState {
  signedIn: boolean;
  portraitEmail: string | null;
  character: { id: string; name: string; gender: AdventGender; traits: AvatarTraits | null } | null;
}

/** Name-only child; `override` = chosen over a saved character ("Cambiar"). */
export interface StoredNameChild {
  name: string;
  gender: AdventGender;
  override: boolean;
}

const KEY = "meapica.advent.child";
let memory: StoredNameChild | null = null;

export function readStoredChild(): StoredNameChild | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return memory;
    const v = JSON.parse(raw) as Partial<StoredNameChild>;
    if (typeof v.name !== "string" || !v.name.trim()) return memory;
    const gender: AdventGender = v.gender === "boy" || v.gender === "girl" ? v.gender : "neutral";
    return { name: v.name.trim().slice(0, 40), gender, override: v.override === true };
  } catch {
    return memory;
  }
}

export function writeStoredChild(child: StoredNameChild | null): void {
  memory = child;
  try {
    if (child) window.localStorage.setItem(KEY, JSON.stringify(child));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode: the in-memory value lasts for this page view */
  }
}

/** Which child the page shows: a chosen name over the character only when asked to. */
export function resolveChild(account: AdventAccountState | null, stored: StoredNameChild | null): AdventChild | null {
  const character = account?.character ?? null;
  if (stored && (stored.override || !character)) return { source: "name", name: stored.name, gender: stored.gender };
  if (character) return { source: "character", ...character };
  return null;
}
