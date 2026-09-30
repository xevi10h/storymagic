import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/auth/session-finish";
import { isAuthLocale, localizedPath, sanitizeNextPath } from "@/lib/auth/next-path";

// Email types our templates send: magic link / OTP ("email"), guest upgrade
// ("email_change"). The others are accepted so an older email still works.
const EMAIL_TYPES: EmailOtpType[] = ["email", "email_change", "magiclink", "signup"];

/**
 * GET /api/auth/confirm — the link in the sign-in / confirm-email emails:
 *   {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
 * where RedirectTo = <origin>/api/auth/confirm?locale=ca&next=%2Fdashboard.
 * Verifies server-side (works on any device or browser, no PKCE verifier needed),
 * links guest data, then lands on `next` in the right language. With the stock
 * Supabase template the PKCE `code` arrives instead: exchanged the same way.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const locale = isAuthLocale(searchParams.get("locale")) ? (searchParams.get("locale") as string) : "es";
  const next = sanitizeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type && EMAIL_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    if (error) console.warn(`[auth/confirm] verifyOtp failed: ${error.code ?? error.message}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error) console.warn(`[auth/confirm] code exchange failed: ${error.code ?? error.message}`);
  }

  if (ok) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !user.is_anonymous) {
      if (user.user_metadata?.locale !== locale) await supabase.auth.updateUser({ data: { locale } });
      await finishLogin(user);
      return NextResponse.redirect(new URL(localizedPath(locale, next), origin));
    }
  }

  const login = new URL(`/${locale}/auth/login`, origin);
  login.searchParams.set("error", "link_invalid");
  if (next !== "/dashboard") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
