import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function AdventurePack() {
  const t = useTranslations("adventurePack");

  return (
    <section className="relative overflow-hidden bg-pack-bg py-24 text-pack-text">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "url('/images/adventure-pack-bg.png')",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-12 rounded-2xl border border-border-warm bg-pack-inner p-8 shadow-2xl md:flex-row md:p-16">
          {/* Left — Text */}
          <div className="flex-1 text-center md:text-left">
            <span className="mb-4 inline-block rounded bg-pack-badge px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              {t("badge")}
            </span>
            <h2 className="mb-6 font-display text-3xl font-bold text-white md:text-5xl">
              {t("title")}
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-pack-muted">
              {t("description")}{" "}
              <strong className="text-white">{t("letter")}</strong> {t("descriptionEnd")}
            </p>
            <Link
              href="/crear"
              className="mx-auto flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-primary-hover md:mx-0"
            >
              <span className="material-symbols-outlined">card_giftcard</span>
              {t("cta")}
            </Link>
          </div>

          {/* Right — Polaroid image */}
          <div className="relative flex-1">
            <div className="rotate-2 bg-white p-3 shadow-xl transition-transform duration-300 hover:rotate-0">
              <Image
                alt="Gift set with book, stickers and coloring pencils on a table"
                className="h-auto w-full sepia-[0.2]"
                src="/images/gift-set.png"
                width={512}
                height={512}
              />
              <div className="pt-3 pb-1 text-center font-display text-gray-500">
                {t("imageCaption")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
