// Operator panel data access — SERVER ONLY (service role). Callers must have passed
// the operator gate (src/lib/admin/auth.ts) first.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdminOrderRow } from "./orders-view";

/**
 * Untyped service-role client: the panel reads tables the generated
 * database.types.ts does not know yet (order_status_history, admin_audit_log,
 * fulfilment_requeued_at…). Rows are mapped onto explicit interfaces below.
 */
export function adminServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service config");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** How many recent orders the list loads (filtering/search run on these, newest first). */
export const ADMIN_LIST_LIMIT = 1000;

const LIST_COLUMNS =
  "id, created_at, status, format, total, currency, customer_email, shipping_name, story_id, user_id, gelato_order_id, gelato_status, gelato_last_error, gelato_submit_attempts, fulfilment_alerted_at, stripe_payment_id, stripe_checkout_session_id, tracking_number, refunded_at";

type StoryJoin = { title: string | null; characters: { name: string | null } | { name: string | null }[] | null } | null;

function childNameOf(story: StoryJoin): string | null {
  const rel = story?.characters;
  const c = Array.isArray(rel) ? rel[0] : rel;
  return c?.name ?? null;
}

type RawOrder = Omit<AdminOrderRow, "story_title" | "child_name"> & { stories: StoryJoin | StoryJoin[] };

function toAdminRow(raw: RawOrder): AdminOrderRow {
  const story = Array.isArray(raw.stories) ? raw.stories[0] ?? null : raw.stories;
  const rest: Omit<RawOrder, "stories"> & { stories?: unknown } = { ...raw };
  delete rest.stories;
  return { ...rest, story_title: story?.title ?? null, child_name: childNameOf(story) };
}

export async function listAdminOrders(): Promise<{ rows: AdminOrderRow[]; truncated: boolean; error: string | null; fetchedAt: number }> {
  const fetchedAt = Date.now();
  const supabase = adminServiceClient();
  const run = (cols: string) =>
    supabase
      .from("orders")
      .select(`${cols}, stories(title, characters(name))`)
      .order("created_at", { ascending: false })
      .limit(ADMIN_LIST_LIMIT);
  let { data, error } = await run(`${LIST_COLUMNS}, fulfilment_requeued_at, fulfilment_hold_reason, offer`);
  if (error?.code === "42703") ({ data, error } = await run(LIST_COLUMNS)); // migration not applied yet
  if (error) return { rows: [], truncated: false, error: error.message, fetchedAt };
  const rows = ((data ?? []) as unknown as RawOrder[]).map(toAdminRow);
  return { rows, truncated: rows.length >= ADMIN_LIST_LIMIT, error: null, fetchedAt };
}

export interface StatusHistoryEntry {
  from_status: string | null;
  to_status: string;
  gelato_status: string | null;
  changed_at: string;
}

export interface AuditEntry {
  created_at: string;
  actor_email: string;
  action: string;
  ok: boolean;
  details: Record<string, unknown>;
}

export interface AdminOrderDetail {
  order: Record<string, unknown> & AdminOrderRow;
  story: {
    id: string;
    status: string;
    title: string | null;
    locale: string | null;
    completion_attempts: number | null;
    completion_last_error: string | null;
    completion_next_attempt_at: string | null;
    final_generated_at: string | null;
    pdf_url: string | null;
    is_showcase: boolean | null;
  } | null;
  history: StatusHistoryEntry[] | null; // null = table not available (migration pending)
  audit: AuditEntry[] | null;
  /** Reference time for age-based problem flags. */
  fetchedAt: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  if (!UUID_RE.test(orderId)) return null;
  const supabase = adminServiceClient();
  const { data: raw, error } = await supabase
    .from("orders")
    .select("*, stories(title, characters(name))")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read order ${orderId}: ${error.message}`);
  if (!raw) return null;
  const order = toAdminRow(raw as unknown as RawOrder) as AdminOrderDetail["order"];

  const [storyRes, historyRes, auditRes] = await Promise.all([
    order.story_id
      ? supabase
          .from("stories")
          .select(
            "id, status, title, locale, completion_attempts, completion_last_error, completion_next_attempt_at, final_generated_at, pdf_url, is_showcase",
          )
          .eq("id", order.story_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("order_status_history")
      .select("from_status, to_status, gelato_status, changed_at")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: true })
      .limit(200),
    supabase
      .from("admin_audit_log")
      .select("created_at, actor_email, action, ok, details")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return {
    fetchedAt: Date.now(),
    order,
    story: (storyRes.data as AdminOrderDetail["story"]) ?? null,
    history: historyRes.error ? null : ((historyRes.data ?? []) as StatusHistoryEntry[]),
    audit: auditRes.error ? null : ((auditRes.data ?? []) as AuditEntry[]),
  };
}
