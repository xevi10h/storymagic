// Order-lifecycle notifier: loads recipient context from Supabase and sends the
// matching localized email. Used by the Stripe webhook (order_confirmed) and the
// Gelato webhook (in_production / shipped / delivered).
//
// Recipient resolution order: explicit `email` → orders.customer_email (the Stripe
// Checkout email; the only address guests have, since they are anonymous auth
// users) → the auth user's email via the service-role admin API. Sending is
// best-effort and never throws — a failed email must not break webhook processing.
//
// Greeting: the recipient is the adult who paid. Buyer name resolution order: the
// account name (auth user_metadata.full_name, kept in sync with profiles.name) →
// the name given at Stripe Checkout (passed in on confirmation, else read once
// from the order's Checkout Session) → none (neutral "Hola,").

import { sendEmail } from "./send";
import { buildOrderEmail, orderReference, type OrderEmailEvent, type OrderReceipt } from "./order-emails";
import type { GeneratedStory } from "@/lib/ai/story-generator";
import { getStripe, isPdfUpgradeAvailable } from "@/lib/stripe";
import { upsellForStory, type UpsellOffer, type UpsellOrderRow } from "@/lib/upsell";
import { mayReceiveOffers, unsubscribeLinks } from "@/lib/marketing/suppression";

export interface NotifyOrderParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any; // service-role client: stories.generated_text is not readable with a user session (20260930180000)
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
  /** Name given at Stripe Checkout (customer_details.name), when the caller has it */
  buyerName?: string | null;
  /** order_confirmed*: receipt block (built from the paid Checkout Session) */
  receipt?: OrderReceipt | null;
  /** refund_issued: amount refunded (cents) + whether the order was stopped before shipping */
  amountCents?: number | null;
  cancelledBeforeShipping?: boolean;
  /** print_problem: what Gelato reported */
  problemKind?: "failed" | "returned" | null;
  /** excluded_area: the postcode */
  postcode?: string | null;
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
    let checkoutSessionId: string | null = null;
    // Unknown (no order read) = never commercial content.
    let marketingOptOut: boolean | null = null;
    if (params.orderId) {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("customer_email, stripe_checkout_session_id, marketing_opt_out")
        .eq("id", params.orderId)
        .maybeSingle();
      if (orderErr) console.warn(`[email] Could not read order ${params.orderId}: ${orderErr.message}`);
      if (!email) email = (order?.customer_email as string | null | undefined)?.trim() || undefined;
      checkoutSessionId = (order?.stripe_checkout_session_id as string | null | undefined) ?? null;
      marketingOptOut = (order?.marketing_opt_out as boolean | null | undefined) ?? null;
    }
    const authUser = await readAuthUser(supabase, userId);
    if (!email) {
      email = authUser?.email;
      if (!email) {
        console.warn(`[email] No recipient email for user ${userId} (order event ${event})`);
        return false;
      }
    }

    const buyerName =
      (authUser?.user_metadata?.full_name as string | undefined)?.trim() ||
      params.buyerName?.trim() ||
      (await checkoutBuyerName(checkoutSessionId));

    // 2. Story details — title, locale, child name
    const story = await loadStoryEmailContext(supabase, storyId);
    if (!story) {
      console.warn(`[email] Story ${storyId} not found for order event ${event}`);
      return false;
    }
    const { bookTitle, childName, locale } = story;

    // 3. Commercial block (offer): only for recipients who may receive offers, and
    //    always with its unsubscribe link (LSSI 21.2). The transactional part is sent
    //    regardless.
    let upsell: Awaited<ReturnType<typeof resolveUpsell>> = null;
    let unsubscribe: ReturnType<typeof unsubscribeLinks> = null;
    if (offerEventFor(event, params.isPhysical) && (await mayReceiveOffers(supabase, { marketing_opt_out: marketingOptOut }, email))) {
      upsell = await resolveUpsell(supabase, event, { userId, storyId, isPhysical: params.isPhysical });
      if (upsell) unsubscribe = unsubscribeLinks(email, locale);
    }

    const built = buildOrderEmail(event, {
      locale,
      buyerName,
      childName,
      bookTitle,
      trackingNumber: params.trackingNumber,
      trackingUrl: params.trackingUrl,
      downloadUrl: params.downloadUrl,
      isPhysical: params.isPhysical,
      receipt: params.receipt,
      reference: params.orderId ? orderReference(params.orderId) : null,
      amountCents: params.amountCents,
      cancelledBeforeShipping: params.cancelledBeforeShipping,
      problemKind: params.problemKind,
      postcode: params.postcode,
      recipientEmail: email,
      upsell,
      unsubscribeUrl: unsubscribe?.pageUrl ?? null,
    });

    const ok = await sendEmail({
      to: email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      headers: built.commercial && unsubscribe ? unsubscribe.headers : undefined,
    });
    if (ok) console.log(`[email] Sent "${event}" to ${email} for story ${storyId}`);
    return ok;
  } catch (err) {
    console.error(`[email] notifyOrderEmail failed (event ${event}, story ${storyId}):`, err);
    return false;
  }
}

