import Link from "next/link";
import { cx } from "@/components/ui";
import {
  filterOrders,
  orderProblems,
  orderReferenceOf,
  type AdminOrderRow,
  type OrderFilter,
} from "@/lib/admin/orders-view";
import { FORMAT_LABELS, formatDateShort, formatMoney, ProblemBadge, StatusBadge } from "./format";

const FILTERS: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "problems", label: "Incidencias" },
  { value: "stuck_paid", label: "Pagado atascado" },
  { value: "gelato_problem", label: "Gelato" },
  { value: "not_shipped", label: "Sin enviar > 5 d" },
  { value: "paid", label: "Pagados" },
  { value: "producing", label: "En producción" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "refunded", label: "Reembolsados" },
  { value: "pending", label: "Sin pagar" },
  { value: "cancelled", label: "Cancelados" },
];

function hrefFor(filter: OrderFilter, q: string) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("status", filter);
  if (q) params.set("q", q);
  const s = params.toString();
  return s ? `/admin?${s}` : "/admin";
}

export interface OrdersListViewProps {
  rows: AdminOrderRow[];
  filter: OrderFilter;
  q: string;
  now: number;
  truncated: boolean;
  error: string | null;
}

/** Operator order list (presentational: data comes from the page or a dev fixture). */
export function OrdersListView({ rows, filter, q, now, truncated, error }: OrdersListViewProps) {
  const visible = filterOrders(rows, filter, q, now);
  const problemCount = rows.filter((o) => orderProblems(o, now).some((p) => p !== "refunded")).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Pedidos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {rows.length} pedidos{truncated ? " (los más recientes)" : ""} ·{" "}
            <span className={problemCount > 0 ? "font-semibold text-red-700" : undefined}>
              {problemCount} con incidencias
            </span>
          </p>
        </div>
        <form action="/admin" method="get" className="flex w-full items-center gap-2 sm:w-auto">
          {filter !== "all" && <input type="hidden" name="status" value={filter} />}
          <label className="relative flex-1 sm:w-80">
            <span className="sr-only">Buscar</span>
            <span aria-hidden className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-muted">
              search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Email, referencia, id, nombre del niño…"
              className="h-10 w-full rounded-xl border-2 border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
            />
          </label>
          <button type="submit" className="h-10 rounded-xl bg-brand-deep px-4 text-sm font-bold text-white hover:bg-brand-deep-hover">
            Buscar
          </button>
        </form>
      </div>

      <nav aria-label="Filtrar por estado" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5">
          {FILTERS.map((f) => (
            <li key={f.value}>
              <Link
                href={hrefFor(f.value, q)}
                aria-current={filter === f.value ? "page" : undefined}
                className={cx(
                  "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors",
                  filter === f.value
                    ? "border-brand-deep bg-brand-deep text-white"
                    : "border-line bg-surface text-ink-soft hover:border-brand/40",
                )}
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">No se pudieron leer los pedidos: {error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead className="border-b border-line bg-paper/60 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5 font-bold">Fecha</th>
                <th className="px-3 py-2.5 font-bold">Ref.</th>
                <th className="px-3 py-2.5 font-bold">Cliente</th>
                <th className="px-3 py-2.5 font-bold">Libro</th>
                <th className="px-3 py-2.5 font-bold">Formato</th>
                <th className="px-3 py-2.5 text-right font-bold">Total</th>
                <th className="px-3 py-2.5 font-bold">Estado</th>
                <th className="px-4 py-2.5 font-bold">Incidencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((o) => {
                const problems = orderProblems(o, now);
                return (
                  <tr key={o.id} className="group relative hover:bg-brand/[0.03]">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-muted">{formatDateShort(o.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-[12px] font-semibold text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {orderReferenceOf(o.id)}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-ink-soft">
                      {o.customer_email ?? <span className="text-ink-muted">sin email</span>}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5">
                      {o.child_name ? (
                        <span className="font-semibold text-ink">{o.child_name}</span>
                      ) : (
                        <span className="text-ink-muted">{o.story_id ? "—" : "cuenta borrada"}</span>
                      )}
                      {o.story_title && <span className="text-ink-muted"> · {o.story_title}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{FORMAT_LABELS[o.format] ?? o.format}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink">{formatMoney(o.total, o.currency)}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {problems.map((p) => (
                          <ProblemBadge key={p} problem={p} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && !error && (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            {q ? `Ningún pedido coincide con «${q}».` : "No hay pedidos en esta vista."}
          </p>
        )}
      </div>
    </div>
  );
}
