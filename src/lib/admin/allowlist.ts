// Operator allowlist — pure (no I/O, no path aliases) so allowlist.check.mjs can run it with Node.
//
// ADMIN_EMAILS = comma-separated list of operator emails. Access requires a real
// (non-anonymous) Supabase user whose email is CONFIRMED and on the list. An empty
// or missing ADMIN_EMAILS means nobody is an operator (fail closed).

export interface AdminCandidate {
  email?: string | null;
  email_confirmed_at?: string | null;
  is_anonymous?: boolean | null;
}

/** Normalised operator emails from the env value (trimmed, lower-case, de-duplicated, empties dropped). */
export function parseAdminEmails(raw: string | null | undefined): string[] {
  return [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  ];
}

/** True only for a confirmed, non-anonymous user whose email is on the allowlist. */
export function isAdminUser(user: AdminCandidate | null | undefined, rawAllowlist: string | null | undefined): boolean {
  if (!user || user.is_anonymous) return false;
  if (!user.email_confirmed_at) return false;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return parseAdminEmails(rawAllowlist).includes(email);
}
