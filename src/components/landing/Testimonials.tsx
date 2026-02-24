const TESTIMONIALS = [
  {
    initials: "LM",
    name: "Laura M.",
    subtitle: 'Compró "El Bosque Encantado"',
    text: "Por fin algo que no necesita cargador. La calidad del libro es impresionante, parece sacado de una librería antigua pero con mi hijo dentro.",
    borderColor: "border-l-primary",
  },
  {
    initials: "CR",
    name: "Carlos R.",
    subtitle: "Compró Pack Premium",
    text: "El olor a libro nuevo cuando abrimos la caja fue increíble. Los detalles físicos como la carta extra le dieron un toque mágico real.",
    borderColor: "border-l-secondary",
  },
];

export default function Testimonials() {
  return (
    <section className="relative bg-[#F9F5F0] py-24" id="reviews">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="mb-4 font-display text-4xl font-bold text-secondary">
          Familias Desconectadas
        </h2>
        <p className="font-body mb-16 text-text-soft">
          Lo que dicen los padres que han elegido papel sobre píxeles.
        </p>

        <div className="grid grid-cols-1 gap-8 text-left md:grid-cols-2">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className={`relative rounded-lg border-l-4 bg-white p-8 shadow-sm ${testimonial.borderColor}`}
            >
              <div className="mb-4 text-xs tracking-widest text-yellow-500">★★★★★</div>
              <p className="relative z-10 mb-6 font-serif text-lg italic text-text-main">
                &ldquo;{testimonial.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 font-display font-bold text-secondary">
                  {testimonial.initials}
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-secondary">
                    {testimonial.name}
                  </p>
                  <p className="font-body text-xs text-stone-500">{testimonial.subtitle}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
