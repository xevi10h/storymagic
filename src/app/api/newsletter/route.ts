import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  let email: string;
  try {
    const body = await request.json();
    email = body.email?.trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createClient(url, key);

  // Upsert to avoid duplicates — if email exists, just update subscribed_at
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: "email" });

  if (error) {
    console.error("[newsletter] Supabase error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
