"use client";

// Silent guest session for the creation flow: no account is ever required to
// create a book. The first call that needs a user_id (photo upload, character
// prep, story creation) creates the session; later calls reuse it.
//
// Never a captcha in sight: POST /api/auth/guest-session runs the invisible
// Vercel BotID check (headers attached by src/instrumentation-client.ts) and
// signs the guest in server-side. Rejects when that fails (bot, network, cap).

import { withDeadline } from "@/lib/botid/deadline";

const GUEST_SESSION_TIMEOUT_MS = 20_000;

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

      const res = await withDeadline(
        (signal) => fetch("/api/auth/guest-session", { method: "POST", signal }),
        GUEST_SESSION_TIMEOUT_MS,
      );
      if (!res.ok) throw new Error(`guest_session_${res.status}`);
      const tokens = (await res.json()) as { access_token: string; refresh_token: string };
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
    })().catch((err) => {
      pending = null; // allow a retry on the next action
      throw err;
    });
  }
  return pending;
}
