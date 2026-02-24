import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Laura M.",
    location: "Madrid",
    text: "Mi hija no paraba de señalarse en cada página. Se lo lee todas las noches antes de dormir. El mejor regalo que le hemos hecho.",
    rating: 5,
  },
  {
    name: "Carlos R.",
    location: "Barcelona",
    text: "La calidad del papel y las ilustraciones es increíble. Se nota que no es un libro genérico. Nuestro hijo se siente realmente especial.",
    rating: 5,
  },
  {
    name: "Ana P.",
    location: "Valencia",
    text: "Compramos la versión de tapa dura con el Pack Aventura. El unboxing fue mágico, mi hijo no se lo creía. Repetiremos seguro.",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section id="familias" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Lo que dicen las familias
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Más de cien familias ya han creado su propia aventura.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-cream-dark" />

              <div className="flex gap-0.5">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <p className="mt-4 leading-relaxed text-text-secondary">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream font-bold text-brand">
                  {testimonial.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-text-primary">
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
