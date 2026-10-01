import type { Metadata } from "next";

export const metadata: Metadata = {
  // noindex: no canonical/hreflang (the layout's would point at the home page).
  alternates: { canonical: null },
  robots: {
    index: false,
    follow: false,
  },
};

export default function PerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