/** The offer an event's email may carry (book_ready of a PDF order / delivered), or null. */
function offerEventFor(event: OrderEmailEvent, isPhysical: boolean | undefined): UpsellOffer | null {
  return event === "book_ready" && !isPhysical ? "pdf_upgrade" : event === "delivered" ? "extra_copy_repeat" : null;
}

export interface StoryEmailContext {
  bookTitle: string;
  childName: string;
  locale: string;
}

/** Title, protagonist name and locale of a story for an email (service-role client). */
export async function loadStoryEmailContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  storyId: string,
): Promise<StoryEmailContext | null> {
  const { data: story } = await supabase
    .from("stories")
    .select("title, locale, generated_text, characters(name)")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return null;
  const generated = story.generated_text as unknown as GeneratedStory | null;
  const bookTitle = (story.title as string | null) || generated?.bookTitle || "tu cuento personalizado";
  // characters can come back as object or array depending on the relation shape
  const charactersRel = story.characters as { name?: string } | { name?: string }[] | null;
  const childName = Array.isArray(charactersRel) ? charactersRel[0]?.name ?? "" : charactersRel?.name ?? "";
  return { bookTitle, childName, locale: (story.locale as string) || "es" };
}

/** Greeting name: account name → name given at Checkout → none. Best-effort. */
export async function resolveBuyerName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  checkoutSessionId: string | null,
): Promise<string | null> {
  const authUser = await readAuthUser(supabase, userId);
  return (authUser?.user_metadata?.full_name as string | undefined)?.trim() || (await checkoutBuyerName(checkoutSessionId));
}

/**
 * Post-purchase offer for the lifecycle emails that carry one: book_ready of a PDF
 * order → PDF upgrade; delivered → extra copy within its 60 days. Same decision as
 * /api/checkout (src/lib/upsell.ts). The caller has already checked that the
 * recipient may receive offers. Best-effort: any error means no block.
 */
async function resolveUpsell(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  event: OrderEmailEvent,
  ctx: { userId: string; storyId: string; isPhysical?: boolean },
): Promise<{ offer: UpsellOffer; expiresAt: string | null } | null> {
  const wanted = offerEventFor(event, ctx.isPhysical);
  if (!wanted) return null;
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, user_id, story_id, format, status, refunded_at, created_at, offer")
      .eq("user_id", ctx.userId)
      .eq("story_id", ctx.storyId);
    if (error) {
      console.warn(`[email] Offer lookup failed for story ${ctx.storyId}: ${error.message}`);
      return null;
    }
    const upgradeAvailable = wanted === "pdf_upgrade" ? await isPdfUpgradeAvailable() : false;
    const u = upsellForStory((data ?? []) as UpsellOrderRow[], {
      userId: ctx.userId,
      storyId: ctx.storyId,
      now: Date.now(),
      upgradeAvailable,
    });
    return u && u.offer === wanted ? { offer: u.offer, expiresAt: u.expiresAt } : null;
  } catch (err) {
    console.warn(`[email] Offer lookup failed for story ${ctx.storyId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Buyer name from the order's Checkout Session (guests have no account name). Best-effort. */
async function checkoutBuyerName(sessionId: string | null): Promise<string | null> {
  if (!sessionId) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    return session.customer_details?.name?.trim() || null;
  } catch (err) {
    console.warn(`[email] Could not read buyer name from session ${sessionId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Auth user (email + account name) via the service-role admin API. Best-effort. */
async function readAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ email?: string; user_metadata?: Record<string, unknown> } | null> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) console.warn(`[email] Could not read user ${userId}: ${error.message}`);
    return data?.user ?? null;
  } catch (err) {
    console.warn(`[email] Could not read user ${userId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
