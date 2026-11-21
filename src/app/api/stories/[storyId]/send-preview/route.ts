import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkMemoryRateLimit, checkRateLimit, rateLimitSubject } from "@/lib/rate-limit";
import { sendEmail, getSiteUrl } from "@/lib/email/send";
import { escapeHtml, renderEmailLayout } from "@/lib/email/layout";
import { mailSafeName } from "@/lib/email/mail-safe-name";
import { SHAREABLE_STORY_STATUSES } from "@/lib/share/preview-share-token";
import { issueStoryClaimLink } from "@/lib/share/story-claim-link";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { recordPreviewReminderConsent } from "@/lib/marketing/preview-reminders";
import { isSuppressed, unsubscribeLinks } from "@/lib/marketing/suppression";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.enum(["es", "ca", "en", "fr"]).default("es"),
  /** The "Envíamelo y recuérdamelo" button was pressed (the plain send is beside it): consent to the reminders. */
  remind: z.literal(true).optional(),
});

const COPY = {
  es: {
    subject: (n: string) => `La vista previa del libro de ${n}`,
    heading: (n: string) => `El libro de ${n} te espera`,
    body: "Aquí tienes el enlace a su libro para verlo con calma y pedirlo cuando quieras, desde cualquier móvil u ordenador. Es tu enlace personal: abre el cuento para terminarlo, así que no lo reenvíes. Para enseñárselo a la familia, usa «Compartir» en la vista previa. Caduca en 30 días.",
    cta: "Ver su libro",
    signoff: "Un abrazo,\nMeapica",
    reminderNote: (unsubscribe: string) =>
      `Nos has pedido que te recordemos este cuento: te escribiremos como mucho 3 veces en los próximos 3 días. Si prefieres que no, ${unsubscribe}.`,
    unsubscribe: "date de baja aquí",
  },
  ca: {
    subject: (n: string) => `La vista prèvia del llibre de ${n}`,
    heading: (n: string) => `El llibre de ${n} t'espera`,
    body: "Aquí tens l'enllaç al seu llibre per mirar-lo amb calma i demanar-lo quan vulguis, des de qualsevol mòbil o ordinador. És el teu enllaç personal: obre el conte per acabar-lo, així que no el reenviïs. Per ensenyar-lo a la família, fes servir «Compartir» a la vista prèvia. Caduca d'aquí a 30 dies.",
    cta: "Veure el seu llibre",
    signoff: "Una abraçada,\nMeapica",
    reminderNote: (unsubscribe: string) =>
      `Ens has demanat que et recordem aquest conte: t'escriurem com a màxim 3 vegades els pròxims 3 dies. Si prefereixes que no, ${unsubscribe}.`,
    unsubscribe: "dona't de baixa aquí",
  },
  en: {
    subject: (n: string) => `${n}'s book preview`,
    heading: (n: string) => `${n}'s book is waiting for you`,
    body: "Here is the link to the book so you can look at it calmly and order it whenever you like, from any phone or computer. It is your personal link: it opens the story so you can finish it, so please don't forward it. To show it to family, use \"Share\" on the preview. It expires in 30 days.",
    cta: "See the book",
    signoff: "Warmly,\nMeapica",
    reminderNote: (unsubscribe: string) =>
      `You asked us to remind you about this story: we'll write at most 3 times over the next 3 days. If you'd rather we didn't, ${unsubscribe}.`,
    unsubscribe: "unsubscribe here",
  },
  fr: {
    subject: (n: string) => `L'aperçu du livre de ${n}`,
    heading: (n: string) => `Le livre de ${n} vous attend`,
    body: "Voici le lien vers le livre, pour le regarder tranquillement et le commander quand vous voulez, depuis n'importe quel téléphone ou ordinateur. C'est votre lien personnel : il ouvre l'histoire pour la terminer, alors ne le transférez pas. Pour la montrer à la famille, utilisez « Partager » sur l'aperçu. Il expire dans 30 jours.",
    cta: "Voir le livre",
    signoff: "Bien à vous,\nMeapica",
    reminderNote: (unsubscribe: string) =>
      `Vous nous avez demandé de vous rappeler cette histoire : nous vous écrirons au maximum 3 fois dans les 3 prochains jours. Si vous préférez que non, ${unsubscribe}.`,
    unsubscribe: "désabonnez-vous ici",
  },
} as const;

