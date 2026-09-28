// Delivery times and order cut-offs for printed books (feeds "¿Llega a tiempo para
// Reyes?"). Shared by client and server — no server-only imports.
//
// Source: live Gelato quotes (POST /v4/orders:quote, 30 inner pages, cheapest
// method = the one createPrintOrder picks), 2026-09-28: 7-8 days door to door.
// Customer copy promises 7-10 business days; cut-offs use the measured days + buffer.
// Both formats quote identically today; kept per format because they may diverge.
// Re-quote before each campaign (Gelato publishes peak-season cut-offs in November).

import type { PhysicalFormat } from "./pricing";

/** Where we ship (decision 2026-09-28: Spain without Canarias, Ceuta, Melilla). */
export type ShippingRegion = "peninsula" | "baleares";

export const DELIVERY_DAYS: Record<PhysicalFormat, Record<ShippingRegion, { min: number; max: number }>> = {
  hardcover: { peninsula: { min: 7, max: 8 }, baleares: { min: 7, max: 8 } },
  softcover: { peninsula: { min: 7, max: 8 }, baleares: { min: 7, max: 8 } },
};

/** Extra margin in peak season (carrier backlog, 8 Dec / 25 Dec / 1 Jan holidays). */
export const PEAK_BUFFER_DAYS = 6;

/** Reyes: the book must be home on 5 January. */
export function reyesDeliverBy(year: number): string {
  return `${year}-01-05`;
}

/** Last day (YYYY-MM-DD) to order so the book arrives by `deliverBy` (YYYY-MM-DD). */
export function lastOrderDate(deliverBy: string, format: PhysicalFormat, region: ShippingRegion, bufferDays = PEAK_BUFFER_DAYS): string {
  const d = new Date(`${deliverBy}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DELIVERY_DAYS[format][region].max - bufferDays);
  return d.toISOString().slice(0, 10);
}

/** Every cut-off for one deadline, for the Reyes page / banner. */
export function orderCutoffs(deliverBy: string): Array<{ format: PhysicalFormat; region: ShippingRegion; lastOrderDate: string }> {
  return (Object.keys(DELIVERY_DAYS) as PhysicalFormat[]).flatMap((format) =>
    (Object.keys(DELIVERY_DAYS[format]) as ShippingRegion[]).map((region) => ({
      format,
      region,
      lastOrderDate: lastOrderDate(deliverBy, format, region),
    })),
  );
}
