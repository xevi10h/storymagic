import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import SuccessClient from "./SuccessClient";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

interface VerifiedSession {
  verified: boolean;
  customerEmail: string | null;
  format: string | null;
  /** For the ad Purchase event (Meta Pixel). */
  value: number | null;
  currency: string | null;
}

// Stripe Checkout Session IDs look like cs_test_… / cs_live_…
const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

/**
 * Server-side payment verification: the success URL alone proves nothing
 * (anyone can type ?session_id=whatever). Only a Stripe session that is
 * complete, paid (or fully discounted) and created by our checkout
 * (metadata.story_id) renders the success state.
 */
async function verifySession(sessionId: string | null): Promise<VerifiedSession> {
  const unverified = { verified: false, customerEmail: null, format: null, value: null, currency: null };
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) return unverified;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid =
      session.status === "complete" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    if (!paid || !session.metadata?.story_id) return unverified;

    return {
      verified: true,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      format: session.metadata?.format ?? null,
      value: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? "eur").toUpperCase(),
    };
  } catch (err) {
    console.error("[checkout/success] Stripe session verification failed:", err);
    return unverified;
  }
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  const sessionId = typeof session_id === "string" ? session_id : null;

  const [session, isGuest] = await Promise.all([
    verifySession(sessionId),
    (async () => {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return !user || user.is_anonymous === true;
      } catch {
        return true;
      }
    })(),
  ]);

  return (
    <SuccessClient
      sessionId={sessionId}
      verified={session.verified}
      customerEmail={session.customerEmail}
      format={session.format}
      purchaseValue={session.value}
      purchaseCurrency={session.currency}
      isGuest={isGuest}
    />
  );
}
