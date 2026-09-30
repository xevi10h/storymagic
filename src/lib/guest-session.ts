"use client";

// Silent guest session for the creation flow: no account is ever required to
// create a book. The first call that needs a user_id (photo upload, character
// prep, story creation) signs in anonymously; later calls reuse the session.
//
// Anonymous sign-up is the door to paid AI previews, so it carries a Turnstile
// token (Supabase CAPTCHA protection). A failed challenge throws a CaptchaError
// (or Supabase's `captcha_failed`): callers show it with isCaptchaError().

import { getCaptchaToken, type CaptchaLabels } from "@/lib/captcha/turnstile";

let pending: Promise<void> | null = null;

export function ensureGuestSession(captchaLabels?: CaptchaLabels): Promise<void> {
  if (!pending) {
    pending = (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;
      const captchaToken = await getCaptchaToken(captchaLabels);
      const { data, error } = await supabase.auth.signInAnonymously(
        captchaToken ? { options: { captchaToken } } : undefined,
      );
      if (error || !data.session) throw error ?? new Error("guest_session_missing");
    })().catch((err) => {
      pending = null; // allow a retry on the next action
      throw err;
    });
  }
  return pending;
}
