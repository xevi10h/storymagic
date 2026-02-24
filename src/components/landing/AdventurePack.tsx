import { Mail, Sticker, Bookmark } from "lucide-react";
import Link from "next/link";

const PACK_ITEMS = [
  {
    icon: Mail,
    title: "Carta personalizada",
    description:
      'Una carta escrita "por el personaje" del cuento, dirigida a tu hijo por su nombre.',
  },
  {
    icon: Sticker,
    title: "Pegatinas mate",
    description:
      "Set de pegatinas con los personajes de la aventura. Acabado mate premium.",
  },
  {
    icon: Bookmark,
    title: "Marcapáginas de madera",
    description:
      "Marcapáginas artesanal grabado con el nombre del niño. Un recuerdo único.",
  },
];

export default function AdventurePack() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-brand/10 bg-white shadow-sm">
          <div className="grid lg:grid-cols-2">
            <div className="bg-gradient-to-br from-brand/5 to-amber-50 p-8 sm:p-12 flex flex-col items-center justify-center">
              <div className="text-center">
                <span className="text-7xl">🎁</span>
                <p className="mt-4 text-2xl font-bold text-text-primary">
                  Pack Aventura
                  <br />
                  Artesanal
                </p>
                <div className="mt-4 inline-flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-brand">
                    +12,90€
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  Añádelo a cualquier libro
                </p>
              </div>
            </div>

            <div className="p-8 sm:p-12">
              <span className="text-sm font-bold tracking-widest text-brand uppercase">
                Experiencia completa
              </span>
              <h2 className="mt-3 text-2xl font-bold text-text-primary sm:text-3xl">
                Haz que abrir el paquete sea parte de la magia
              </h2>
              <p className="mt-3 text-text-secondary">
                Convierte la llegada del libro en un momento inolvidable con
                extras artesanales diseñados para cada historia.
              </p>

              <div className="mt-8 space-y-6">
                {PACK_ITEMS.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream">
                      <item.icon className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/crear"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Crear con Pack Aventura
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
