import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function CollectionOffer() {
  const t = useTranslations("collectionOffer");

  return (
    <section className="overflow-x-hidden px-4 py-20">
      <div className="relative mx-auto max-w-5xl rotate-1 border-2 border-border-light bg-white p-2 shadow-2xl">
        <div
          className="relative overflow-hidden border border-border-medium p-8 text-center md:p-16"
          style={{
            backgroundImage:
              "url('https://www.transparenttextures.com/patterns/cream-paper.png')",
          }}
        >
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="mb-2 block text-sm font-bold uppercase tracking-widest text-primary">
              {t("badge")}
            </span>
            <h2 className="mb-6 font-display text-4xl font-bold text-secondary md:text-5xl">
              {t("title")}
            </h2>
            <p className="mb-8 font-serif text-xl italic text-text-soft whitespace-pre-line">
              {t("description")}
            </p>
            <Link
              href="/crear"
              className="mx-auto inline-flex items-center gap-2 rounded bg-secondary px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-secondary-hover"
            >
              {t("cta")}
              <span className="material-symbols-outlined">auto_stories</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
