import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const LOCALE_MAP: Record<string, string> = {
  es: "es_ES",
  ca: "ca_ES",
  en: "en_US",
  fr: "fr_FR",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/images/logo.svg", type: "image/svg+xml" },
      ],
      apple: "/images/apple-touch-icon.png",
    },
    manifest: "/manifest.json",
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      locale: LOCALE_MAP[locale] || "es_ES",
      images: [{ url: "/images/icon-512.png", width: 512, height: 512 }],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
