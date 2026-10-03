import { ImageResponse } from "next/og";
import { createTranslator, hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * Translator for share images. `generateImageMetadata` runs outside a request scope
 * (build-time page-data collection), where next-intl's `getTranslations` cannot run
 * (its request config reads `headers()`), so the messages are loaded directly.
 */
export async function ogTranslator(locale: string, namespace: string) {
  const loc = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const messages = (await import(`../messages/${loc}.json`)).default as Record<string, unknown>;
  // Message keys are not statically typed in this project (dynamic keys everywhere).
  return createTranslator({ locale: loc, messages, namespace } as Parameters<typeof createTranslator>[0]) as unknown as (
    key: string,
    values?: Record<string, string | number | Date>,
  ) => string;
}

// Shared Open Graph image renderer for programmatic-SEO pages.
// Matches the brand OG style (cream bg, warm gradient bar, Meapica mark).
export const SEO_OG_SIZE = { width: 1200, height: 630 };
export const SEO_OG_CONTENT_TYPE = "image/png";

/**
 * `generateImageMetadata` result of a share image: one image whose alt text is in
 * the page's language ("Meapica — {headline}", the words drawn on it). A static
 * `export const alt` cannot depend on the locale.
 */
export function ogImageMetadata(headline: string) {
  return [{ id: "og", alt: `Meapica — ${headline}`, size: SEO_OG_SIZE, contentType: SEO_OG_CONTENT_TYPE }];
}

export function seoOgImage({
  eyebrow,
  headline,
}: {
  eyebrow: string;
  headline: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 90px",
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

        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#D2691E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <span
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: "#2D1810",
              letterSpacing: "-1px",
            }}
          >
            meapica
          </span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#D2691E",
            textTransform: "uppercase",
            letterSpacing: "3px",
            marginBottom: 20,
          }}
        >
          {eyebrow}
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 800,
            color: "#2D1810",
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            maxWidth: 1000,
          }}
        >
          {headline}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 90,
            fontSize: 20,
            color: "#9B8A7E",
            letterSpacing: "2px",
          }}
        >
          meapica.shop
        </div>
      </div>
    ),
    { ...SEO_OG_SIZE },
  );
}
