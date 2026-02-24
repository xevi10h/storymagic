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
    <section id="artesanal" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left — Image with tilted decorative layer */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              {/* Tilted background */}
              <div className="absolute -inset-3 -rotate-2 rounded-lg bg-badge-bg" />
              {/* Main card */}
              <div className="relative rounded-lg bg-paper p-10 shadow-sm">
                <div className="absolute -top-4 -right-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                  <div className="text-center">
                    <p className="font-display text-lg font-bold leading-none">
                      170g
                    </p>
                    <p className="text-[10px] uppercase tracking-wide">papel</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <span className="text-7xl">📕</span>
                  <p className="mt-6 font-display text-xl font-bold text-text-main">
                    21×21 cm
                  </p>
                  <p className="mt-1 text-sm text-text-soft">
                    Formato cuadrado infantil estándar
                  </p>
                  <p className="mt-4 text-sm text-text-muted">
                    24-32 páginas · Full color · Lomo cosido
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Text */}
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-primary">
              Calidad artesanal
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold text-text-main">
              No es un libro más.
              <br />
              Es un tesoro.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              Cada libro de StoryMagic se imprime con materiales premium y
              acabados que puedes sentir al tacto. Porque un cuento especial
              merece un objeto especial.
            </p>

            <div className="mt-10 space-y-8">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-badge-bg">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-text-main">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-soft">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
