"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cx } from "@/components/ui";

type ActionBody =
  | { action: "resend_gelato"; rebuildPrintFiles: boolean }
  | { action: "retry_generation" }
  | { action: "resend_email"; kind: "confirmation" | "book_ready" | "shipped" };

interface PendingAction {
  title: string;
  description: string;
  confirmLabel: string;
  body: ActionBody;
  /** Optional checkbox (reprint: rebuild print files). */
  withRebuild?: boolean;
}

interface Props {
  orderId: string;
  status: string;
  physical: boolean;
  hasStory: boolean;
  atGelato: boolean;
  hasTracking: boolean;
  bookReady: boolean;
}

export function OrderActions({ orderId, status, physical, hasStory, atGelato, hasTracking, bookReady }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [rebuild, setRebuild] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closed = ["pending", "cancelled", "refunded"].includes(status);
  const paidEver = !["pending", "cancelled"].includes(status);

  useEffect(() => {
    if (!pending) return;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setPending(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, busy]);

  function open(action: PendingAction) {
    setResult(null);
    setRebuild(false);
    setPending(action);
  }

  async function run() {
    if (!pending || busy) return;
    setBusy(true);
    const body = pending.body.action === "resend_gelato" ? { ...pending.body, rebuildPrintFiles: rebuild } : pending.body;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, confirm: true }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setResult({ ok: !!data?.ok, message: data?.message ?? `Error HTTP ${res.status}` });
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Sin conexión. No se ha hecho nada; vuelve a intentarlo." });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const gelatoAction: PendingAction = atGelato
    ? {
        title: "Reimprimir en Gelato",
        description:
          "Se creará un pedido NUEVO en Gelato con los mismos ficheros y dirección. Si el pedido actual aún no se ha enviado, se cancela primero en Gelato (si no se puede cancelar, no se hace nada). El cliente recibirá otra vez el email «en producción».",
        confirmLabel: "Reimprimir",
        body: { action: "resend_gelato", rebuildPrintFiles: false },
        withRebuild: true,
      }
    : {
        title: "Reenviar a Gelato",
        description:
          "El pedido vuelve a la cola de impresión aunque tenga más de 48 h o haya agotado los reintentos: se procesa ahora y, si hace falta, en los próximos minutos.",
        confirmLabel: "Reenviar",
        body: { action: "resend_gelato", rebuildPrintFiles: false },
        withRebuild: true,
      };

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Acciones</h2>
      </header>
      <div className="flex flex-col gap-2 p-4">
        {physical && (
          <ActionRow
            icon="print"
            label={atGelato ? "Reenviar a Gelato / reimprimir" : "Reenviar a Gelato"}
            disabled={closed || !hasStory}
            hint={!hasStory ? "El libro ya no existe" : closed ? "Pedido no pagado o reembolsado" : undefined}
            onClick={() => open(gelatoAction)}
          />
        )}
        <ActionRow
          icon="autorenew"
          label="Reintentar generación"
          disabled={!paidEver || status === "refunded" || !hasStory}
          hint={!hasStory ? "El libro ya no existe" : undefined}
          onClick={() =>
            open({
              title: "Reintentar generación",
              description:
                "Pone a cero los fallos y la espera del libro y lanza una ejecución ahora. Continúa desde el último punto guardado (no rehace lo ya generado).",
              confirmLabel: "Reintentar",
              body: { action: "retry_generation" },
            })
          }
        />
        <div className="mt-1 border-t border-line pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Reenviar email</p>
          <div className="flex flex-wrap gap-1.5">
            <EmailChip
              label="Confirmación"
              disabled={!paidEver || !hasStory}
              onClick={() =>
                open({
                  title: "Reenviar confirmación",
                  description: "Reenvía la confirmación con el recibo, reconstruido desde el pago en Stripe, al email del pedido.",
                  confirmLabel: "Enviar",
                  body: { action: "resend_email", kind: "confirmation" },
                })
              }
            />
            <EmailChip
              label="Libro listo"
              disabled={!bookReady || status === "refunded" || !hasStory}
              onClick={() =>
                open({
                  title: "Reenviar «tu libro está listo»",
                  description: "Reenvía el email con el enlace de descarga del libro al email del pedido.",
                  confirmLabel: "Enviar",
                  body: { action: "resend_email", kind: "book_ready" },
                })
              }
            />
            {physical && (
              <EmailChip
                label="Enviado"
                disabled={!hasStory || !(hasTracking || status === "shipped" || status === "delivered")}
                onClick={() =>
                  open({
                    title: "Reenviar email de envío",
                    description: "Reenvía el email «tu libro va de camino» con el seguimiento actual.",
                    confirmLabel: "Enviar",
                    body: { action: "resend_email", kind: "shipped" },
                  })
                }
              />
            )}
          </div>
        </div>

        {result && (
          <p
            role="status"
            className={cx(
              "mt-2 rounded-xl border px-3 py-2 text-[13px]",
              result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {result.message}
          </p>
        )}
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 sm:items-center sm:p-4" onClick={() => !busy && setPending(null)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-action-title"
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-action-title" className="font-display text-lg font-bold text-ink">
              {pending.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-body">{pending.description}</p>
            {pending.withRebuild && (
              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={rebuild}
                  onChange={(e) => setRebuild(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--brand)]"
                />
                <span>
                  Regenerar los ficheros de impresión
                  <span className="block text-xs text-ink-muted">Solo si los PDF actuales tenían un problema.</span>
                </span>
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="quiet" size="sm" onClick={() => setPending(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button size="sm" onClick={run} loading={busy} data-autofocus>
                {pending.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionRow({ icon, label, hint, disabled, onClick }: { icon: string; label: string; hint?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl border-2 border-line px-3 py-2.5 text-left text-sm font-semibold text-ink transition-colors hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:bg-transparent"
    >
      <span aria-hidden className="material-symbols-outlined text-xl text-ink-muted">
        {icon}
      </span>
      <span className="flex-1">
        {label}
        {hint && <span className="block text-xs font-normal text-ink-muted">{hint}</span>}
      </span>
    </button>
  );
}

function EmailChip({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-ink-soft transition-colors hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden className="material-symbols-outlined text-[16px]">
        mail
      </span>
      {label}
    </button>
  );
}
