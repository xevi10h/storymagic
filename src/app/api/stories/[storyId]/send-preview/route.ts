import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { escapeHtml, renderEmailLayout } from "@/lib/email/layout";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["es", "ca", "en", "fr"]).default("es"),
});

const COPY = {
  es: {
    subject: (n: string) => `La preview del libro de ${n}`,
    heading: (n: string) => `El libro de ${n} te espera`,
    body: "Aquí tienes el enlace a la preview de su libro para verlo con calma. Ábrelo en el mismo navegador donde lo creaste.",
    cta: "Ver su libro",
    signoff: "Un abrazo,\nMeapica",
  },
  ca: {
    subject: (n: string) => `La preview del llibre de ${n}`,
    heading: (n: string) => `El llibre de ${n} t'espera`,
    body: "Aquí tens l'enllaç a la preview del seu llibre per mirar-lo amb calma. Obre'l al mateix navegador on el vas crear.",
    cta: "Veure el seu llibre",
    signoff: "Una abraçada,\nMeapica",
  },
  en: {
    subject: (n: string) => `${n}'s book preview`,
    heading: (n: string) => `${n}'s book is waiting for you`,
    body: "Here is the link to the book preview so you can look at it calmly. Open it in the same browser you created it in.",
    cta: "See the book",
    signoff: "Warmly,\nMeapica",
  },
  fr: {
    subject: (n: string) => `L'aperçu du livre de ${n}`,
    heading: (n: string) => `Le livre de ${n} vous attend`,
    body: "Voici le lien vers l'aperçu du livre, pour le regarder tranquillement. Ouvrez-le dans le navigateur où vous l'avez créé.",
    cta: "Voir le livre",
    signoff: "Bien à vous,\nMeapica",
  },
} as const;

/**
 * "Envíame la preview" — optional, offered only after the parent has seen the
 * book (never a gate). Sends the preview link to the given address; the address
 * is not stored or subscribed to anything.
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
  if (!story || !["preview", "ready", "ordered", "shipped"].includes(story.status)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const rl = await checkRateLimit(user.id, "send_preview");
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const characters = story.characters as { name: string } | { name: string }[] | null;
  const rawName = (Array.isArray(characters) ? characters[0]?.name : characters?.name) ?? "";
  const name = escapeHtml(rawName);
  const copy = COPY[locale];
  const url = `${getSiteUrl()}/${locale}/crear/${storyId}/preview`;

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
