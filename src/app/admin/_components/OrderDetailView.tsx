import Link from "next/link";
import type { AdminOrderDetail } from "@/lib/admin/data";
import {
  gelatoOrderUrl,
  orderProblems,
  orderReferenceOf,
  STATUS_LABELS,
  stripeModeOf,
  stripePaymentUrl,
} from "@/lib/admin/orders-view";
import { FORMAT_LABELS, formatDateTime, formatMoney, ProblemBadge, StatusBadge } from "./format";
import { OrderActions } from "./OrderActions";

type Json = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-2 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={mono ? "break-all font-mono text-[12px] text-ink" : "min-w-0 break-words text-ink"}>{children ?? "—"}</dd>
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
        {aside}
      </header>
      <dl className="divide-y divide-line/70 px-4">{children}</dl>
    </section>
  );
}

function ExtLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <span className="text-ink-muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-text underline decoration-brand-text/30 underline-offset-2 hover:decoration-brand-text">
      {children}
      <span aria-hidden className="material-symbols-outlined text-[14px]">
        open_in_new
      </span>
    </a>
  );
}

export interface OrderDetailViewProps {
  detail: AdminOrderDetail;
  /** 10-minute signed links (null when the file does not exist). */
  files: { bookPdf: string | null; interiorPdf: string | null; coverPdf: string | null };
}

