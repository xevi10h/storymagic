// Server-only: the signed-in visitor as the Advent calendar sees them.
//  - character: their most recently updated saved character (name, gender, watercolour
//    portrait rebuilt from its traits), guests (anonymous sessions) included;
//  - portraitEmail: the account's own address, only when it is a real (non-anonymous)
//    account with a confirmed email. Portrait PDFs are emailed ONLY to that address.

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/marketing/unsubscribe-token";
import type { AvatarTraits } from "@/lib/avatar/manifest";
import { characterTraits } from "./assets";
import { asAdventGender } from "./personalize";
import type { AdventGender } from "./render";

export interface AdventCharacter {
  id: string;
  name: string;
  gender: AdventGender;
  traits: AvatarTraits | null;
}

export interface AdventAccount {
  userId: string | null;
  /** The account email when portrait PDFs may be emailed to it, else null. */
  portraitEmail: string | null;
  character: AdventCharacter | null;
}

const CHARACTER_COLUMNS = "id, name, gender, age, skin_tone, hair_color, hairstyle, eye_color, glasses, freckles";

/** A real account's own confirmed address (never a guest's). */
export function verifiedAccountEmail(user: Pick<User, "is_anonymous" | "email" | "email_confirmed_at"> | null): string | null {
  if (!user || user.is_anonymous || !user.email_confirmed_at) return null;
  return normalizeEmail(user.email);
}

type CharacterRow = {
  id: string;
  name: string;
  gender: string;
  age: number;
  skin_tone: string;
  hair_color: string;
  hairstyle: string | null;
  eye_color: string | null;
  glasses: string | null;
  freckles: boolean | null;
};

export function toAdventCharacter(row: CharacterRow): AdventCharacter {
  return { id: row.id, name: row.name, gender: asAdventGender(row.gender), traits: characterTraits(row) };
}

/** Reads the session from the request cookies (RLS client: only the caller's own rows). */
export async function loadAdventAccount(): Promise<AdventAccount> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, portraitEmail: null, character: null };
  const { data } = await supabase
    .from("characters")
    .select(CHARACTER_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    userId: user.id,
    portraitEmail: verifiedAccountEmail(user),
    character: data ? toAdventCharacter(data as CharacterRow) : null,
  };
}

/** One of the caller's own characters by id (RLS + explicit owner filter). */
export async function loadOwnCharacter(userId: string, characterId: string): Promise<AdventCharacter | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("characters").select(CHARACTER_COLUMNS).eq("id", characterId).eq("user_id", userId).maybeSingle();
  return data ? toAdventCharacter(data as CharacterRow) : null;
}
