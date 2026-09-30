import { notFound } from "next/navigation";
import { PurchaseHarness } from "./PurchaseHarness";

/**
 * DEV-ONLY visual harness for the paywall purchase panel and the "Comprar otra copia"
 * sheet (404 in production builds). Fixtures only: no API, no auth, no Stripe.
 * /es/dev/purchase ("Open reorder sheet" opens the sheet)
 */
export default function PurchaseDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PurchaseHarness />;
}
