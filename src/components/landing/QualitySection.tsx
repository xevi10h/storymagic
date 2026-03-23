import Image from "next/image";
import { useTranslations } from "next-intl";

export default function QualitySection() {
  const t = useTranslations("quality");

  return (
    <section className="relative overflow-hidden bg-white py-24" id="artisanal">
      <div className="torn-paper-top" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          {/* Left — Image with decorative backing */}
          <div className="relative lg:w-1/2">
            <div className="absolute -top-6 -left-6 -z-10 h-full w-full -rotate-2 rounded-lg border border-border-medium bg-tan" />
            <Image
              alt="Close up of high quality book binding and thick paper pages"
              className="h-125 w-full rounded-lg object-cover shadow-2xl sepia-[0.15]"
              src="/images/book-binding.png"
              width={512}
              height={512}
            />
            {/* Floating eco badge */}
            <div className="absolute -right-6 -bottom-10 w-48 rotate-3 border border-border-light bg-white p-6 shadow-xl">
              <div className="flex flex-col items-center text-center">
                <span className="material-symbols-outlined mb-2 text-4xl text-success">eco</span>
                <span className="text-sm font-bold text-secondary">
                  {t("ecoLabel")}
                </span>
              </div>
            </div>
          </div>

          {/* Right — Text content */}
          <div className="flex flex-col gap-8 lg:w-1/2">
            <span className="text-sm font-bold uppercase tracking-widest text-primary">
              {t("badge")}
            </span>
            <h2 className="font-display text-4xl font-bold leading-tight text-secondary">
              {t("title")}
            </h2>
            <p className="text-lg text-text-soft">
              {t("description")}
            </p>

            <div className="mt-4 space-y-8">
              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-secondary text-secondary">
                  <span className="material-symbols-outlined">book</span>
                </div>
                <div>
                  <h3 className="mb-1 font-display text-xl font-bold text-secondary">
                    {t("bindingTitle")}
                  </h3>
                  <p className="text-sm text-text-soft">
                    {t("bindingDescription")}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-secondary text-secondary">
                  <span className="material-symbols-outlined">texture</span>
                </div>
                <div>
                  <h3 className="mb-1 font-display text-xl font-bold text-secondary">
                    {t("paperTitle")}
                  </h3>
                  <p className="text-sm text-text-soft">
                    {t("paperDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="torn-paper-bottom" />
    </section>
  );
}
