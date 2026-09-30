// Account erasure + guest retention rules — pure (no I/O, no path aliases) so
// retention-policy.check.mjs can run them with Node. The I/O lives in account-erasure.ts.
//
// Decisions (2026-09-30):
// - Paid orders are accounting records (Código de Comercio art. 30: 6 years) and are
//   KEPT on erasure, stripped of every link to the child: user_id / story_id → NULL,
//   stored PDF paths → NULL, download token rotated (the link dies). Billing/shipping,
//   email, amounts, invoice, tracking and Gelato id stay.
// - Unpaid orders carry no legal duty: 'cancelled' and 'pending' older than a day
//   (Checkout sessions expire after 24 h) are deleted. A 'pending' order younger than
//   that is kept (anonymised) so a payment completing late still finds its order.
// - Erasure is BLOCKED while a paid book is still being made or not yet shipped:
//   physical 'paid'/'producing', digital 'paid' (book not delivered yet).
//   Deleting then would destroy the files Gelato / the customer still need.
// - Guest purge: anonymous users with no paid order, inactive > 30 days. Registered
//   users keep their library until they erase it themselves. Guests owning a
//   showcase (example) book are never purged automatically.

export const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);
/** Statuses that mean money was taken at some point (refunded included: its invoice exists). */
export const PAID_EVER_STATUSES = new Set(["paid", "producing", "shipped", "delivered", "refunded"]);
export const GUEST_INACTIVE_DAYS = 30;
/** Checkout Sessions expire after 24 h: an older 'pending' order can no longer be paid. */
export const PENDING_ORDER_TTL_HOURS = 24;

export interface ErasureOrder {
  id: string;
  status: string;
  format: string;
  created_at: string;
  stripe_payment_id?: string | null;
}

/** An order that forbids erasing the account right now, or null. */
export function erasureBlocker(orders: readonly ErasureOrder[]): ErasureOrder | null {
  return (
    orders.find((o) =>
      PHYSICAL_FORMATS.has(o.format) ? o.status === "paid" || o.status === "producing" : o.status === "paid",
    ) ?? null
  );
}

export function isPaidEver(order: Pick<ErasureOrder, "status" | "stripe_payment_id">): boolean {
  return PAID_EVER_STATUSES.has(order.status) || !!order.stripe_payment_id;
}

/** What erasure does with one order: keep it anonymised, or delete it. */
export function orderErasureDisposition(order: ErasureOrder, now: number): "anonymise" | "delete" {
  if (isPaidEver(order)) return "anonymise";
  if (order.status === "cancelled") return "delete";
  if (order.status === "pending") {
    const ageHours = (now - new Date(order.created_at).getTime()) / 3_600_000;
    return ageHours > PENDING_ORDER_TTL_HOURS ? "delete" : "anonymise";
  }
  return "anonymise"; // unknown status: keep, never lose a record by accident
}

// ── Storage ──────────────────────────────────────────────────────────────────

export interface StorageTarget {
  bucket: string;
  /** Folder prefix (removed recursively) … */
  prefix?: string;
  /** … or one exact object path. */
  path?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every storage location holding the user's data. Folders are UUID-validated so a
 * malformed id can never widen a prefix to a whole bucket.
 *   illustrations/{storyId}/…           scenes, covers, sheets of each story
 *   illustrations/portraits/{userId}/…  avatar portraits
 *   illustrations/character-preps/{prepId}/…  early child sheets
 *   illustrations/portraits/{uuid}/file legacy portraits referenced by the user's rows (exact files)
 *   showcase/{storyId}/…                public mirror of a story used as an example
 *   book-pdfs/{userId}/…                customer PDF + per-order print files
 *   child-photos/{userId}/…             the child's photo (normally already deleted ≤ 24 h)
 */
export function userStorageTargets(input: {
  userId: string;
  storyIds: readonly string[];
  prepIds: readonly string[];
  legacyPortraitPaths: readonly string[];
}): StorageTarget[] {
  if (!UUID_RE.test(input.userId)) throw new Error("userStorageTargets: invalid user id");
  const targets: StorageTarget[] = [];
  for (const storyId of input.storyIds) {
    if (!UUID_RE.test(storyId)) continue;
    targets.push({ bucket: "illustrations", prefix: `${storyId}/` });
    targets.push({ bucket: "showcase", prefix: `${storyId}/` });
  }
  targets.push({ bucket: "illustrations", prefix: `portraits/${input.userId}/` });
  for (const prepId of input.prepIds) {
    if (UUID_RE.test(prepId)) targets.push({ bucket: "illustrations", prefix: `character-preps/${prepId}/` });
  }
  for (const path of input.legacyPortraitPaths) {
    // portraits/{uuid}/{file} only — never a folder, never anything else.
    const seg = path.split("/");
    if (seg.length === 3 && seg[0] === "portraits" && UUID_RE.test(seg[1]) && seg[2] && !seg[2].startsWith(".")) {
      targets.push({ bucket: "illustrations", path });
    }
  }
  targets.push({ bucket: "book-pdfs", prefix: `${input.userId}/` });
  targets.push({ bucket: "child-photos", prefix: `${input.userId}/` });
  return targets;
}

// ── Guest purge selection ────────────────────────────────────────────────────

export interface GuestCandidate {
  id: string;
  is_anonymous: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface GuestSelectionInput {
  users: readonly GuestCandidate[];
  /** Latest stories.updated_at per user. */
  latestStoryUpdate: ReadonlyMap<string, string>;
  /** Users with at least one paid-ever order. */
  paidUserIds: ReadonlySet<string>;
  /** Users owning an is_showcase story (never purged automatically). */
  showcaseUserIds: ReadonlySet<string>;
}

export interface GuestSelection {
  /** Oldest activity first, at most `limit`. */
  selected: string[];
  eligible: number;
  skippedPaid: number;
  skippedShowcase: number;
  skippedActive: number;
}

const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : Number.NaN);

/** Last sign-in, account creation or story edit — whichever is latest. */
export function lastActivityMs(user: GuestCandidate, latestStory: string | undefined): number {
  const values = [ts(user.created_at), ts(user.last_sign_in_at), ts(latestStory)].filter(Number.isFinite);
  return values.length ? Math.max(...values) : Number.NaN;
}

export function selectGuestsToPurge(
  input: GuestSelectionInput,
  now: number,
  opts: { inactiveDays?: number; limit: number },
): GuestSelection {
  const cutoff = now - (opts.inactiveDays ?? GUEST_INACTIVE_DAYS) * 24 * 3_600_000;
  const result: GuestSelection = { selected: [], eligible: 0, skippedPaid: 0, skippedShowcase: 0, skippedActive: 0 };
  const eligible: Array<{ id: string; activity: number }> = [];
  for (const user of input.users) {
    if (!user.is_anonymous) continue;
    const activity = lastActivityMs(user, input.latestStoryUpdate.get(user.id));
    // Unknown activity (no dates at all) is treated as active: never delete on missing data.
    if (!Number.isFinite(activity) || activity >= cutoff) {
      result.skippedActive++;
      continue;
    }
    if (input.paidUserIds.has(user.id)) {
      result.skippedPaid++;
      continue;
    }
    if (input.showcaseUserIds.has(user.id)) {
      result.skippedShowcase++;
      continue;
    }
    eligible.push({ id: user.id, activity });
  }
  eligible.sort((a, b) => a.activity - b.activity);
  result.eligible = eligible.length;
  result.selected = eligible.slice(0, Math.max(0, opts.limit)).map((e) => e.id);
  return result;
}
