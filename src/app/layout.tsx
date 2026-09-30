import { Plus_Jakarta_Sans, Fredoka } from "next/font/google";
import "./globals.css";
import { DISMISSED_HEAD_SCRIPT } from "@/components/seasonal/season-scripts";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  // latin-ext: children's names like Ștefan, Łucja or Ŀlúcia render in the brand face
  subsets: ["latin", "latin-ext"],
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
    <html
      lang={lang}
      suppressHydrationWarning
      // globals.css sets smooth scrolling for in-page anchors; this tells Next to
      // turn it off during route transitions (Next 16 warns otherwise).
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Meta Business domain verification (meapica.shop, meapica.com): both domains serve this app. */}
        <meta name="facebook-domain-verification" content="xamhnc5w6k5kwarz1luu169unzvup2" />
        <meta name="facebook-domain-verification" content="z5fupvnf0dmkjlx3uo5mxgkz7df78s" />
        {/* Hides a seasonal banner the visitor closed before first paint (no flash, no shift). */}
        <script dangerouslySetInnerHTML={{ __html: DISMISSED_HEAD_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Icon font: display=block (Google's guidance for icon fonts) so the
            ligature names never flash as words; the 1em box in globals.css
            keeps the invisible fallback from shifting layout (CLS).
            App Router root layout = every page, so no-page-custom-font does not apply. */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${plusJakarta.variable} ${fredoka.variable} font-sans bg-paper overflow-x-hidden relative text-text-main antialiased`}
      >
        <div className="relative z-[1]">
          {children}
        </div>
      </body>
    </html>
  );
}
