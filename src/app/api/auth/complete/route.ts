import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/auth/session-finish";
import { isAuthLocale } from "@/lib/auth/next-path";

/**
 * POST /api/auth/complete — after the 6-digit code was verified in the browser.
 * Body (optional): { locale }. Links guest data (merge cookie / orders paid with
 * this email) and remembers the locale for the next auth emails.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let locale: string | null = null;
  try {
    const body = (await request.json()) as { locale?: unknown };
    locale = isAuthLocale(body.locale) ? body.locale : null;
  } catch {
    // no body
  }
  if (locale && user.user_metadata?.locale !== locale) {
    await supabase.auth.updateUser({ data: { locale } });
  }

  const result = await finishLogin(user);
  return NextResponse.json({
    ok: true,
    mergedStories: result.merged?.stories ?? 0,
    claimedOrders: result.claimedOrders,
  });
}
