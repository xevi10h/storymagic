import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/crear";

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
    next = "/crear";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
