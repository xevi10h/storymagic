import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";
import { adminServiceClient, getAdminOrderDetail } from "@/lib/admin/data";
import { OrderDetailView } from "../../_components/OrderDetailView";

export const dynamic = "force-dynamic";

/** 10-minute signed links for the operator to open the book / print files. */
async function signPdfs(paths: Array<string | null>): Promise<Array<string | null>> {
  const storage = adminServiceClient().storage.from("book-pdfs");
  return Promise.all(
    paths.map(async (p) => {
      if (!p || /^https?:/i.test(p)) return null;
      const { data } = await storage.createSignedUrl(p, 600);
      return data?.signedUrl ?? null;
    }),
  );
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export default async function AdminOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  await requireAdminPage();
  const { orderId } = await params;
  const detail = await getAdminOrderDetail(orderId);
  if (!detail) notFound();
  const o = detail.order as Record<string, unknown>;
  const [bookPdf, interiorPdf, coverPdf] = await signPdfs([
    detail.story?.pdf_url ?? null,
    str(o.print_interior_path),
    str(o.print_cover_path),
  ]);
  return <OrderDetailView detail={detail} files={{ bookPdf, interiorPdf, coverPdf }} />;
}
