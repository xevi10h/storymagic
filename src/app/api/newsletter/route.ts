import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkMemoryRateLimit } from "@/lib/rate-limit";

/**
 * Where a subscription was given (newsletter_subscribers.source): the footer reading
 * club, or the "Avísame antes de la fecha límite de Reyes" opt-in of the free Reyes
 * printables (/tools/*), which consents to that reminder only.
 */
const SOURCES = ["footer", "reyes_reminder"] as const;
const LOCALES = ["es", "ca", "en", "fr"] as const;

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
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

  const supabase = createClient(url, key);

  // Upsert to avoid duplicates — if email exists, just update subscribed_at
  // (and the source/locale of this latest consent, when the caller sends them).
  const { error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      { email, subscribed_at: new Date().toISOString(), ...(source ? { source } : {}), ...(locale ? { locale } : {}) },
      { onConflict: "email" },
    );

  if (error) {
    console.error("[newsletter] Supabase error:", error.code ?? error.message);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
