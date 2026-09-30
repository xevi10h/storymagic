// Operator actions on an order (/admin) — SERVER ONLY. Callers must have passed the
// operator gate. Every action is idempotent (compare-and-set on the state it read)
// and audited in admin_audit_log (best effort: an audit failure never blocks a fix).
//
// None of them does the heavy work inline: they reset the order/story so the
// resumable pipeline (/api/stories/{id}/complete) takes it again, and the caller
// kicks one /complete run right away (kickCompletion). The 5-min cron continues it
// because fulfilment_requeued_at re-opens the 48 h auto-processing window.

import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { isOrderForActiveStripeMode } from "@/lib/fulfilment/logic";
import { recordPaidSession } from "@/lib/fulfilment/payments";
import { notifyOrderEmail } from "@/lib/email/notify-order";
import { getSiteUrl } from "@/lib/email/send";
import { cancelPrintOrder } from "@/lib/gelato/orders";
import { adminServiceClient } from "./data";
import { stripeModeOf } from "./orders-view";

export type AdminAction = "resend_gelato" | "resend_email" | "retry_generation";
export type ResendEmailKind = "confirmation" | "book_ready" | "shipped";

export interface ActionResult {
  ok: boolean;
  /** Spanish, shown to the operator as is. */
  message: string;
  /** Story to advance now (the route kicks /complete after responding). */
  kickStoryId?: string;
  details?: Record<string, unknown>;
}

const PHYSICAL_FORMATS = new Set(["softcover", "hardcover"]);
/** Gelato statuses after which the physical book has left the printer. */
const GELATO_DONE_STATUSES = new Set(["shipped", "in_transit", "delivered"]);
/** Gelato statuses where the old order is already dead: nothing to cancel. */
const GELATO_DEAD_STATUSES = new Set(["canceled", "cancelled", "failed", "returned"]);

