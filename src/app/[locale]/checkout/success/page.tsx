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
}

// Stripe Checkout Session IDs look like cs_test_… / cs_live_…
const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

/**
 * Server-side payment verification: the success URL alone proves nothing
 * (anyone can type ?session_id=whatever). Only a Stripe session that is
 * complete, paid (or fully discounted) and created by our checkout
 * (metadata.story_id) renders the success state.
 */
async function verifySession(sessionId: string | null, viewerId: string | null): Promise<VerifiedSession> {
  const unverified = { verified: false, customerEmail: null, format: null };
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) return unverified;

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paid =
      session.status === "complete" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    if (!paid || !session.metadata?.story_id) return unverified;

    // The session id travels in the URL (history, shared links): only the buyer's
    // own session gets to see the email address it was paid with.
    const ownsSession = !!viewerId && session.metadata.user_id === viewerId;
    return {
      verified: true,
      customerEmail: ownsSession ? (session.customer_details?.email ?? session.customer_email ?? null) : null,
      format: session.metadata?.format ?? null,
    };
  } catch (err) {
    console.error("[checkout/success] Stripe session verification failed:", err);
    return unverified;
  }
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;
  const sessionId = typeof session_id === "string" ? session_id : null;

  let viewer: { id: string; is_anonymous?: boolean } | null = null;
  try {
    const supabase = await createClient();
    viewer = (await supabase.auth.getUser()).data.user;
  } catch {
    viewer = null;
  }
  const isGuest = !viewer || viewer.is_anonymous === true;
  const session = await verifySession(sessionId, viewer?.id ?? null);

  return (
    <SuccessClient
      sessionId={sessionId}
      verified={session.verified}
      customerEmail={session.customerEmail}
      format={session.format}
      isGuest={isGuest}
    />
  );
}
