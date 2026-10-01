import { Plus_Jakarta_Sans, Fredoka } from "next/font/google";
import localFont from "next/font/local";
import "../globals.css";
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

// Material Symbols Outlined, self-hosted subset of the icons the app uses (~90 KB
// instead of Google's 1.1 MB full font behind a render-blocking stylesheet).
// Regenerate after adding an icon: node scripts/material-symbols-subset.mjs.
// display: block (Google's guidance for icon fonts): ligature names never flash as
// words; the 1em box in globals.css keeps the invisible fallback from shifting layout.
const materialSymbols = localFont({
  src: "../../fonts/material-symbols-outlined.woff2",
  variable: "--font-material-symbols",
  weight: "100 700",
  display: "block",
  adjustFontFallback: false,
  fallback: [],
});

/**
 * The <html>/<body> document shared by every root layout. There are several root
 * layouts ([locale]/layout.tsx, admin/layout.tsx) plus the unlocalized not-found,
 * because only a layout under the [locale] segment can know the locale at render
 * time: this is what makes the server HTML carry the right `lang` per locale.
 * src/app/layout.tsx is a pass-through.
 */
export default function RootDocument({ lang, children }: { lang: string; children: React.ReactNode }) {
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
      </head>
      <body
        className={`${plusJakarta.variable} ${fredoka.variable} ${materialSymbols.variable} font-sans bg-paper overflow-x-hidden relative text-text-main antialiased`}
      >
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  );
}
