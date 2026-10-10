import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_S, normalizeCode } from "@/lib/promo-codes";

/**
 * Referral link printed in the book (QR) and shared from the emails / library:
 * /<locale>/r/<code> keeps the code for 30 days and opens the creator. /api/checkout
 * pre-applies it to a printed book (src/lib/growth/referrals.ts). No DB lookup here:
 * an unknown code is simply ignored at checkout.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale: raw, code: rawCode } = await params;
  const locale = (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;
  let code: string | null = null;
  try {
    code = normalizeCode(decodeURIComponent(rawCode));
  } catch {
    // malformed escape: no code
  }
  const response = NextResponse.redirect(new URL(`/${locale}/create`, request.url), 307);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  if (code) {
    // Strictly necessary for the service the visitor asked for (the discount of the link).
    response.cookies.set(REFERRAL_COOKIE, code, {
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_S,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
