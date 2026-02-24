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
    <section className="bg-secondary py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-lg bg-[#4E342E] shadow-xl">
          <div className="grid lg:grid-cols-2">
            {/* Left — Polaroid product shot */}
            <div className="flex flex-col items-center justify-center p-8 sm:p-12">
              <div className="relative">
                <div className="rotate-2 rounded-lg bg-white p-4 pb-10 shadow-xl transition-transform hover:rotate-0">
                  <div className="flex h-60 w-50 items-center justify-center rounded bg-cream sm:h-70 sm:w-60">
                    <span className="text-7xl">🎁</span>
                  </div>
                  <p className="mt-2 text-center font-display text-sm text-text-soft">
                    Pack Aventura Artesanal
                  </p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <span className="inline-flex rounded-full bg-[#8D6E63] px-4 py-1.5 font-display text-sm font-bold text-white">
                  +12,90€
                </span>
                <p className="mt-2 text-sm text-[#D7CCC8]">
                  Añádelo a cualquier libro
                </p>
              </div>
            </div>

            {/* Right — Details */}
            <div className="p-8 sm:p-12">
              <span className="text-sm font-bold uppercase tracking-widest text-[#D2691E]">
                Experiencia completa
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
                Haz que abrir el paquete sea parte de la magia
              </h2>
              <p className="mt-3 text-[#D7CCC8]">
                Convierte la llegada del libro en un momento inolvidable con
                extras artesanales diseñados para cada historia.
              </p>

              <div className="mt-8 space-y-6">
                {PACK_ITEMS.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#5D4037]">
                      <item.icon className="h-5 w-5 text-[#D2691E]" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-[#D7CCC8]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/crear"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-700"
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
