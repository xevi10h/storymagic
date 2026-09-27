"use client";

// Silent guest session for the creation flow: no account is ever required to
// create a book. The first call that needs a user_id (photo upload, character
// prep, story creation) signs in anonymously; later calls reuse the session.

let pending: Promise<void> | null = null;

export function ensureGuestSession(): Promise<void> {
  if (!pending) {
    pending = (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session) throw error ?? new Error("guest_session_missing");
    })().catch((err) => {
      pending = null; // allow a retry on the next action
      throw err;
    });
  }
  return pending;
}
