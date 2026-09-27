// Child photo privacy helpers (private bucket `child-photos`).
//
// TODO(child-photos): placeholder matching the privacy branch's contract so
// POST /api/characters/prepare compiles and calls the hooks at the right
// moments. The real implementation (ownership check, EXIF stripping, consent
// record, hourly purge) replaces this file on merge.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "child-photos";

function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** The photo's bytes, for the child sheet's facial likeness. Throws when it is missing or not the user's. */
export async function loadChildPhoto(photoPath: string, userId: string): Promise<{ data: Buffer; mime: string }> {
  if (!photoPath.startsWith(`${userId}/`)) throw new Error("child photo does not belong to this user");
  const { data, error } = await adminClient().storage.from(BUCKET).download(photoPath);
  if (error || !data) throw new Error(`child photo download failed: ${error?.message ?? "empty"}`);
  const mime = data.type === "image/png" || data.type === "image/webp" ? data.type : "image/jpeg";
  return { data: Buffer.from(await data.arrayBuffer()), mime };
}

/** Deletes the child's photo once it is no longer needed. Never throws; idempotent. */
export async function deleteChildPhoto(photoPath: string, userId: string, admin?: SupabaseClient): Promise<{ ok: boolean }> {
  try {
    if (!photoPath.startsWith(`${userId}/`)) return { ok: false };
    const { error } = await (admin ?? adminClient()).storage.from(BUCKET).remove([photoPath]);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
