import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { issueGuestMergeCookie } from "@/lib/auth/session-finish";

/**
 * POST /api/auth/guest-merge — called right before a guest starts logging in
 * (email or Google). If, and only if, the CURRENT session is an anonymous user,
 * set the HttpOnly signed proof that lets the finished login adopt that guest's
 * books. Anyone else gets a no-op, so it is safe to call unconditionally.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.is_anonymous) return NextResponse.json({ guest: false });

  await issueGuestMergeCookie(user.id);
  return NextResponse.json({ guest: true });
}
