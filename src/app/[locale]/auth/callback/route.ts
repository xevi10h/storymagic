import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/auth/session-finish";
import { isAuthLocale, localizedPath, sanitizeNextPath } from "@/lib/auth/next-path";

/**
 * OAuth (Google) callback: exchange the PKCE code, link guest data (merge cookie
 * set before leaving for Google + orders paid with this email), land on `next`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { searchParams, origin } = new URL(request.url);
  const { locale: rawLocale } = await params;
  const locale = isAuthLocale(rawLocale) ? rawLocale : "es";
  const next = sanitizeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        if (user.user_metadata?.locale !== locale) await supabase.auth.updateUser({ data: { locale } });
        await finishLogin(user);
      }
      return NextResponse.redirect(new URL(localizedPath(locale, next), origin));
    }
    console.warn(`[auth/callback] code exchange failed: ${error.code ?? error.message}`);
  }

  // Cancelled at Google or the flow expired: back to the login screen, same language and destination.
  const login = new URL(`/${locale}/auth/login`, origin);
  login.searchParams.set("error", "auth_failed");
  if (next !== "/dashboard") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
