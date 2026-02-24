import { BookOpen, Layers, Droplets } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Encuadernación tradicional",
    description:
      "Lomo cosido, cubiertas reforzadas. Cada libro está hecho para resistir miles de lecturas.",
  },
  {
    icon: Layers,
    title: "Papel Munken 170g",
    description:
      "Tonos crema cálidos, tacto suave, sin reflejos. El papel que usan los mejores editores infantiles.",
  },
  {
    icon: Droplets,
    title: "Tintas de alta fidelidad",
    description:
      "Colores vibrantes que no se apagan. Cada ilustración se imprime con la calidad que merece.",
  },
];

export default function QualitySection() {
  return (
    <section id="artesanal" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <span className="text-sm font-bold tracking-widest text-brand uppercase">
              Calidad artesanal
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              No es un libro más.
              <br />
              Es un tesoro.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-secondary">
              Cada libro de StoryMagic se imprime con materiales premium y
              acabados que puedes sentir al tacto. Porque un cuento especial
              merece un objeto especial.
            </p>

            <div className="mt-10 space-y-8">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream">
                    <feature.icon className="h-6 w-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="relative h-[400px] w-full max-w-md rounded-2xl bg-cream-dark p-8">
              <div className="absolute -top-4 -right-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                <div className="text-center">
                  <p className="text-lg font-bold leading-none">170g</p>
                  <p className="text-[10px] uppercase tracking-wide">papel</p>
                </div>
              </div>
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="text-7xl">📕</span>
                <p className="mt-6 text-lg font-bold text-text-primary">
                  21×21 cm
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Formato cuadrado infantil estándar
                </p>
                <p className="mt-4 text-sm text-text-muted">
                  24-32 páginas · Full color · Lomo cosido
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
