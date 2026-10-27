import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import AdventCalendar, { type AdventDoorData } from "@/components/advent/AdventCalendar";
import { SITE_URL } from "@/lib/product-facts";
import { getTemplateConfig, isTemplateAvailable } from "@/lib/create-store";
import { parseDateOverride, SEASON_NOW_HEADER, spainToday } from "@/lib/shipping";
import { ADVENT_END, ADVENT_LOCALES, ADVENT_PATH, adventAlternates, compilationReady, doorState, isAdventLocale } from "@/lib/advent/calendar";
import { ADVENT_DOORS } from "@/lib/advent/stories";
import { adventOffer } from "@/lib/advent/offer";

// Doors open at midnight (Spain): re-render at most every 10 minutes. Story text is sent
// only for open doors, so a locked door cannot be read from the page source.
export const revalidate = 600;

type PageProps = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return ADVENT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAdventLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "advent" });
  const url = `${SITE_URL}/${locale}${ADVENT_PATH}`;
  const title = t("metaTitle");
  const description = t("metaDescription");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: adventAlternates(SITE_URL) },
    openGraph: { title, description, url, type: "website", locale: locale === "ca" ? "ca_ES" : "es_ES" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** Render date: Spain today; in dev the "?now=" override (middleware header), like the Navbar. */
async function renderToday(): Promise<{ today: string; devNow: string | null }> {
  if (process.env.NODE_ENV !== "production") {
    const forced = parseDateOverride((await headers()).get(SEASON_NOW_HEADER));
    if (forced) return { today: forced, devNow: forced };
  }
  return { today: spainToday(), devNow: null };
}

export default async function AdventPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isAdventLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "advent" });
  const ts = await getTranslations({ locale, namespace: "seo" });
  const { today, devNow } = await renderToday();

  const doors: AdventDoorData[] = ADVENT_DOORS.map((d, i) => {
    const door = i + 1;
    const state = doorState(door, today);
    return { door, state, art: d.art, artAlt: d.artAlt[locale], template: state === "locked" ? null : d.stories[locale] };
  });

  const reyes = getTemplateConfig("reyes");
  const reyesUntil =
    reyes?.availableUntil && isTemplateAvailable(reyes, today)
      ? new Intl.DateTimeFormat(locale === "ca" ? "ca-ES" : "es-ES", { timeZone: "UTC", day: "numeric", month: "long" }).format(
          new Date(`${reyes.availableUntil}T00:00:00Z`),
        )
      : null;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: ts("common.breadcrumbHome"), url: `${SITE_URL}/${locale}` },
          { name: t("breadcrumb"), url: `${SITE_URL}/${locale}${ADVENT_PATH}` },
        ]}
      />
      <Navbar />
      <main className="bg-paper" style={{ paddingTop: "var(--landing-nav-h, 56px)" }}>
        <AdventCalendar
          locale={locale}
          devNow={devNow}
          doors={doors}
          offer={adventOffer(today, locale)}
          reyesUntil={reyesUntil}
          compilation={compilationReady(today)}
          // The last email goes out on the morning of the 24th: no sign-up after that.
          signupOpen={today < ADVENT_END}
        />
      </main>
      <Footer />
    </>
  );
}
