// Account erasure (RGPD art. 17) — SERVER ONLY, service role.
// One routine for DELETE /api/account (self-service) and the guest purge cron.
// Rules and their rationale: ./retention-policy.ts.
//
// Order of operations (every step idempotent, so a failed run can simply be retried):
//   1. read everything (user, orders, stories, characters, preps)
//   2. blocker check (paid book not yet shipped → refuse)
//   3. orders: anonymise the ones we keep, delete the unpaid ones — FIRST, so an
//      old ON DELETE CASCADE can never take an accounting record with the story
//   4. storage objects (all buckets) — before the rows that point to them, so a
//      failure never leaves unreachable orphans
//   5. rows: stories (→ illustrations), sagas, characters, character_preps,
//      photo_consents, rate_limits, newsletter row for the email, profile
//   6. the auth user
//   7. erasure register (ids and counts only, no personal data)
// Logs carry ids and counts, never names, emails or paths' contents.

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { illustrationPath } from "../storage/illustration-refs";
import {
  erasureBlocker,
  orderErasureDisposition,
  userStorageTargets,
  type ErasureOrder,
  type StorageTarget,
} from "./retention-policy";

export type ErasureTrigger = "self_service" | "guest_purge" | "admin";

export interface ErasureCounts {
  stories: number;
  characters: number;
  characterPreps: number;
  photoConsents: number;
  storageObjects: number;
  ordersAnonymised: number;
  ordersDeleted: number;
  newsletterRows: number;
}

export type ErasureResult =
  | { state: "erased" | "dry_run"; counts: ErasureCounts; keptOrderIds: string[] }
  | { state: "blocked"; orderId: string; orderStatus: string }
  | { state: "not_found" };

export function erasureServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service config");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const LIST_PAGE = 1000;
const REMOVE_CHUNK = 500;
const MAX_DEPTH = 6;

/** Every object path under `prefix` (recursive; storage.list is one level deep). */
async function listObjects(admin: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) throw new Error(`storage listing too deep under ${bucket}/${prefix}`);
  const folder = prefix.replace(/\/+$/, "");
  const out: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: LIST_PAGE, offset });
    if (error) {
      // A missing bucket (e.g. child-photos before its migration) holds nothing to erase.
      if (/not.?found/i.test(error.message)) return out;
      throw new Error(`storage list ${bucket}/${folder} failed: ${error.message}`);
    }
    for (const item of data ?? []) {
      const path = `${folder}/${item.name}`;
      // Folders come back with id === null.
      if (item.id === null) out.push(...(await listObjects(admin, bucket, `${path}/`, depth + 1)));
      else out.push(path);
    }
    if (!data || data.length < LIST_PAGE) return out;
  }
}

async function resolveTargets(admin: SupabaseClient, targets: readonly StorageTarget[]): Promise<Map<string, string[]>> {
  const byBucket = new Map<string, string[]>();
  for (const t of targets) {
    const paths = t.path ? [t.path] : await listObjects(admin, t.bucket, t.prefix!);
    if (paths.length === 0) continue;
    byBucket.set(t.bucket, [...(byBucket.get(t.bucket) ?? []), ...paths]);
  }
  return byBucket;
}

async function removeObjects(admin: SupabaseClient, byBucket: Map<string, string[]>): Promise<number> {
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const unique = [...new Set(paths)];
    for (let i = 0; i < unique.length; i += REMOVE_CHUNK) {
      const chunk = unique.slice(i, i + REMOVE_CHUNK);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`storage remove in ${bucket} failed: ${error.message}`);
      removed += chunk.length;
    }
  }
  return removed;
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/**
 * Erase one user. `dryRun` reads everything (DB + storage listings) and returns the
 * counts it WOULD act on, writing nothing. Throws on unexpected failures (the caller
 * retries; every step is idempotent).
 */
