import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { isAdventLocale } from "@/lib/advent/calendar";
import AdventUnsubscribeClient from "@/components/advent/AdventUnsubscribeClient";

// Stop the Advent daily email (link in every one). Opening the page never unsubscribes by
// itself (link scanners open URLs): the button POSTs to /api/advent/unsubscribe. Private
// token in the URL: never indexed or cached.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAdventLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "advent.unsubscribe" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
    alternates: { canonical: null },
  };
}

export default async function AdventUnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isAdventLocale(locale)) notFound();
  const raw = (await searchParams).t;
  const token = typeof raw === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(raw) ? raw : null;
  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[70dvh] flex-col items-center bg-paper px-4 pb-16 sm:px-6"
        style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 3rem)" }}
      >
        <AdventUnsubscribeClient token={token} />
      </main>
      <Footer />
    </>
  );
}
