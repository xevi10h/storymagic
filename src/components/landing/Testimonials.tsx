import { useTranslations } from "next-intl";

const TESTIMONIALS = [
  {
    key: "laura" as const,
    initials: "LM",
    borderColor: "border-l-primary",
  },
  {
    key: "carlos" as const,
    initials: "CR",
    borderColor: "border-l-secondary",
  },
  {
    key: "marta" as const,
    initials: "MP",
    borderColor: "border-l-gold",
  },
];

export default function Testimonials() {
  const t = useTranslations("testimonials");

  return (
    <section className="relative bg-cream py-24" id="reviews">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="mb-4 font-display text-4xl font-bold text-secondary">
          {t("title")}
        </h2>
        <p className="mb-16 text-text-soft">
          {t("subtitle")}
        </p>

        <div className="grid grid-cols-1 gap-8 text-left md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.key}
              className={`relative rounded-lg border-l-4 bg-white p-8 shadow-sm ${testimonial.borderColor}`}
            >
              <div className="mb-4 text-xs tracking-widest text-gold">★★★★★</div>
              <p className="relative z-10 mb-6 font-serif text-lg italic text-text-main">
                &ldquo;{t(`reviews.${testimonial.key}.text`)}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-earth font-display font-bold text-secondary">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-secondary">
                    {t(`reviews.${testimonial.key}.name`)}
                  </p>
                  <p className="text-xs text-text-muted">{t(`reviews.${testimonial.key}.subtitle`)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