type OrderRow = {
  id: string;
  status: string;
  format: string;
  story_id: string | null;
  user_id: string | null;
  stripe_checkout_session_id: string | null;
  gelato_order_id: string | null;
  gelato_status: string | null;
  gelato_reprint_count: number | null;
  tracking_number: string | null;
  tracking_url: string | null;
  download_token: string | null;
  confirmation_email_sent_at: string | null;
};

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const { data, error } = await adminServiceClient()
    .from("orders")
    .select(
      "id, status, format, story_id, user_id, stripe_checkout_session_id, gelato_order_id, gelato_status, gelato_reprint_count, tracking_number, tracking_url, download_token, confirmation_email_sent_at",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read order: ${error.message}`);
  return (data as OrderRow | null) ?? null;
}

/** Best-effort audit trail. Logs to the console too, so a missing table never hides an action. */
export async function auditAdminAction(entry: {
  actorEmail: string;
  action: string;
  orderId?: string | null;
  storyId?: string | null;
  ok: boolean;
  details?: Record<string, unknown>;
}): Promise<void> {
  console.log(
    `[admin] ${entry.actorEmail} ${entry.action} order=${entry.orderId ?? "-"} ok=${entry.ok} ${JSON.stringify(entry.details ?? {})}`,
  );
  try {
    const { error } = await adminServiceClient().from("admin_audit_log").insert({
      actor_email: entry.actorEmail,
      action: entry.action,
      order_id: entry.orderId ?? null,
      story_id: entry.storyId ?? null,
      ok: entry.ok,
      details: entry.details ?? {},
    });
    if (error) console.error(`[admin] audit insert failed: ${error.message}`);
  } catch (err) {
    console.error("[admin] audit insert threw:", err);
  }
}

/** Resets the story's failure streak so neither the cap nor a backoff blocks the next run. */
async function resetStoryRetries(storyId: string): Promise<void> {
  const { error } = await adminServiceClient()
    .from("stories")
    .update({ completion_attempts: 0, completion_next_attempt_at: null, completion_last_error: null })
    .eq("id", storyId);
  if (error) throw new Error(`Failed to reset story retries: ${error.message}`);
}

// ── Reenviar a Gelato / reimprimir ───────────────────────────────────────────

/**
 * Not yet at Gelato (status 'paid', any age, retries exhausted or not): clear the
 * Gelato backoff/attempts and re-queue. Already at Gelato: REPRINT — the old
 * Gelato order is cancelled if it has not shipped (a failed cancel aborts, so we
 * never print twice), the order goes back to 'paid' with a new Gelato reference
 * (meapica-{id}-r{n}), and the pipeline submits a new print order.
 */
export async function resendToGelato(orderId: string, opts: { rebuildPrintFiles: boolean }): Promise<ActionResult> {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false, message: "Pedido no encontrado." };
  if (!PHYSICAL_FORMATS.has(order.format)) return { ok: false, message: "Es un pedido digital: no se imprime." };
  if (!order.story_id) return { ok: false, message: "El cliente borró su cuenta: ya no existe el libro para imprimir." };
  if (["pending", "cancelled", "refunded"].includes(order.status)) {
    return { ok: false, message: `No se puede imprimir un pedido en estado '${order.status}'.` };
  }
  if (!isOrderForActiveStripeMode(order)) {
    return { ok: false, message: "El pedido es de otro modo de Stripe (test/live) que este despliegue: no se procesaría." };
  }

  const now = new Date().toISOString();
  const common = {
    gelato_submit_attempts: 0,
    gelato_next_attempt_at: null,
    gelato_submit_started_at: null,
    gelato_last_error: null,
    fulfilment_alerted_at: null,
    fulfilment_requeued_at: now,
    ...(opts.rebuildPrintFiles ? { print_files_validated_at: null } : {}),
  };
  const supabase = adminServiceClient();

  if (!order.gelato_order_id) {
    // Still 'paid' (never reached Gelato): re-queue.
    const { data, error } = await supabase
      .from("orders")
      .update(common)
      .eq("id", order.id)
      .eq("status", "paid")
      .is("gelato_order_id", null)
      .select("id");
    if (error) throw new Error(`Failed to re-queue order: ${error.message}`);
    if (!data?.length) return { ok: false, message: "El pedido cambió mientras tanto. Recarga la página." };
    await resetStoryRetries(order.story_id);
    return {
      ok: true,
      message: "Reenviado: el pedido vuelve a la cola de impresión (se procesa ahora y, si hace falta, en los próximos minutos).",
      kickStoryId: order.story_id,
      details: { mode: "requeue", rebuildPrintFiles: opts.rebuildPrintFiles },
    };
  }

  // Reprint: the old Gelato order must be dead or already shipped before we create another.
  const oldGelatoId = order.gelato_order_id;
  const oldStatus = (order.gelato_status ?? "").toLowerCase();
  let cancelledOld = false;
  if (!GELATO_DONE_STATUSES.has(oldStatus) && !GELATO_DEAD_STATUSES.has(oldStatus)) {
    try {
      await cancelPrintOrder(oldGelatoId);
      cancelledOld = true;
    } catch (err) {
      return {
        ok: false,
        message: `No se pudo cancelar el pedido anterior en Gelato (${oldGelatoId}, estado '${oldStatus || "desconocido"}'). Seguramente ya está en producción: cancélalo a mano en Gelato o espera a que se envíe, y vuelve a intentarlo.`,
        details: { error: err instanceof Error ? err.message.slice(0, 300) : String(err) },
      };
    }
  }

  const reprintCount = (order.gelato_reprint_count ?? 0) + 1;
  const { data, error } = await supabase
    .from("orders")
    .update({
      ...common,
      status: "paid",
      gelato_order_id: null,
      gelato_status: null,
      tracking_number: null,
      tracking_url: null,
      gelato_reprint_count: reprintCount,
    })
    .eq("id", order.id)
    .eq("status", order.status)
    .eq("gelato_order_id", oldGelatoId)
    .select("id");
  if (error) throw new Error(`Failed to reset order for reprint: ${error.message}`);
  if (!data?.length) return { ok: false, message: "El pedido cambió mientras tanto. Recarga la página." };
  await resetStoryRetries(order.story_id);
  return {
    ok: true,
    message: `Reimpresión en marcha (nº ${reprintCount}). Se creará un pedido nuevo en Gelato; el anterior (${oldGelatoId}) ${cancelledOld ? "se ha cancelado" : "queda como estaba"}.`,
    kickStoryId: order.story_id,
    details: {
      mode: "reprint",
      previousGelatoOrderId: oldGelatoId,
      previousGelatoStatus: oldStatus || null,
      previousStatus: order.status,
      cancelledOld,
      reprintCount,
      rebuildPrintFiles: opts.rebuildPrintFiles,
    },
  };
}

// ── Reintentar generación ────────────────────────────────────────────────────

/** Clears the story's failure streak/backoff and re-opens the 48 h window of its paid orders. */
export async function retryGeneration(orderId: string): Promise<ActionResult> {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false, message: "Pedido no encontrado." };
  if (!order.story_id) return { ok: false, message: "El cliente borró su cuenta: ya no existe el libro." };
  if (!["paid", "producing", "shipped", "delivered"].includes(order.status)) {
    return { ok: false, message: `El pedido está en '${order.status}': solo se generan libros pagados.` };
  }
  if (!isOrderForActiveStripeMode(order)) {
    return { ok: false, message: "El pedido es de otro modo de Stripe (test/live) que este despliegue: no se procesaría." };
  }
  await resetStoryRetries(order.story_id);
  const { error } = await adminServiceClient()
    .from("orders")
    .update({ fulfilment_requeued_at: new Date().toISOString() })
    .eq("story_id", order.story_id)
    .eq("status", "paid");
  if (error) throw new Error(`Failed to re-queue orders: ${error.message}`);
  return {
    ok: true,
    message: "Reintento lanzado: la generación continúa desde el último punto guardado.",
    kickStoryId: order.story_id,
  };
}

// ── Reenviar email ───────────────────────────────────────────────────────────

export async function resendOrderEmail(orderId: string, kind: ResendEmailKind): Promise<ActionResult> {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false, message: "Pedido no encontrado." };
  if (!order.story_id || !order.user_id) {
    return { ok: false, message: "El cliente borró su cuenta: no hay libro ni datos para el email." };
  }
  if (["pending", "cancelled"].includes(order.status)) return { ok: false, message: "El pedido no está pagado." };
  const physical = PHYSICAL_FORMATS.has(order.format);

  if (kind === "confirmation") {
    // Rebuilt from the paid Checkout Session (receipt included) by the same code as the webhook.
    const mode = stripeModeOf(order.stripe_checkout_session_id);
    const active = process.env.STRIPE_ENVIRONMENT?.trim() === "live" ? "live" : "test";
    if (!mode || mode !== active) {
      return { ok: false, message: "La sesión de Stripe es de otro modo (test/live): no se puede leer el recibo desde aquí." };
    }
    const fulfilment = createFulfilmentClient();
    const previous = order.confirmation_email_sent_at;
    await fulfilment.from("orders").update({ confirmation_email_sent_at: null }).eq("id", order.id);
    const result = await recordPaidSession(fulfilment, order.stripe_checkout_session_id!);
    const { data: after } = await fulfilment.from("orders").select("confirmation_email_sent_at").eq("id", order.id).maybeSingle();
    const sent = !!after?.confirmation_email_sent_at && after.confirmation_email_sent_at !== previous;
    if (!sent && previous) {
      // Restore the marker so the "sent" state stays truthful.
      await fulfilment.from("orders").update({ confirmation_email_sent_at: previous }).eq("id", order.id).is("confirmation_email_sent_at", null);
    }
    return sent
      ? { ok: true, message: "Confirmación (con recibo) reenviada.", details: { kind } }
      : { ok: false, message: `No se pudo reenviar la confirmación (${result.state}).`, details: { kind, state: result.state } };
  }

  if (kind === "book_ready") {
    if (order.status === "refunded") return { ok: false, message: "Pedido reembolsado: el enlace de descarga ya no funciona." };
    const { data: story } = await adminServiceClient()
      .from("stories")
      .select("final_generated_at, pdf_url")
      .eq("id", order.story_id)
      .maybeSingle();
    if (!story?.final_generated_at || !story?.pdf_url) return { ok: false, message: "El libro final aún no está listo." };
    const sent = await notifyOrderEmail({
      supabase: createFulfilmentClient(),
      event: "book_ready",
      storyId: order.story_id,
      userId: order.user_id,
      orderId: order.id,
      downloadUrl: `${getSiteUrl()}/api/downloads/${order.download_token}`,
      isPhysical: physical,
    });
    return sent
      ? { ok: true, message: "Email «tu libro está listo» reenviado (con el enlace de descarga).", details: { kind } }
      : { ok: false, message: "Resend no aceptó el email. Revisa los logs." };
  }

  // shipped
  if (!physical) return { ok: false, message: "Es un pedido digital: no hay envío." };
  if (!["shipped", "delivered"].includes(order.status) && !order.tracking_number) {
    return { ok: false, message: "El pedido aún no consta como enviado ni tiene seguimiento." };
  }
  const sent = await notifyOrderEmail({
    supabase: createFulfilmentClient(),
    event: "shipped",
    storyId: order.story_id,
    userId: order.user_id,
    orderId: order.id,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
  });
  return sent
    ? { ok: true, message: "Email de envío reenviado.", details: { kind } }
    : { ok: false, message: "Resend no aceptó el email. Revisa los logs." };
}

// ── Kick ─────────────────────────────────────────────────────────────────────

/**
 * One /complete run for the story right away, in its own function invocation
 * (own 300 s budget), authenticated with the cron secret. Awaited inside after(),
 * so the operator's response is not held. Never throws.
 */
export async function kickCompletion(storyId: string, origin: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[admin] CRON_SECRET not set: the cron will pick the order up on its next tick");
    return;
  }
  try {
    // Production: the canonical site (same as the cron); elsewhere the request's own
    // origin, so a local/preview run never calls production with the secret.
    const base = process.env.VERCEL_ENV === "production" ? getSiteUrl() : origin;
    const res = await fetch(`${base.replace(/\/$/, "")}/api/stories/${storyId}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(290_000),
    });
    console.log(`[admin] kicked /complete for story ${storyId} → HTTP ${res.status}`);
  } catch (err) {
    console.error(`[admin] kick /complete for story ${storyId} failed (cron will retry):`, err instanceof Error ? err.message : err);
  }
}

