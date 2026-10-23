import { requireAdminPage } from "@/lib/admin/auth";
import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { listCreatorsForAdmin } from "@/lib/growth/creators";
import { formatDateTime, formatMoney } from "../_components/format";
import { CreatorActions, PayoutActions } from "../_components/CreatorActions";

export const dynamic = "force-dynamic";

const eur = (cents: number) => formatMoney(cents / 100);

/** Creator programme: invite creators, see balances, transfer and mark payouts paid. */
export default async function AdminCreatorsPage() {
  await requireAdminPage();
  const { creators, openPayouts } = await listCreatorsForAdmin(createFulfilmentClient());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Creadores</h1>
        <p className="mt-1 text-sm text-ink-muted">
          10 % de lo pagado sin IVA con su código. Disponible cuando el libro se entrega. Transferencia mínima 20 €.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface">
        <header className="border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Transferencias pendientes ({openPayouts.length})</h2>
        </header>
        {openPayouts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-muted">Nada pendiente.</p>
        ) : (
          <ul className="divide-y divide-line">
            {openPayouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
                <span className="font-semibold text-ink">@{p.handle}</span>
                <span className="font-semibold tabular-nums text-ink">{eur(p.amount_cents)}</span>
                <span className="select-all font-mono text-ink-soft">{p.iban}</span>
                <span className="text-ink-soft">
                  {p.holder_name} · <span className="select-all font-mono">{p.tax_id}</span>
                </span>
                <span className="text-xs text-ink-muted">{formatDateTime(p.created_at)}</span>
                <PayoutActions withdrawalId={p.id} amount={eur(p.amount_cents)} handle={p.handle} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs font-bold uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-4 py-2.5">Creador</th>
              <th className="px-4 py-2.5">Código</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5 text-right">Ventas</th>
              <th className="px-4 py-2.5 text-right">Pendiente</th>
              <th className="px-4 py-2.5 text-right">Disponible</th>
              <th className="px-4 py-2.5 text-right">Solicitado</th>
              <th className="px-4 py-2.5 text-right">Pagado</th>
              <th className="px-4 py-2.5 text-right">Canjeado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {creators.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-semibold text-ink">@{c.handle}</td>
                <td className="px-4 py-2.5 font-mono text-ink-soft">{c.promo_code}</td>
                <td className="px-4 py-2.5 text-ink-soft">{c.email}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.sales}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{eur(c.balance.pendingCents)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink">{eur(c.balance.availableCents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{eur(c.balance.requestedCents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{eur(c.balance.paidOutCents)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{eur(c.balance.spentCents)}</td>
              </tr>
            ))}
            {creators.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-ink-muted">
                  Ningún creador registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <CreatorActions />
    </div>
  );
}
