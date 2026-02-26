import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch profile from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, avatar_url, created_at")
    .eq("id", user.id)
    .single();

  // Determine auth provider
  const provider = user.app_metadata?.provider || "email";
  const isAnonymous = user.is_anonymous ?? false;

  return NextResponse.json({
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    name: profile?.name ?? user.user_metadata?.full_name ?? "",
    avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    provider,
    isAnonymous,
    createdAt: profile?.created_at ?? user.created_at,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body as { name?: string };

  if (name !== undefined) {
    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    // Also update user metadata
    await supabase.auth.updateUser({
      data: { full_name: name },
    });
  }

  return NextResponse.json({ success: true });
}
