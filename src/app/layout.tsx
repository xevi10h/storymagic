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
  title: "StoryMagic — Cuentos Infantiles Personalizados",
  description:
    "Convierte a tu hijo en el protagonista de su propia aventura mágica. Libros ilustrados personalizados, impresos con calidad artesanal.",
  openGraph: {
    title: "StoryMagic — Cuentos Infantiles Personalizados",
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
      <body
        className={`${plusJakarta.variable} ${fredoka.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
