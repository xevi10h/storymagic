// Route-handler glue: read/issue/clear the guest-merge cookie and finish a login.
// Used by /api/auth/guest-merge, /api/auth/complete, /api/auth/confirm and the
// Google callback, so every login path links guest data the same way.

import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { completeLogin, type CompleteLoginResult } from "./guest-merge";
import { GUEST_MERGE_COOKIE, GUEST_MERGE_TTL_SEC, mergeKey, signMergeToken, verifyMergeToken } from "./merge-token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Lax: the cookie must survive the top-level GET back from Google / the email link.
  sameSite: "lax" as const,
  path: "/",
};

/** Mint the proof for the anonymous user that holds the current session. */
export async function issueGuestMergeCookie(anonUserId: string): Promise<void> {
  const store = await cookies();
  store.set(GUEST_MERGE_COOKIE, signMergeToken(anonUserId, mergeKey()), { ...cookieOptions, maxAge: GUEST_MERGE_TTL_SEC });
}

async function takeGuestMergeCookie(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(GUEST_MERGE_COOKIE)?.value;
  if (!raw) return null;
  // Single use: cleared whatever the outcome.
  store.set(GUEST_MERGE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  try {
    return verifyMergeToken(raw, mergeKey());
  } catch {
    return null;
  }
}

/** After a verified login: consume the merge proof (if any) and link guest data. */
export async function finishLogin(user: User): Promise<CompleteLoginResult> {
  const anonId = await takeGuestMergeCookie();
  return completeLogin(user, anonId);
}
