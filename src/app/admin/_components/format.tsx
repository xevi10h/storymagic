import { cx } from "@/components/ui";
import { PROBLEM_LABELS, STATUS_LABELS, type OrderProblem } from "@/lib/admin/orders-view";

const MONEY = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const DATE_TIME = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_SHORT = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMoney(value: number | null | undefined, currency?: string | null): string {
  if (value == null) return "—";
  if (currency && currency.toUpperCase() !== "EUR") {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency.toUpperCase() }).format(value);
  }
  return MONEY.format(value);
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? DATE_TIME.format(new Date(iso)) : "—";
}

export function formatDateShort(iso: string | null | undefined): string {
  return iso ? DATE_SHORT.format(new Date(iso)) : "—";
}

export const FORMAT_LABELS: Record<string, string> = {
  digital_pdf: "Digital",
  softcover: "Tapa blanda",
  hardcover: "Tapa dura",
};

const STATUS_TONES: Record<string, string> = {
  pending: "bg-line text-ink-muted",
  paid: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  producing: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  shipped: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  delivered: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  cancelled: "bg-line text-ink-muted",
  refunded: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_TONES[status] ?? "bg-line text-ink-soft",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ProblemBadge({ problem }: { problem: OrderProblem }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
        problem === "refunded" ? "bg-line text-ink-soft" : "bg-red-50 text-red-700",
      )}
    >
      {problem !== "refunded" && (
        <span aria-hidden className="material-symbols-outlined text-[14px]">
          error
        </span>
      )}
      {PROBLEM_LABELS[problem]}
    </span>
  );
}
