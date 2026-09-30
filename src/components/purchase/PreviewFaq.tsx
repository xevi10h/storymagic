"use client";

import { useTranslations } from "next-intl";
import { SUPPORT_EMAIL } from "@/lib/pricing";

const ITEMS = ["delivery", "canarias", "quality", "changes", "returns"] as const;

/** Five short answers under the buy panel (delivery, Canarias, quality, changes, returns) + help inbox. */
export default function PreviewFaq() {
  const t = useTranslations("crear.purchase");
  return (
    <section aria-labelledby="preview-faq-title" className="mx-auto max-w-2xl">
      <h2 id="preview-faq-title" className="font-display text-lg font-bold text-secondary">
        {t("faqTitle")}
      </h2>
      <div className="mt-3 divide-y divide-create-neutral border-y border-create-neutral">
        {ITEMS.map((id) => (
          <details key={id} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-create-text-dark [&::-webkit-details-marker]:hidden">
              {t(`faq.${id}.q`)}
              <span aria-hidden className="material-symbols-outlined text-lg text-create-text-sub transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <p className="mt-2 pr-8 text-sm leading-relaxed text-create-text-body">{t(`faq.${id}.a`)}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm text-create-text-sub">
        {t("help")}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-create-primary">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
