// Guest → account linking (server only, service role).
//
//   completeLogin()  runs after EVERY verified login (email code, email link, Google):
//     1. keeps profiles.email / name in sync (a guest upgraded in place still says "Invitado"),
//     2. full merge: the signed guest-merge cookie proves this browser held anonymous
//        user X → X's books move to the account and X is deleted,
//     3. orders paid with this (verified) email by an anonymous user on another device
//        → those orders and their books move to the account (never from a permanent one).
//
// Storage: objects are keyed by user id in two places. They are COPIED to the new
// owner's folder before the DB transaction and the originals removed afterwards:
//   illustrations/portraits/<userId>/…   (AI portraits; refs rewritten by the SQL function)
//   book-pdfs/<userId>/<storyId>.pdf      (customer PDF; path derived from stories.user_id)
// Print files (orders.print_*_path) and story art (illustrations/<storyId>/…) keep their paths.

import { createClient as createServiceClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ILLUSTRATIONS_BUCKET } from "@/lib/storage/illustration-refs";
import { bookPdfPath } from "@/lib/supabase/storage";

const BOOK_PDFS_BUCKET = "book-pdfs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Order states that mean "the guest really bought this" (pending/cancelled = abandoned checkout). */
const CLAIMABLE_ORDER_STATUSES = ["paid", "producing", "shipped", "delivered", "refunded"];

export interface MergeResult {
  stories: number;
  characters: number;
  orders: number;
  anon_deleted: boolean;
  story_ids: string[];
}

export interface CompleteLoginResult {
  merged: MergeResult | null;
  claimedOrders: number;
}

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase service role is not configured");
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Escape LIKE wildcards so an address like "a_b@x.com" only matches itself under ILIKE. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function listPortraitFiles(admin: SupabaseClient, userId: string): Promise<string[]> {
  const root = `portraits/${userId}`;
  const out: string[] = [];
  const { data: folders, error } = await admin.storage.from(ILLUSTRATIONS_BUCKET).list(root, { limit: 1000 });
  if (error || !folders) return out;
  for (const entry of folders) {
    // Folders come back with id === null; files directly under the root are listed too.
    if (entry.id) {
      out.push(`${root}/${entry.name}`);
      continue;
    }
    const { data: files } = await admin.storage.from(ILLUSTRATIONS_BUCKET).list(`${root}/${entry.name}`, { limit: 1000 });
    for (const f of files ?? []) if (f.id) out.push(`${root}/${entry.name}/${f.name}`);
  }
  return out;
}

interface CopyPlan {
  bucket: string;
  from: string;
  to: string;
}

async function copyObjects(admin: SupabaseClient, plan: CopyPlan[]): Promise<CopyPlan[]> {
  const copied: CopyPlan[] = [];
  for (const item of plan) {
    const { error } = await admin.storage.from(item.bucket).copy(item.from, item.to);
    // A PDF that was never generated is simply not there: fine. Anything else aborts.
    if (error) {
      const notFound = /not.?found/i.test(error.message);
      if (notFound) continue;
      if (/already exists|duplicate/i.test(error.message)) {
        copied.push(item);
        continue;
      }
      throw new Error(`storage copy ${item.bucket}/${item.from}: ${error.message}`);
    }
    copied.push(item);
  }
  return copied;
}

async function removeObjects(admin: SupabaseClient, items: CopyPlan[], side: "from" | "to") {
  const byBucket = new Map<string, string[]>();
  for (const item of items) byBucket.set(item.bucket, [...(byBucket.get(item.bucket) ?? []), item[side]]);
  for (const [bucket, paths] of byBucket) {
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) console.warn(`[guest-merge] could not remove ${paths.length} object(s) from ${bucket}: ${error.message}`);
  }
}

/**
 * Move an anonymous user's books to a permanent user. `storyIds` null = everything
 * (and the anonymous user is deleted); otherwise only those stories (+ their orders,
 * character, saga, prep). Storage is copied first; the DB move is one transaction.
 */
