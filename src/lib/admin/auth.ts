// Operator gate for /admin pages and /api/admin routes — SERVER ONLY.
// Anyone who is not an operator gets a 404 (the panel's existence is not revealed).

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "./allowlist";

export interface AdminIdentity {
  email: string;
  userId: string;
}

/** The logged-in operator, or null. Uses getUser() (verified with Supabase Auth), never the raw cookie. */
export async function getAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminUser(user, process.env.ADMIN_EMAILS)) return null;
  return { email: user.email!.trim().toLowerCase(), userId: user.id };
}

/** Server components: the operator, or the 404 page. */
export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
