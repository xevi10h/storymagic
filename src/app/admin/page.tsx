import { requireAdminPage } from "@/lib/admin/auth";
import { listAdminOrders } from "@/lib/admin/data";
import { isOrderFilter, type OrderFilter } from "@/lib/admin/orders-view";
import { OrdersListView } from "./_components/OrdersListView";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const filter: OrderFilter = isOrderFilter(sp.status) ? sp.status : "all";
  const q = (sp.q ?? "").slice(0, 200);
  const { rows, truncated, error, fetchedAt } = await listAdminOrders();
  return <OrdersListView rows={rows} filter={filter} q={q} now={fetchedAt} truncated={truncated} error={error} />;
}
