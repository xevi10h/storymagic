import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/marketing/unsubscribe-token";
import { mailSafeName } from "@/lib/email/mail-safe-name";
import { formatChildName } from "@/lib/child-name";
import { ADVENT_LOCALES } from "@/lib/advent/calendar";
import { loadOwnCharacter, verifiedAccountEmail } from "@/lib/advent/account";
import { subscribe } from "@/lib/advent/subscriptions";

/**
 * POST /api/advent/subscribe — "Ábreme la puerta cada mañana": explicit consent (the
 * unticked box) to one email a day from 1 to 24 December with that door's PDF.
 *
 * Body: { email, consent: true, locale: "es"|"ca", name, gender, characterId? }
 * Double opt-in: when the email is the signed-in account's own confirmed address the
 * subscription is active at once (and, with one of their characterId, linked to the
 * portrait); every other sign-up is pending and gets ONE plain confirmation email
 * (re-sent at most every 10 minutes). Nothing else is sent until it is confirmed.
 *
 * 200 { ok: true, state: "active" | "pending" | "already", portrait: boolean }
 * 400 invalid_input · 429 rate_limited · 503 unavailable (migration pending) · 500 failed
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().max(254),
  consent: z.literal(true),
  locale: z.enum(ADVENT_LOCALES),
  name: z.string().max(60),
  gender: z.enum(["boy", "girl", "neutral"]),
  characterId: z.string().uuid().nullish(),
});

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkMemoryRateLimit(`advent_subscribe:${clientIp}`, { maxRequests: 10, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const body = parsed.data;

  const email = normalizeEmail(body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  let childName = mailSafeName(formatChildName(body.name));
  let gender = body.gender;
  let userId: string | null = null;
  let characterId: string | null = null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const verifiedSelf = !!user && verifiedAccountEmail(user) === email;
  if (verifiedSelf && user) {
    userId = user.id;
    if (body.characterId) {
      const character = await loadOwnCharacter(user.id, body.characterId);
      if (character) {
        characterId = character.id;
        childName = mailSafeName(character.name);
        gender = character.gender;
      }
    }
  }
  if (!childName) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

  const result = await subscribe(createFulfilmentClient(), { email, childName, gender, locale: body.locale, verifiedSelf, userId, characterId });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason === "migration_pending" ? "unavailable" : "failed" }, { status: result.reason === "migration_pending" ? 503 : 500 });
  }
  return NextResponse.json({ ok: true, state: result.state, portrait: characterId !== null });
}
