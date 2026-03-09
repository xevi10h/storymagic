import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { searchParams, origin } = new URL(request.url);
  const { locale } = await params;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Safely decode the next param (handles double-encoding from email confirmation)
  let next = rawNext;
  try {
    const decoded = decodeURIComponent(rawNext);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      next = decoded;
    }
  } catch {
    // Use rawNext as-is
  }

  // Prevent open redirect — must be a safe relative path
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/${locale}${next}`);
    }
  }

  // Auth error — redirect to login with error (preserve locale)
  return NextResponse.redirect(`${origin}/${locale}/auth/login?error=auth_failed`);
}
