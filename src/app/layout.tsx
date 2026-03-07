import { Plus_Jakarta_Sans, Fredoka } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  display: "swap",
});

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<{ locale?: string }>;
}>) {
  // Extract locale from the URL segment for the lang attribute
  const resolvedParams = params ? await params : undefined;
  const lang = resolvedParams?.locale || "es";

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${fredoka.variable} font-sans bg-cream overflow-x-hidden relative text-text-main antialiased`}
      >
        <div className="texture-overlay" />
        <div className="relative z-[1]">
          {children}
        </div>
      </body>
    </html>
  );
}
