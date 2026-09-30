import { notFound } from "next/navigation";
import { OrdersHarness } from "./OrdersHarness";

/**
 * DEV-ONLY visual harness for the library's orders tab (404 in production builds).
 * Renders every order state from fixtures, no API or auth involved.
 * /es/dev/orders · /es/dev/orders?only=printing,shipped
 */
export default async function OrdersDevPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  return <OrdersHarness only={q.only} />;
}
