import { NextResponse, type NextRequest } from "next/server";
import { createFulfilmentClient, type FulfilmentClient } from "@/lib/fulfilment/db";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { reyesReminderWindow, spainToday } from "@/lib/shipping";

/**
 * Where a subscription was given (newsletter_subscribers.source): the footer reading
 * club, or the "Avísame antes de la fecha límite de Reyes" opt-in of the free Reyes
 * printables (/tools/*), which consents to that reminder only.
 */
const SOURCES = ["footer", "reyes_reminder"] as const;
const LOCALES = ["es", "ca", "en", "fr"] as const;

export async function POST(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  // Best-effort per-instance guard against scripted sign-ups (src/lib/rate-limit.ts).
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkMemoryRateLimit(`newsletter:${clientIp}`, { maxRequests: 10, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let email: string;
  let source: (typeof SOURCES)[number] | null = null;
  let locale: (typeof LOCALES)[number] | null = null;
  try {
    const body = await request.json();
    email = body.email?.trim().toLowerCase();
    if (SOURCES.includes(body.source)) source = body.source;
    if (LOCALES.includes(body.locale)) locale = body.locale;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createFulfilmentClient();

  const { error } = source === "reyes_reminder" ? await recordReyesConsent(supabase, email, locale) : await upsertSubscriber(supabase, email, source, locale);

  if (error) {
    console.error("[newsletter] Supabase error:", error.code ?? error.message);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Upsert to avoid duplicates — if email exists, just update subscribed_at
// (and the source/locale of this latest consent, when the caller sends them).
function upsertSubscriber(supabase: FulfilmentClient, email: string, source: string | null, locale: string | null) {
  return supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, subscribed_at: new Date().toISOString(), ...(source ? { source } : {}), ...(locale ? { locale } : {}) },
      { onConflict: "email" },
    );
}

/**
 * The Reyes reminder consent has its own column (migration 20261022120000): an existing
 * row keeps its source (e.g. the footer newsletter consent) and only gains this one. A
 * reminder already sent for a past Reyes is released so this season's can go out.
 */
async function recordReyesConsent(supabase: FulfilmentClient, email: string, locale: string | null) {
  const now = new Date().toISOString();
  const inserted = await supabase
    .from("newsletter_subscribers")
    .insert({ email, subscribed_at: now, source: "reyes_reminder", reyes_reminder_consent_at: now, ...(locale ? { locale } : {}) });
  if (inserted.error?.code !== "23505") return inserted;
  const updated = await supabase.from("newsletter_subscribers").update({ reyes_reminder_consent_at: now }).eq("email", email);
  if (updated.error) return updated;
  return supabase
    .from("newsletter_subscribers")
    .update({ reyes_reminder_sent_at: null })
    .eq("email", email)
    .lt("reyes_reminder_sent_at", reyesReminderWindow(spainToday()).seasonStart);
}
