// What the customer sees for one order in their library (pure, no imports so it
// can be checked with `node --experimental-strip-types src/lib/order-view.check.mjs`).

/** Short, stable order reference shown to the customer: first 8 hex of the order id. */
export function orderReference(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export const PRINT_STEPS = ["paid", "producing", "shipped", "delivered"] as const;
export type PrintStep = (typeof PRINT_STEPS)[number];

export interface OrderViewInput {
  format: string;
  status: string;
  refunded_at: string | null;
  gelato_status: string | null;
  /** The customer PDF is built and stored (stories.pdf_url set). */
  pdf_ready: boolean;
}

export type OrderPhase =
  // printed book
  | "print_paid" // paid, being illustrated / prepared for the printer
  | "print_producing"
  | "print_shipped"
  | "print_delivered"
  | "print_problem" // Gelato failed / parcel returned: we're on it
  // digital (PDF only)
  | "digital_preparing"
  | "digital_ready"
  // closed
  | "refunded"
  | "cancelled";

export interface OrderView {
  kind: "print" | "digital";
  phase: OrderPhase;
  /** Index in PRINT_STEPS for the stepper; null = no stepper (digital or closed). */
  stepIndex: number | null;
  /** A full refund was recorded (also on a delivered book kept for its history). */
  refunded: boolean;
  /** "Descargar PDF" works: order still active and the PDF exists. */
  canDownload: boolean;
  /** "Comprar otra copia" makes sense (a finished, not closed, order). */
  canReorder: boolean;
}

const PHYSICAL = new Set(["softcover", "hardcover"]);
const ACTIVE = new Set(["paid", "producing", "shipped", "delivered"]);

export function orderView(o: OrderViewInput): OrderView {
  const kind = PHYSICAL.has(o.format) ? "print" : "digital";
  const refunded = o.status === "refunded" || !!o.refunded_at;
  const active = ACTIVE.has(o.status);
  const canDownload = active && o.pdf_ready;

  if (o.status === "refunded") {
    return { kind, phase: "refunded", stepIndex: null, refunded, canDownload: false, canReorder: o.pdf_ready };
  }
  if (!active) {
    return { kind, phase: "cancelled", stepIndex: null, refunded, canDownload: false, canReorder: false };
  }

  if (kind === "digital") {
    // Digital orders leave 'paid' once the "book ready" email is out; the PDF is the delivery.
    const ready = o.pdf_ready;
    return {
      kind,
      phase: ready ? "digital_ready" : "digital_preparing",
      stepIndex: null,
      refunded,
      canDownload,
      canReorder: ready,
    };
  }

  const gelato = (o.gelato_status ?? "").toLowerCase();
  const problem = (gelato === "failed" || gelato === "returned") && o.status !== "delivered";
  const stepIndex = Math.max(0, PRINT_STEPS.indexOf(o.status as PrintStep));
  return {
    kind,
    phase: problem ? "print_problem" : (`print_${PRINT_STEPS[stepIndex]}` as OrderPhase),
    stepIndex,
    refunded,
    canDownload,
    canReorder: o.pdf_ready,
  };
}