/** Operator order detail (presentational: data comes from the page or a dev fixture). */
export function OrderDetailView({ detail, files }: OrderDetailViewProps) {
  const { order, story, history, audit, fetchedAt: now } = detail;
  const o = order as Json & typeof order;
  const problems = orderProblems(order, now);
  const address = (o.shipping_address ?? null) as Json | null;
  const physical = order.format === "softcover" || order.format === "hardcover";
  const mode = stripeModeOf(order.stripe_checkout_session_id);
  const { bookPdf, interiorPdf, coverPdf } = files;
  const addons = Array.isArray(o.addons) ? (o.addons as unknown[]).map(String) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted hover:text-ink-soft">
          <span aria-hidden className="material-symbols-outlined text-base">
            arrow_back
          </span>
          Pedidos
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold text-ink">
            Pedido <span className="font-mono">{orderReferenceOf(order.id)}</span>
          </h1>
          <StatusBadge status={order.status} />
          {problems.map((p) => (
            <ProblemBadge key={p} problem={p} />
          ))}
          {mode === "test" && (
            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold uppercase text-ink-soft">Stripe test</span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {FORMAT_LABELS[order.format] ?? order.format}
          {addons.includes("extra_copy") ? " + copia extra" : ""} · {formatMoney(order.total, order.currency)} ·{" "}
          {formatDateTime(order.created_at)}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <Section title="Pedido">
            <Field label="Id" mono>{order.id}</Field>
            <Field label="Estado">{STATUS_LABELS[order.status] ?? order.status}</Field>
            <Field label="Subtotal / total">
              {formatMoney(num(o.subtotal), order.currency)} / {formatMoney(order.total, order.currency)}
            </Field>
            <Field label="Desistimiento">
              {str(o.withdrawal_consent_at) ? `${formatDateTime(str(o.withdrawal_consent_at))} (v. ${str(o.withdrawal_consent_version) ?? "?"})` : "—"}
            </Field>
            <Field label="Email confirmación">{formatDateTime(str(o.confirmation_email_sent_at))}</Field>
            <Field label="Email libro listo">{formatDateTime(str(o.ready_email_sent_at))}</Field>
            <Field label="Reembolsado">{formatDateTime(order.refunded_at)}</Field>
          </Section>

          <Section title="Cliente y envío">
            <Field label="Email">{order.customer_email}</Field>
            <Field label="Nombre envío">{order.shipping_name}</Field>
            <Field label="Dirección">
              {address ? (
                <>
                  {[str(address.line1), str(address.line2)].filter(Boolean).join(", ")}
                  <br />
                  {[str(address.postal_code), str(address.city), str(address.state), str(address.country)].filter(Boolean).join(" · ")}
                </>
              ) : null}
            </Field>
            <Field label="Teléfono">{address ? str(address.phone) : null}</Field>
            <Field label="Cuenta">
              {order.user_id ? <span className="font-mono text-[12px]">{order.user_id}</span> : <span className="text-ink-muted">borrada (pedido anonimizado)</span>}
            </Field>
          </Section>

          <Section title="Libro">
            {story ? (
              <>
                <Field label="Niño / título">
                  <span className="font-semibold">{order.child_name ?? "—"}</span>
                  {story.title ? ` · ${story.title}` : ""}
                </Field>
                <Field label="Story id" mono>{story.id}</Field>
                <Field label="Estado historia">{story.status}</Field>
                <Field label="Libro final">{formatDateTime(story.final_generated_at)}</Field>
                <Field label="Reintentos">
                  {story.completion_attempts ?? 0}
                  {story.completion_next_attempt_at ? ` · próximo ${formatDateTime(story.completion_next_attempt_at)}` : ""}
                </Field>
                <Field label="Último error">
                  {story.completion_last_error ? <span className="text-red-700">{story.completion_last_error}</span> : "—"}
                </Field>
                <Field label="PDF del libro">
                  <ExtLink href={bookPdf}>Abrir PDF (10 min)</ExtLink>
                </Field>
                {story.is_showcase && (
                  <Field label="Ejemplo público">
                    <ExtLink href={`/es/ejemplo/${story.id}`}>/ejemplo</ExtLink>
                  </Field>
                )}
              </>
            ) : (
              <Field label="Libro">
                <span className="text-ink-muted">Ya no existe (el cliente borró su cuenta). Se conservan los datos de facturación.</span>
              </Field>
            )}
          </Section>

          {physical && (
            <Section title="Impresión (Gelato)">
              <Field label="Pedido Gelato">
                {order.gelato_order_id ? (
                  <ExtLink href={gelatoOrderUrl(order.gelato_order_id)}>
                    <span className="font-mono text-[12px]">{order.gelato_order_id}</span>
                  </ExtLink>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Estado Gelato">{order.gelato_status}</Field>
              <Field label="Seguimiento">
                {order.tracking_number ? (
                  str(o.tracking_url) ? (
                    <ExtLink href={str(o.tracking_url)}>{order.tracking_number}</ExtLink>
                  ) : (
                    order.tracking_number
                  )
                ) : null}
              </Field>
              <Field label="Intentos envío">
                {order.gelato_submit_attempts}
                {str(o.gelato_next_attempt_at) ? ` · próximo ${formatDateTime(str(o.gelato_next_attempt_at))}` : ""}
              </Field>
              <Field label="Último error">
                {order.gelato_last_error ? <span className="text-red-700">{order.gelato_last_error}</span> : "—"}
              </Field>
              <Field label="Operador avisado">{formatDateTime(order.fulfilment_alerted_at)}</Field>
              <Field label="Ficheros impresión">
                {str(o.print_files_validated_at) ? `validados ${formatDateTime(str(o.print_files_validated_at))}` : "sin validar"}
                {(interiorPdf || coverPdf) && (
                  <span className="ml-2 inline-flex gap-3">
                    <ExtLink href={interiorPdf}>interior</ExtLink>
                    <ExtLink href={coverPdf}>cubierta</ExtLink>
                  </span>
                )}
              </Field>
              <Field label="Reimpresiones">{num(o.gelato_reprint_count) ?? 0}</Field>
              <Field label="Re-encolado">{formatDateTime(str(o.fulfilment_requeued_at))}</Field>
            </Section>
          )}

          <Section title="Pago (Stripe)">
            <Field label="Pago">
              <ExtLink href={stripePaymentUrl(order.stripe_payment_id, order.stripe_checkout_session_id)}>
                <span className="font-mono text-[12px]">{order.stripe_payment_id ?? order.stripe_checkout_session_id ?? "—"}</span>
              </ExtLink>
            </Field>
            <Field label="Factura">
              {str(o.invoice_url) ? <ExtLink href={str(o.invoice_url)}>{str(o.stripe_invoice_id) ?? "Ver factura"}</ExtLink> : null}
            </Field>
            <Field label="Reembolsos">
              <span className="text-ink-muted">Se hacen en Stripe (enlace de pago). El webhook marca el pedido como reembolsado y cancela Gelato si aún se puede.</span>
            </Field>
          </Section>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
          <OrderActions
            orderId={order.id}
            status={order.status}
            physical={physical}
            hasStory={!!story}
            atGelato={!!order.gelato_order_id}
            hasTracking={!!order.tracking_number}
            bookReady={!!story?.final_generated_at}
          />

          <Section title="Historial de estados">
            {history === null ? (
              <p className="py-3 text-[13px] text-ink-muted">Disponible al aplicar la migración 20260930150000.</p>
            ) : history.length === 0 ? (
              <p className="py-3 text-[13px] text-ink-muted">Sin cambios registrados.</p>
            ) : (
              <ol className="py-2">
                {history.map((h, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
                    <span className="text-ink">
                      {h.from_status ? `${STATUS_LABELS[h.from_status] ?? h.from_status} → ` : ""}
                      <span className="font-semibold">{STATUS_LABELS[h.to_status] ?? h.to_status}</span>
                      {h.gelato_status ? <span className="text-ink-muted"> · {h.gelato_status}</span> : null}
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-xs text-ink-muted">{formatDateTime(h.changed_at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Acciones del operador">
            {audit === null ? (
              <p className="py-3 text-[13px] text-ink-muted">Disponible al aplicar la migración 20260930150000.</p>
            ) : audit.length === 0 ? (
              <p className="py-3 text-[13px] text-ink-muted">Ninguna todavía.</p>
            ) : (
              <ol className="py-2">
                {audit.map((a, i) => (
                  <li key={i} className="py-1.5 text-[13px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={a.ok ? "font-semibold text-ink" : "font-semibold text-red-700"}>{a.action}</span>
                      <span className="whitespace-nowrap tabular-nums text-xs text-ink-muted">{formatDateTime(a.created_at)}</span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {a.actor_email}
                      {typeof a.details?.message === "string" ? ` · ${a.details.message}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}
