import { Star } from "lucide-react";
import Link from "next/link";

const BOOKS = [
  {
    id: 1,
    title: "El Bosque Encantado",
    age: "3-6 años",
    description:
      "Secretos entre árboles centenarios y criaturas fantásticas que necesitan ayuda.",
    emoji: "🌲",
    color: "bg-[#E8F5E9]",
  },
  {
    id: 2,
    title: "Misión Espacial",
    age: "4-7 años",
    description:
      "Un viaje entre estrellas, planetas desconocidos y amigos de otras galaxias.",
    emoji: "🚀",
    color: "bg-[#E8EAF6]",
  },
  {
    id: 3,
    title: "El Reino Submarino",
    age: "3-7 años",
    description:
      "Aventuras bajo el mar, entre corales luminosos y criaturas mágicas.",
    emoji: "🐚",
    color: "bg-[#E0F7FA]",
  },
];

export default function BookCollection() {
  return (
    <section id="coleccion" className="bg-cream py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-widest text-primary">
            Colección
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold text-text-main">
            Nuestra colección
          </h2>
          <p className="mt-4 text-lg text-text-soft">
            Historias diseñadas para despertar la imaginación. Cada una con su
            propio universo de aventuras.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {BOOKS.map((book) => (
            <div
              key={book.id}
              className="group overflow-hidden rounded-lg border border-stone-100 bg-white p-4 pb-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Book cover with sepia tint */}
              <div
                className={`${book.color} flex aspect-3/4 items-center justify-center rounded sepia-[0.1]`}
              >
                <span className="text-8xl transition-transform group-hover:scale-110">
                  {book.emoji}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-primary">
                    {book.age}
                  </span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                </div>

                <h3 className="mt-3 font-display text-xl font-bold text-text-main">
                  {book.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-soft">
                  {book.description}
                </p>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-text-muted">Desde</p>
                    <p className="font-display text-2xl font-bold text-text-main">
                      34,90€
                    </p>
                  </div>
                  <Link
                    href="/crear"
                    className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-orange-700"
                  >
                    Crear
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-text-muted">
            Tapa blanda{" "}
            <span className="font-semibold text-text-main">34,90€</span>
            &nbsp;&nbsp;·&nbsp;&nbsp;Tapa dura premium{" "}
            <span className="font-semibold text-text-main">49,90€</span>
          </p>
        </div>
      </div>
    </section>
  );
}
