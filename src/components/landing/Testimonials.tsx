import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Laura M.",
    location: "Madrid",
    text: "Mi hija no paraba de señalarse en cada página. Se lo lee todas las noches antes de dormir. El mejor regalo que le hemos hecho.",
    rating: 5,
    borderColor: "border-l-primary",
  },
  {
    name: "Carlos R.",
    location: "Barcelona",
    text: "La calidad del papel y las ilustraciones es increíble. Se nota que no es un libro genérico. Nuestro hijo se siente realmente especial.",
    rating: 5,
    borderColor: "border-l-accent",
  },
  {
    name: "Ana P.",
    location: "Valencia",
    text: "Compramos la versión de tapa dura con el Pack Aventura. El unboxing fue mágico, mi hijo no se lo creía. Repetiremos seguro.",
    rating: 5,
    borderColor: "border-l-secondary",
  },
];

export default function Testimonials() {
  return (
    <section id="familias" className="bg-cream py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            Familias
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold text-text-main">
            Lo que dicen las familias
          </h2>
          <p className="mt-4 text-lg text-text-soft">
            Más de cien familias ya han creado su propia aventura.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className={`rounded-lg border border-stone-100 border-l-4 ${testimonial.borderColor} bg-white p-8 shadow-sm`}
            >
              <div className="flex gap-0.5">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <p className="mt-4 leading-relaxed text-text-soft">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-badge-bg font-display font-bold text-primary">
                  {testimonial.name[0]}
                </div>
                <div>
                  <p className="font-display font-semibold text-text-main">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-text-muted">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
