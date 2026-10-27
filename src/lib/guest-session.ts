"use client";

// Silent guest session for the creation flow: no account is ever required to
// create a book. The first call that needs a user_id (photo upload, character
// prep, story creation) signs in anonymously; later calls reuse the session.
//
// Never a captcha in sight: a Turnstile token is fetched in the background and,
// when Supabase accepts it, the guest is "verified" (normal limits). Without one
// (in-app browsers, blocked script, a challenge that wanted an interaction, a
// refused token) POST /api/auth/guest-session creates the session server-side,
// flagged unverified: paid generations then run under stricter per-IP daily caps
// (src/lib/unverified-guest.ts). Rejects only when even that fails (network, cap).

import { getBackgroundCaptchaToken, isCaptchaEnabled } from "@/lib/captcha/turnstile";

const FALLBACK_TIMEOUT_MS = 15_000;

let pending: Promise<void> | null = null;

export function ensureGuestSession(locale?: string): Promise<void> {
  if (!pending) {
    pending = (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;

      const captchaToken = await getBackgroundCaptchaToken(locale);
      // No site key = Supabase CAPTCHA is expected to be off: the direct sign-up works.
      if (captchaToken || !isCaptchaEnabled()) {
        const { data, error } = await supabase.auth.signInAnonymously(
          captchaToken ? { options: { captchaToken } } : undefined,
        );
        if (!error && data.session) return;
        console.info("[guest] direct sign-in refused, using the limited guest session:", error?.code ?? "no_session");
      }

      const res = await fetch("/api/auth/guest-session", {
        method: "POST",
        signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
      });
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
