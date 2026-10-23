import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { creatorByEmail, getCreatorPanel, requestCreatorPayout, spendCreatorCredit } from "@/lib/growth/creators";

// Creator panel (invite-only, src/lib/growth/creators.ts). The creator is the verified,
// non-anonymous user whose login email an operator registered. Everyone else gets
// { creator: null } (GET) or 404 (POST). Service role + that email filter: the tables
// have no client grants.

const NO_STORE = { "Cache-Control": "private, no-store" };

async function currentCreator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous || !user.email_confirmed_at) return { user, creator: null };
  const db = createFulfilmentClient();
  return { user, creator: await creatorByEmail(db, user.email), db };
}

export async function GET() {
  try {
    const { user, creator, db } = await currentCreator();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!creator || !db) return NextResponse.json({ creator: null }, { headers: NO_STORE });
    return NextResponse.json(await getCreatorPanel(db, creator), { headers: NO_STORE });
  } catch (err) {
    console.error("[creator] Panel failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load creator panel" }, { status: 500 });
  }
}

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("payout"),
    /** New per form opening (crypto.randomUUID()): a double click resends the same key. */
    requestKey: z.uuid(),
    /** The whole available balance the panel showed. */
    amountCents: z.number().int().positive(),
    iban: z.string().max(64),
    holderName: z.string().max(200),
    taxId: z.string().max(32),
  }),
  z.object({
    action: z.literal("credit"),
    requestKey: z.uuid(),
    /** Balance to spend (X); the code is worth 2X. */
    amountCents: z.number().int().positive(),
  }),
]);

export async function POST(request: Request) {
  try {
    const { user, creator, db } = await currentCreator();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!creator || !db) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const body = parsed.data;

    const result =
      body.action === "payout" ? await requestCreatorPayout(db, creator, body) : await spendCreatorCredit(db, creator, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.error === "insufficient_balance" ? 409 : 400 });
    }
    return NextResponse.json(await getCreatorPanel(db, creator), { headers: NO_STORE });
  } catch (err) {
    console.error("[creator] Withdrawal failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Withdrawal failed" }, { status: 500 });
  }
}
