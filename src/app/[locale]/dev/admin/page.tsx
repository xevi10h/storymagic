import { notFound } from "next/navigation";
import { AdminShell } from "@/app/admin/_components/AdminShell";
import { OrderDetailView } from "@/app/admin/_components/OrderDetailView";
import { OrdersListView } from "@/app/admin/_components/OrdersListView";
import { isOrderFilter } from "@/lib/admin/orders-view";
import { FIXTURE_NOW, FIXTURE_ROWS, fixtureDetail } from "./fixtures";

/**
 * DEV-ONLY visual harness for the operator panel with fixture data (404 in production builds).
 * /es/dev/admin                 → order list (?status=problems&q=…)
 * /es/dev/admin?order=<id>      → order detail
 * Never reads the database; actions POST to the real API, which 404s without an operator session.
 */
export default async function AdminDevPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const detail = q.order ? fixtureDetail(q.order) : null;
  return (
    <AdminShell email="ops@example.com">
      {detail ? (
        <OrderDetailView detail={detail} files={{ bookPdf: null, interiorPdf: null, coverPdf: null }} />
      ) : (
        <OrdersListView
          rows={FIXTURE_ROWS}
          filter={isOrderFilter(q.status) ? q.status : "all"}
          q={q.q ?? ""}
          now={FIXTURE_NOW}
          truncated={false}
          error={null}
        />
      )}
    </AdminShell>
  );
}
