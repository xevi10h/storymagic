import { ImageResponse } from "next/og";
import { routing } from "@/i18n/routing";

export const runtime = "edge";

export const alt = "Meapica — Personalized Children's Books";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const taglines: Record<string, string> = {
  es: "Historias Reales para Tocar",
  ca: "Histories Reals per Tocar",
  en: "Real Stories You Can Touch",
  fr: "De Vraies Histoires a Toucher",
};

const subtitles: Record<string, string> = {
  es: "Cuentos personalizados impresos en papel de alta calidad",
  ca: "Contes personalitzats impresos en paper d'alta qualitat",
  en: "Personalized stories printed on premium paper",
  fr: "Contes personnalises imprimes sur du papier de haute qualite",
};

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tagline = taglines[locale] || taglines.es;
  const subtitle = subtitles[locale] || subtitles.es;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F9F5F0",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "linear-gradient(90deg, #D2691E, #E8976B, #D2691E)",
          }}
        />

        {/* Logo area */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: "#D2691E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <span
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#2D1810",
              letterSpacing: "-1px",
            }}
          >
            meapica
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "#D2691E",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          {tagline}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: "#6B5B4F",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 18,
            color: "#9B8A7E",
            letterSpacing: "2px",
          }}
        >
          meapica.com
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
