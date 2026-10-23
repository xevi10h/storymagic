import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Heading } from "@/components/ui";
import { GUIDES, isGuideLocale } from "@/lib/guides";
import { COPY_PARAMS } from "@/lib/product-facts";
import { seoHubPath } from "@/lib/seo-landing";

const inlineLink =
  "font-semibold text-ink-soft underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-text";

/**
 * Home "¿Qué es un cuento personalizado?": a short server-rendered definition of the
 * head term ("cuentos personalizados" / "contes personalitzats"), with in-text links to
 * the age hub and, where it exists, the Catalan guide. Copy: seo.home.whatIs (server-only
 * namespace, i18n/client-messages.ts). Same reading column as the HubPage guide.
 */
export default async function WhatIsSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "seo.home.whatIs" });
  const count = (t.raw("paragraphs") as string[]).length;
  const tags = {
    ...COPY_PARAMS,
    ages: (chunks: ReactNode) => (
      <Link href={seoHubPath("ages")} className={inlineLink}>
        {chunks}
      </Link>
    ),
    // Only ca copy uses <catalan>; the guide exists in es + ca.
    catalan: (chunks: ReactNode) =>
      isGuideLocale("catalan", locale) ? (
        <Link href={GUIDES.catalan.path} className={inlineLink}>
          {chunks}
        </Link>
      ) : (
        chunks
      ),
  };

  return (
    <section id="what-is" aria-labelledby="what-is-title" className="scroll-mt-[var(--landing-nav-h,64px)] bg-paper px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Heading id="what-is-title" as="h2" size="page" className="text-balance">
          {t("title")}
        </Heading>
        <div className="mt-6 flex flex-col gap-4">
          {Array.from({ length: count }, (_, i) => (
            <p key={i} className="text-base leading-relaxed text-ink-body sm:text-lg sm:leading-[1.75]">
              {t.rich(`paragraphs.${i}`, tags)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