/**
 * "Envíame la vista previa" — optional, offered only after the parent has seen the
 * book (never a gate). Sends the owner's "continue your book" link to the given address
 * (/[locale]/continue/[token], src/lib/share/story-claim-token.ts): opened in any browser
 * (Gmail, Safari, another phone) it moves the story there, ready to buy. The read-only
 * family link stays the "Compartir" button.
 *
 * The address is stored only when the parent pressed "Envíamelo y recuérdamelo" (`remind`):
 * that express consent (LSSI 21.1 / RGPD 6.1.a) is recorded in preview_reminders and
 * starts the abandoned-preview reminders (src/lib/marketing/preview-reminders.ts).
 * With the plain send nothing is stored and nothing else is ever sent.
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
  const { email, locale, remind } = parsed.data;

  const { data: story } = await supabase
    .from("stories")
    .select("id, status, characters(name)")
    .eq("id", storyId)
    .eq("user_id", user.id)
    .single();
  // Still painting (the parent left the email on the waiting screen): nothing can be sent yet.
  const painting = story?.status === "generating";
  if (!story || (!painting && !(SHAREABLE_STORY_STATUSES as readonly string[]).includes(story.status))) {
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

  // While painting: store the reminder consent now (so a parent who closes the tab still
  // gets the reminders, the first one 1 h later, with the link), send nothing. The waiting
  // screen posts again once the preview is ready, and that call sends the link. A plain
  // send ("solo el enlace") is never stored: the client holds it until the preview is ready.
  if (painting) {
    if (!remind) return NextResponse.json({ error: "not_ready" }, { status: 409 });
    let reminder = false;
    try {
      const db = createFulfilmentClient();
      reminder = !(await isSuppressed(db, email)) && (await recordPreviewReminderConsent(db, { storyId: story.id, email, locale }));
    } catch (err) {
      console.error(`[send-preview] Reminder consent not recorded for story ${story.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
    return NextResponse.json({ sent: false, queued: true, reminder });
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
  const db = createFulfilmentClient();
  const url = await issueStoryClaimLink(db, { storyId: story.id, email, locale, siteUrl: getSiteUrl() });

  // Reminders: only for a preview that can still be bought, with a working unsubscribe
  // link, to an address that has not unsubscribed. Any doubt = no reminders (the preview
  // itself is still sent).
  const links = remind && story.status === "preview" ? unsubscribeLinks(email, locale) : null;
  let reminder = false;
  if (links) {
    try {
      reminder = !(await isSuppressed(db, email)) && (await recordPreviewReminderConsent(db, { storyId: story.id, email, locale }));
    } catch (err) {
      console.error(`[send-preview] Reminder consent not recorded for story ${story.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  const noteLink = links ? `<a href="${escapeHtml(links.pageUrl)}" style="color:inherit;text-decoration:underline;">${escapeHtml(copy.unsubscribe)}</a>` : "";

  const ok = await sendEmail({
    to: email,
    subject: copy.subject(rawName),
    html: renderEmailLayout({
      heading: copy.heading(name),
      paragraphs: [copy.body],
      cta: { label: copy.cta, url },
      signoff: copy.signoff,
      lang: locale,
      footerNoteHtml: reminder && links ? copy.reminderNote(noteLink) : undefined,
    }),
    text: [
      copy.heading(rawName),
      copy.body,
      url,
      copy.signoff,
      ...(reminder && links ? [copy.reminderNote(`${copy.unsubscribe} (${links.pageUrl})`)] : []),
    ].join("\n\n"),
    headers: reminder && links ? links.headers : undefined,
  });

  if (!ok) {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
  return NextResponse.json({ sent: true, reminder });
}
