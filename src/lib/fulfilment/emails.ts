// Exactly-once order emails, claimed through a timestamp column on the order.
// Lightweight on purpose (no PDF/AI imports) so webhooks can use it.

import { notifyOrderEmail } from "@/lib/email/notify-order";
import type { OrderEmailEvent } from "@/lib/email/order-emails";
import type { FulfilmentClient, FulfilmentDatabase } from "./db";

type OrderRow = FulfilmentDatabase["public"]["Tables"]["orders"]["Row"];

/**
 * Claim an order email column (exactly-once across concurrent callers) and send.
 * The claim is released if the send fails so a later run can retry.
 */
export async function sendOrderEmailOnce(
  supabase: FulfilmentClient,
  params: {
    order: Pick<OrderRow, "id" | "story_id" | "user_id">;
    column: "confirmation_email_sent_at" | "ready_email_sent_at";
    event: OrderEmailEvent;
    email?: string | null;
    downloadUrl?: string;
    isPhysical?: boolean;
  },
): Promise<boolean> {
  const { order, column } = params;
  const { data: claimed, error } = await supabase
    .from("orders")
    .update({ [column]: new Date().toISOString() })
    .eq("id", order.id)
    .is(column, null)
    .select("id");
  if (error) {
    console.error(`[fulfilment] Could not claim ${column} for order ${order.id}:`, error.message);
    return false;
  }
  if (!claimed || claimed.length === 0) return false; // already sent

  const sent = await notifyOrderEmail({
    supabase,
    event: params.event,
    storyId: order.story_id,
    userId: order.user_id,
    orderId: order.id,
    email: params.email,
    downloadUrl: params.downloadUrl,
    isPhysical: params.isPhysical,
  });
  if (!sent) {
    await supabase.from("orders").update({ [column]: null }).eq("id", order.id);
  }
  return sent;
}
