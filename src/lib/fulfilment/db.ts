// Service-role Supabase client typed with the fulfilment columns added by
// supabase/migrations/20260927120000_resumable_fulfilment.sql.
//
// The generated src/lib/database.types.ts predates that migration; once it is
// regenerated (`supabase gen types`), FulfilmentDatabase collapses to Database and
// this overlay can be deleted. (Column sets are `type` aliases, not interfaces:
// supabase-js requires Row types assignable to Record<string, unknown>.)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type PublicSchema = Database["public"];
type Tables = PublicSchema["Tables"];

type WithColumns<T extends { Row: object; Insert: object; Update: object }, C extends object> = Omit<
  T,
  "Row" | "Insert" | "Update"
> & {
  Row: T["Row"] & C;
  Insert: T["Insert"] & Partial<C>;
  Update: T["Update"] & Partial<C>;
};

export type IllustrationFulfilmentColumns = {
  render_stage: string | null;
  rendered_at: string | null;
};

export type StoryFulfilmentColumns = {
  completion_lease_until: string | null;
  completion_lease_owner: string | null;
  completion_attempts: number;
  completion_next_attempt_at: string | null;
  completion_last_error: string | null;
  final_qa_pass: number;
  final_qa_done_at: string | null;
  final_generated_at: string | null;
  // 20261003200655_funnel_and_preview_reminders.sql (set by a trigger; the app only reads them)
  generation_started_at: string | null;
  preview_ready_at: string | null;
};

// 20261003200655_funnel_and_preview_reminders.sql
export type PreviewReminderRow = {
  id: string;
  story_id: string;
  email: string;
  locale: string;
  consent_at: string;
  consent_version: string;
  consent_source: string;
  /** Last reminder sent: 0 none, 1 = 1 h, 2 = 24 h, 3 = 72 h. */
  stage: number;
  last_sent_at: string | null;
  stopped_at: string | null;
  stop_reason: "purchased" | "unsubscribed" | "expired" | "story_unavailable" | null;
  created_at: string;
  updated_at: string;
};

export type OrderFulfilmentColumns = {
  customer_email: string | null;
  confirmation_email_sent_at: string | null;
  ready_email_sent_at: string | null;
  print_interior_path: string | null;
  print_cover_path: string | null;
  print_files_validated_at: string | null;
  gelato_submit_attempts: number;
  gelato_submit_started_at: string | null;
  gelato_next_attempt_at: string | null;
  gelato_last_error: string | null;
  gelato_status: string | null;
  fulfilment_alerted_at: string | null;
  // 20260928120000_commerce_ready.sql
  download_token: string;
  withdrawal_consent_at: string | null;
  withdrawal_consent_version: string | null;
  stripe_invoice_id: string | null;
  invoice_url: string | null;
  refunded_at: string | null;
  // 20260930140000_order_notifications.sql
  refund_email_sent_at: string | null;
  cancel_email_sent_at: string | null;
  delay_email_sent_at: string | null;
  problem_email_sent_at: string | null;
  excluded_area_email_sent_at: string | null;
  tracking_email_sent_at: string | null;
  disputed_at: string | null;
  fulfilment_hold_reason: string | null;
  // 20260930150000_admin_and_retention.sql
  fulfilment_requeued_at: string | null;
  gelato_reprint_count: number;
  // 20260930155000_upsell_offers.sql
  offer: "pdf_upgrade" | "extra_copy_repeat" | null;
  offer_source_order_id: string | null;
  // 20260930156000_marketing_email.sql (null = ordered before the opt-out existed)
  marketing_opt_out: boolean | null;
  upsell_reminder_sent_at: string | null;
};

export type FulfilmentDatabase = Omit<Database, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<Tables, "orders" | "stories" | "story_illustrations"> & {
      orders: WithColumns<Tables["orders"], OrderFulfilmentColumns>;
      stories: WithColumns<Tables["stories"], StoryFulfilmentColumns>;
      story_illustrations: WithColumns<Tables["story_illustrations"], IllustrationFulfilmentColumns>;
      // 20260930170000_daily_preview_cap.sql
      daily_preview_counts: {
        Row: { day: string; count: number; updated_at: string };
        Insert: { day: string; count?: number; updated_at?: string };
        Update: { day?: string; count?: number; updated_at?: string };
        Relationships: [];
      };
      preview_reminders: {
        Row: PreviewReminderRow;
        Insert: Pick<PreviewReminderRow, "story_id" | "email" | "consent_version"> & Partial<PreviewReminderRow>;
        Update: Partial<PreviewReminderRow>;
        Relationships: [];
      };
      // 20260930156000_marketing_email.sql
      email_suppressions: {
        Row: { id: string; email: string; reason: "unsubscribed" | "checkout_opt_out"; source: string | null; created_at: string };
        Insert: { id?: string; email: string; reason: "unsubscribed" | "checkout_opt_out"; source?: string | null; created_at?: string };
        Update: { id?: string; email?: string; reason?: "unsubscribed" | "checkout_opt_out"; source?: string | null; created_at?: string };
        Relationships: [];
      };
    };
    Functions: PublicSchema["Functions"] & {
      claim_ops_alert: { Args: { p_key: string; p_window_seconds: number }; Returns: boolean };
      claim_daily_preview: { Args: { p_day: string; p_cap: number }; Returns: number | null };
    };
  };
};

export type FulfilmentClient = SupabaseClient<FulfilmentDatabase>;

export function createFulfilmentClient(): FulfilmentClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service config");
  return createClient<FulfilmentDatabase>(url, serviceKey);
}
