import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { maskEmail, unsubscribeKey, verifyUnsubscribeToken } from "@/lib/marketing/unsubscribe-token";
import { UnsubscribeClient } from "./UnsubscribeClient";

// Unsubscribe from offers by email (link in every commercial email, LSSI art. 22.1).
// Opening the page never unsubscribes by itself (link scanners open URLs): the button
// POSTs to /api/email/unsubscribe. Private token in the URL: never indexed or cached.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    referrer: "no-referrer",
  };
}

function readToken(raw: string | string[] | undefined): string | null {
  return typeof raw === "string" && raw ? raw : null;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const token = readToken((await searchParams).t);
  let email: string | null = null;
  try {
    email = verifyUnsubscribeToken(token, unsubscribeKey());
  } catch {
    email = null;
  }

  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[70dvh] flex-col items-center bg-paper px-4 pb-16 sm:px-6"
        style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 3rem)" }}
      >
        <UnsubscribeClient token={email ? token : null} maskedEmail={email ? maskEmail(email) : null} />
      </main>
      <Footer />
    </>
  );
}
