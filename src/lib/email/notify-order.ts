// Order-lifecycle notifier: loads recipient context from Supabase and sends the
// matching localized email. Used by the Stripe webhook (order_confirmed) and the
// Gelato webhook (in_production / shipped / delivered).
//
// Recipient resolution order: explicit `email` → orders.customer_email (the Stripe
// Checkout email; the only address guests have, since they are anonymous auth
// users) → the auth user's email via the service-role admin API. Sending is
// best-effort and never throws — a failed email must not break webhook processing.

import { sendEmail } from "./send";
import { buildOrderEmail, type OrderEmailEvent } from "./order-emails";
import type { GeneratedStory } from "@/lib/ai/story-generator";

export interface NotifyOrderParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any; // service-role client (for the auth.admin lookup) OR user-scoped when `email` is given
  event: OrderEmailEvent;
  storyId: string;
  userId: string;
  /**
   * Pre-resolved recipient email. When provided, the auth.admin lookup is skipped —
   * required when `supabase` is a user-scoped client without service-role admin access.
   */
  email?: string | null;
  /** Order to read `customer_email` from (service-role client required). */
  orderId?: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  /** book_ready: view/download link */
  downloadUrl?: string | null;
  /** book_ready: physical order (copy mentions the printed edition) */
  isPhysical?: boolean;
  /** order_confirmed*: Stripe hosted invoice (factura) */
  invoiceUrl?: string | null;
}

/**
 * Resolve the customer's email + story details and send the lifecycle email.
 * Returns true if an email was sent, false otherwise. Never throws.
 */
export async function notifyOrderEmail(params: NotifyOrderParams): Promise<boolean> {
  const { supabase, event, storyId, userId } = params;

  try {
    // 1. Recipient email — pre-resolved address, else the order's checkout email,
    //    else the auth user (requires a service-role client with auth.admin access).
    let email: string | undefined = params.email?.trim() || undefined;
    if (!email && params.orderId) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("customer_email")
        .eq("id", params.orderId)
        .maybeSingle();
      if (orderErr) console.warn(`[email] Could not read customer_email for order ${params.orderId}: ${orderErr.message}`);
      email = (order?.customer_email as string | null | undefined)?.trim() || undefined;
    }
    if (!email) {
      const { data: userResult, error: userErr } = await supabase.auth.admin.getUserById(userId);
      email = userResult?.user?.email;
      if (userErr || !email) {
        console.warn(`[email] No recipient email for user ${userId} (order event ${event})`);
        return false;
      }
    }

    // 2. Story details — title, locale, child name
    const { data: story } = await supabase
      .from("stories")
      .select("title, locale, generated_text, characters(name)")
      .eq("id", storyId)
      .single();

    if (!story) {
      console.warn(`[email] Story ${storyId} not found for order event ${event}`);
      return false;
    }

    const generated = story.generated_text as unknown as GeneratedStory | null;
    const bookTitle =
      (story.title as string | null) || generated?.bookTitle || "tu cuento personalizado";

    // characters can come back as object or array depending on the relation shape
    const charactersRel = story.characters as { name?: string } | { name?: string }[] | null;
    const childName = Array.isArray(charactersRel)
      ? charactersRel[0]?.name ?? ""
      : charactersRel?.name ?? "";

    const built = buildOrderEmail(event, {
      locale: (story.locale as string) || "es",
      childName,
      bookTitle,
      trackingNumber: params.trackingNumber,
      trackingUrl: params.trackingUrl,
      downloadUrl: params.downloadUrl,
      isPhysical: params.isPhysical,
      invoiceUrl: params.invoiceUrl,
    });

    const ok = await sendEmail({ to: email, subject: built.subject, html: built.html, text: built.text });
    if (ok) console.log(`[email] Sent "${event}" to ${email} for story ${storyId}`);
    return ok;
  } catch (err) {
    console.error(`[email] notifyOrderEmail failed (event ${event}, story ${storyId}):`, err);
    return false;
  }
}
