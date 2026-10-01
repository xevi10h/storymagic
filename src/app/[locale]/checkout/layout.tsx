import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.pages" });
  return {
    // Own title ("… | Meapica" via the locale layout template), not the home page's.
    title: t("checkout"),
    // noindex: no canonical/hreflang (the layout's would point at the home page).
    alternates: { canonical: null },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
