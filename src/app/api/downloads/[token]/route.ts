import { NextResponse } from "next/server";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { bookPdfFilename, getSignedBookDownloadUrl } from "@/lib/supabase/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAID_STATUSES = new Set(["paid", "producing", "shipped", "delivered"]);

// Plain page for a browser that followed an email link (es + ca: our buyers).
function message(status: number, es: string, ca: string) {
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meapica</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#2d2a26;line-height:1.5"><h1 style="font-size:1.25rem">Meapica</h1><p>${es}</p><p lang="ca" style="color:#6b6560">${ca}</p><p><a href="/">meapica.shop</a> · <a href="mailto:admin@casmar.tech">admin@casmar.tech</a></p></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/**
 * Tokenised download link from the "book ready" email (one token per order, 122
 * random bits; works for guests on any device). Redirects to a 10-minute signed
 * Storage URL. Refunded / cancelled orders lose access.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) return message(404, "Este enlace no es válido.", "Aquest enllaç no és vàlid.");

  const admin = createFulfilmentClient();
  const { data: order } = await admin
    .from("orders")
    .select("status, story_id, stories(user_id, title, pdf_url, generated_text)")
    .eq("download_token", token)
    .maybeSingle();
  if (!order) return message(404, "Este enlace no es válido.", "Aquest enllaç no és vàlid.");
  if (!PAID_STATUSES.has(order.status)) {
    return message(410, "Este pedido ya no está activo. Si crees que es un error, escríbenos.", "Aquesta comanda ja no està activa. Si creus que és un error, escriu-nos.");
  }
  const story = order.stories as unknown as {
    user_id: string;
    title: string | null;
    pdf_url: string | null;
    generated_text: { bookTitle?: string } | null;
  } | null;
  if (!story?.pdf_url) {
    return message(409, "Tu libro todavía se está preparando. Te avisaremos por email en cuanto esté listo.", "El teu llibre encara s'està preparant. T'avisarem per correu quan estigui llest.");
  }

  try {
    const url = await getSignedBookDownloadUrl(
      admin,
      story.user_id,
      order.story_id,
      bookPdfFilename(story.title ?? story.generated_text?.bookTitle),
    );
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error(`[downloads] Sign failed for story ${order.story_id}:`, err);
    return message(503, "No hemos podido preparar la descarga. Prueba de nuevo en unos minutos.", "No hem pogut preparar la descàrrega. Torna-ho a provar d'aquí a uns minuts.");
  }
}
