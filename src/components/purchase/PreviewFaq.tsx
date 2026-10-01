"use client";

import { useTranslations } from "next-intl";
import { SUPPORT_EMAIL } from "@/lib/pricing";
import { COPY_PARAMS } from "@/lib/product-facts";

const ITEMS = ["delivery", "canarias", "quality", "changes", "returns"] as const;

/** Five short answers under the buy panel (delivery, Canarias, quality, changes, returns) + help inbox. */
export default function PreviewFaq() {
  const t = useTranslations("crear.purchase");
  return (
    <section aria-labelledby="preview-faq-title">
      <h2 id="preview-faq-title" className="font-display text-xl font-bold text-secondary">
        {t("faqTitle")}
      </h2>
      <div className="mt-4 divide-y divide-create-neutral overflow-hidden rounded-2xl bg-white ring-1 ring-create-neutral">
        {ITEMS.map((id) => (
          <details key={id} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-create-text-dark transition-colors hover:text-brand-text sm:px-6 sm:text-[15px] [&::-webkit-details-marker]:hidden">
              {t(`faq.${id}.q`)}
              <span aria-hidden className="material-symbols-outlined text-xl text-create-text-sub transition-transform group-open:rotate-180">
                expand_more
              </span>
            </summary>
            <p className="-mt-1 px-5 pb-4 pr-12 text-sm leading-relaxed text-create-text-body sm:px-6 sm:pr-14">{t(`faq.${id}.a`, COPY_PARAMS)}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm text-create-text-sub">
        {t("help")}{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-secondary underline decoration-secondary/30 underline-offset-2 hover:text-brand-text">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
