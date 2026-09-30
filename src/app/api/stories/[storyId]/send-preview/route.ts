import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMemoryRateLimit, checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { escapeHtml, renderEmailLayout } from "@/lib/email/layout";
import { SHAREABLE_STORY_STATUSES, createPreviewShareToken, previewShareUrl } from "@/lib/share/preview-share-token";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["es", "ca", "en", "fr"]).default("es"),
});

/**
 * The child's name as it may appear in a mail we send to an arbitrary address:
 * letters, combining marks, spaces, hyphens and apostrophes only (no dots, slashes,
 * digits or symbols, so it cannot carry a URL or a spam message), max 40 chars.
 */
function mailSafeName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\s'’-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();
}

const COPY = {
  es: {
    subject: (n: string) => `La vista previa del libro de ${n}`,
    heading: (n: string) => `El libro de ${n} te espera`,
    body: "Aquí tienes el enlace a la vista previa de su libro para verlo con calma. Funciona en cualquier móvil u ordenador, y puedes reenviarlo a quien quieras. Caduca en 30 días.",
    cta: "Ver su libro",
    signoff: "Un abrazo,\nMeapica",
  },
  ca: {
    subject: (n: string) => `La vista prèvia del llibre de ${n}`,
    heading: (n: string) => `El llibre de ${n} t'espera`,
    body: "Aquí tens l'enllaç a la vista prèvia del seu llibre per mirar-lo amb calma. Funciona a qualsevol mòbil o ordinador, i el pots reenviar a qui vulguis. Caduca d'aquí a 30 dies.",
    cta: "Veure el seu llibre",
    signoff: "Una abraçada,\nMeapica",
  },
  en: {
    subject: (n: string) => `${n}'s book preview`,
    heading: (n: string) => `${n}'s book is waiting for you`,
    body: "Here is the link to the book preview so you can look at it calmly. It works on any phone or computer, and you can forward it to anyone you like. It expires in 30 days.",
    cta: "See the book",
    signoff: "Warmly,\nMeapica",
  },
  fr: {
    subject: (n: string) => `L'aperçu du livre de ${n}`,
    heading: (n: string) => `Le livre de ${n} vous attend`,
    body: "Voici le lien vers l'aperçu du livre, pour le regarder tranquillement. Il fonctionne sur n'importe quel téléphone ou ordinateur, et vous pouvez le transférer à qui vous voulez. Il expire dans 30 jours.",
    cta: "Voir le livre",
    signoff: "Bien à vous,\nMeapica",
  },
} as const;

/**
 * "Envíame la vista previa" — optional, offered only after the parent has seen the
 * book (never a gate). Sends the preview link to the given address; the address
 * is not stored or subscribed to anything. The link is the read-only share link
 * (/[locale]/preview/[token]): it opens in any browser, incl. mail apps' in-app ones.
 */
export async function POST(request: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  if (!UUID_RE.test(storyId)) {
    return NextResponse.json({ error: "invalid_story_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const { email, locale } = parsed.data;

  const { data: story } = await supabase
    .from("stories")
    .select("id, status, characters(name)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();
  if (!story || !(SHAREABLE_STORY_STATUSES as readonly string[]).includes(story.status)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const characters = story.characters as { name: string } | { name: string }[] | null;
  const rawName = mailSafeName((Array.isArray(characters) ? characters[0]?.name : characters?.name) ?? "");
  if (!rawName) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Anti-relay: per IP (per instance, cheap first), per sender account, per recipient
  // (durable, 24 h — throwaway guest accounts cannot aim it at one inbox).
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkMemoryRateLimit(`send_preview:${clientIp}`, { maxRequests: 10, windowSeconds: 3600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const rl = await checkRateLimit(user.id, "send_preview");
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const rlRecipient = await checkRateLimit(rateLimitSubject(`send_preview_to:${email}`), "send_preview_recipient");
  if (!rlRecipient.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const name = escapeHtml(rawName);
  const copy = COPY[locale];
  const url = previewShareUrl(getSiteUrl(), locale, createPreviewShareToken(story.id).token);

  const ok = await sendEmail({
    to: email,
    subject: copy.subject(rawName),
    html: renderEmailLayout({
      heading: copy.heading(name),
      paragraphs: [copy.body],
      cta: { label: copy.cta, url },
      signoff: copy.signoff,
      lang: locale,
    }),
    text: `${copy.heading(rawName)}\n\n${copy.body}\n\n${url}\n\n${copy.signoff}`,
  });

  if (!ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
