import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { AdminShell } from "./_components/AdminShell";

// Internal operator panel. Non-operators get the 404 page (requireAdminPage); each
// page re-checks too, since layouts and pages render in parallel.
export const metadata: Metadata = {
  title: "Operaciones · Meapica",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
