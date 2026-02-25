import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "StoryMagic — Historias Reales para Tocar",
  description:
    "Recupera la magia de pasar las páginas. Cuentos personalizados impresos en papel de alta calidad, diseñados para crear momentos de conexión real.",
  openGraph: {
    title: "StoryMagic — Historias Reales para Tocar",
    description:
      "Menos pantallas, más historias para tocar. Crea un cuento único donde tu hijo es el héroe.",
    type: "website",
    locale: "es_ES",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
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