export async function eraseAccount(
  admin: SupabaseClient,
  userId: string,
  opts: { trigger: ErasureTrigger; dryRun?: boolean; now?: number },
): Promise<ErasureResult> {
  const now = opts.now ?? Date.now();

  // ── 1. Read ─────────────────────────────────────────────────────────────────
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr && !/not.?found/i.test(userErr.message)) throw new Error(`getUserById: ${userErr.message}`);
  const user = userData?.user ?? null;
  const { data: profile } = await admin.from("profiles").select("id, email").eq("id", userId).maybeSingle();
  if (!user && !profile) return { state: "not_found" };

  const orders = must(
    await admin.from("orders").select("id, status, format, created_at, stripe_payment_id").eq("user_id", userId),
    "orders read",
  ) as ErasureOrder[];

  // ── 2. Blocker ──────────────────────────────────────────────────────────────
  const blocker = erasureBlocker(orders);
  if (blocker) return { state: "blocked", orderId: blocker.id, orderStatus: blocker.status };

  const stories = must(
    await admin.from("stories").select("id, character_portrait_url, cover_image_url").eq("user_id", userId),
    "stories read",
  ) as Array<{ id: string; character_portrait_url: string | null; cover_image_url: string | null }>;
  const characters = must(await admin.from("characters").select("id, avatar_url").eq("user_id", userId), "characters read") as Array<{
    id: string;
    avatar_url: string | null;
  }>;
  const preps = must(
    await admin.from("character_preps").select("id, avatar_ref, child_sheet_url").eq("user_id", userId),
    "character_preps read",
  ) as Array<{ id: string; avatar_ref: string | null; child_sheet_url: string | null }>;
  const { count: consentCount } = await admin
    .from("photo_consents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const storyIds = stories.map((s) => s.id);
  // Legacy portraits (portraits/{uuid}/file, pre-2026-09-27) are not under the user's
  // folder: delete the exact files the user's own rows reference.
  const legacyPortraitPaths = [
    ...stories.flatMap((s) => [s.character_portrait_url, s.cover_image_url]),
    ...characters.map((c) => c.avatar_url),
    ...preps.flatMap((p) => [p.avatar_ref, p.child_sheet_url]),
  ]
    .map((ref) => illustrationPath(ref))
    .filter((p): p is string => !!p && p.startsWith("portraits/") && p.split("/").length === 3);

  const targets = userStorageTargets({ userId, storyIds, prepIds: preps.map((p) => p.id), legacyPortraitPaths });
  const objects = await resolveTargets(admin, targets);
  const objectCount = [...objects.values()].reduce((n, paths) => n + new Set(paths).size, 0);

  const keep = orders.filter((o) => orderErasureDisposition(o, now) === "anonymise");
  const drop = orders.filter((o) => orderErasureDisposition(o, now) === "delete");
  const email: string = String(user?.email ?? profile?.email ?? "").trim().toLowerCase();
  // Case-insensitive exact match: escape LIKE wildcards ("_" is common in emails).
  const emailPattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);

  const counts: ErasureCounts = {
    stories: stories.length,
    characters: characters.length,
    characterPreps: preps.length,
    photoConsents: consentCount ?? 0,
    storageObjects: objectCount,
    ordersAnonymised: keep.length,
    ordersDeleted: drop.length,
    newsletterRows: 0,
  };

  if (email) {
    const { count } = await admin.from("newsletter_subscribers").select("id", { count: "exact", head: true }).ilike("email", emailPattern);
    counts.newsletterRows = count ?? 0;
  }

  if (opts.dryRun) return { state: "dry_run", counts, keptOrderIds: keep.map((o) => o.id) };

  // ── 3. Orders ───────────────────────────────────────────────────────────────
  for (const order of keep) {
    must(
      await admin
        .from("orders")
        .update({
          user_id: null,
          story_id: null,
          pdf_url: null,
          print_interior_path: null,
          print_cover_path: null,
          download_token: randomUUID(), // the emailed download link dies with the book
        })
        .eq("id", order.id),
      `anonymise order ${order.id}`,
    );
  }
  if (drop.length > 0) {
    must(await admin.from("orders").delete().in("id", drop.map((o) => o.id)), "delete unpaid orders");
  }

  // ── 4. Storage ──────────────────────────────────────────────────────────────
  counts.storageObjects = await removeObjects(admin, objects);

  // ── 5. Rows ─────────────────────────────────────────────────────────────────
  if (storyIds.length > 0) {
    must(await admin.from("story_illustrations").delete().in("story_id", storyIds), "delete illustrations");
    must(await admin.from("stories").delete().eq("user_id", userId), "delete stories");
  }
  must(await admin.from("sagas").delete().eq("user_id", userId), "delete sagas");
  must(await admin.from("characters").delete().eq("user_id", userId), "delete characters");
  must(await admin.from("character_preps").delete().eq("user_id", userId), "delete character_preps");
  // Photo consent rows: the photo itself is gone (≤ 24 h); the proof of consent is
  // not kept past the account (the register keeps the count).
  must(await admin.from("photo_consents").delete().eq("user_id", userId), "delete photo_consents");
  must(await admin.from("rate_limits").delete().eq("user_id", userId), "delete rate_limits");
  if (email) must(await admin.from("newsletter_subscribers").delete().ilike("email", emailPattern), "delete newsletter row");
  must(await admin.from("profiles").delete().eq("id", userId), "delete profile");

  // ── 6. Auth user ────────────────────────────────────────────────────────────
  if (user) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error && !/not.?found/i.test(error.message)) throw new Error(`deleteUser: ${error.message}`);
  }

  // ── 7. Register ─────────────────────────────────────────────────────────────
  const keptOrderIds = keep.map((o) => o.id);
  const { error: regErr } = await admin.from("account_erasures").insert({
    user_id: userId,
    trigger: opts.trigger,
    was_anonymous: user?.is_anonymous ?? false,
    counts,
    kept_order_ids: keptOrderIds,
  });
  if (regErr) console.error(`[erasure] register insert failed for ${userId}: ${regErr.message}`);
  console.log(`[erasure] ${opts.trigger} user ${userId}: ${JSON.stringify(counts)} kept orders ${keptOrderIds.length}`);

  return { state: "erased", counts, keptOrderIds };
}