export async function mergeGuestIntoUser(anonId: string, targetId: string, storyIds: string[] | null): Promise<MergeResult | null> {
  if (!UUID_RE.test(anonId) || !UUID_RE.test(targetId) || anonId === targetId) return null;
  const admin = serviceClient();

  // Defence in depth (the SQL function re-checks under a row lock).
  const { data: anonUser, error: anonErr } = await admin.auth.admin.getUserById(anonId);
  if (anonErr || !anonUser?.user || anonUser.user.is_anonymous !== true) return null;

  let stories: string[];
  if (storyIds) {
    stories = storyIds;
  } else {
    const { data } = await admin.from("stories").select("id").eq("user_id", anonId);
    stories = (data ?? []).map((r: { id: string }) => r.id);
  }

  const plan: CopyPlan[] = stories.map((sid) => ({
    bucket: BOOK_PDFS_BUCKET,
    from: bookPdfPath(anonId, sid),
    to: bookPdfPath(targetId, sid),
  }));
  const portraits = await listPortraitFiles(admin, anonId);
  for (const path of portraits) {
    plan.push({ bucket: ILLUSTRATIONS_BUCKET, from: path, to: `portraits/${targetId}/${path.slice(`portraits/${anonId}/`.length)}` });
  }

  const copied = await copyObjects(admin, plan);

  const { data, error } = await admin.rpc("merge_guest_account", {
    p_anon: anonId,
    p_target: targetId,
    p_story_ids: storyIds,
  });
  if (error) {
    await removeObjects(admin, copied, "to");
    throw new Error(`merge_guest_account: ${error.message}`);
  }

  // Originals: PDFs of moved stories always; portraits only when the guest is gone
  // (a partial merge leaves the guest's other characters pointing at them).
  const fullMerge = storyIds === null;
  await removeObjects(
    admin,
    copied.filter((c) => c.bucket === BOOK_PDFS_BUCKET || fullMerge),
    "from",
  );

  return data as MergeResult;
}

/** Orders paid with this email by anonymous users (other devices) → this account. */
async function claimGuestOrdersByEmail(user: User): Promise<number> {
  const email = user.email?.trim();
  if (!email || !user.email_confirmed_at) return 0;
  const admin = serviceClient();
  const { data: orders, error } = await admin
    .from("orders")
    .select("user_id, story_id, status")
    .ilike("customer_email", escapeLike(email))
    .neq("user_id", user.id)
    .in("status", CLAIMABLE_ORDER_STATUSES);
  if (error || !orders?.length) return 0;

  const byOwner = new Map<string, Set<string>>();
  for (const o of orders as { user_id: string; story_id: string }[]) {
    if (!o.user_id || !o.story_id) continue;
    byOwner.set(o.user_id, (byOwner.get(o.user_id) ?? new Set()).add(o.story_id));
  }

  let claimed = 0;
  for (const [ownerId, storySet] of byOwner) {
    try {
      // mergeGuestIntoUser refuses permanent owners (never steal from an account).
      const res = await mergeGuestIntoUser(ownerId, user.id, [...storySet]);
      claimed += res?.orders ?? 0;
    } catch (err) {
      console.error(`[guest-merge] claiming orders of ${ownerId} failed:`, err);
    }
  }
  return claimed;
}

/** profiles.email / name follow the verified account (guests upgraded in place say "Invitado"). */
async function syncProfile(user: User) {
  if (!user.email) return;
  const admin = serviceClient();
  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim() || (user.user_metadata?.name as string | undefined)?.trim();
  const currentName = (profile?.name as string | null | undefined)?.trim();
  const name = !currentName || currentName === "Invitado" ? metaName || user.email.split("@")[0] : currentName;
  await admin.from("profiles").upsert({ id: user.id, email: user.email, name }, { onConflict: "id" });
}

/**
 * Everything that must happen after a verified login. `mergeAnonId` comes ONLY from a
 * verified guest-merge cookie. Never throws: login must succeed even if linking fails.
 */
export async function completeLogin(user: User, mergeAnonId: string | null): Promise<CompleteLoginResult> {
  const result: CompleteLoginResult = { merged: null, claimedOrders: 0 };
  if (user.is_anonymous) return result;

  try {
    await syncProfile(user);
  } catch (err) {
    console.error("[auth] profile sync failed:", err);
  }

  if (mergeAnonId && mergeAnonId !== user.id) {
    try {
      result.merged = await mergeGuestIntoUser(mergeAnonId, user.id, null);
    } catch (err) {
      console.error("[auth] guest merge failed:", err);
    }
  }

  try {
    result.claimedOrders = await claimGuestOrdersByEmail(user);
  } catch (err) {
    console.error("[auth] order claim failed:", err);
  }
  return result;
}
