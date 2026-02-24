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
    bgColor: "bg-emerald-50",
    accentColor: "text-emerald-600",
  },
  {
    id: 2,
    title: "Misión Espacial",
    age: "4-7 años",
    description:
      "Un viaje entre estrellas, planetas desconocidos y amigos de otras galaxias.",
    emoji: "🚀",
    bgColor: "bg-indigo-50",
    accentColor: "text-indigo-600",
  },
  {
    id: 3,
    title: "El Reino Submarino",
    age: "3-7 años",
    description:
      "Aventuras bajo el mar, entre corales luminosos y criaturas mágicas.",
    emoji: "🐚",
    bgColor: "bg-cyan-50",
    accentColor: "text-cyan-600",
  },
];

export default function BookCollection() {
  return (
    <section id="coleccion" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Nuestra colección
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Historias diseñadas para despertar la imaginación. Cada una con su
            propio universo de aventuras.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {BOOKS.map((book) => (
            <div
              key={book.id}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div
                className={`${book.bgColor} flex h-56 items-center justify-center`}
              >
                <span className="text-8xl transition-transform group-hover:scale-110">
                  {book.emoji}
                </span>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${book.accentColor} uppercase tracking-wide`}
                  >
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

                <h3 className="mt-3 text-xl font-bold text-text-primary">
                  {book.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {book.description}
                </p>

                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-text-muted">Desde</p>
                    <p className="text-2xl font-bold text-text-primary">
                      34,90€
                    </p>
                  </div>
                  <Link
                    href="/crear"
                    className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
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
            <span className="font-semibold text-text-primary">34,90€</span>
            &nbsp;&nbsp;·&nbsp;&nbsp; Tapa dura premium{" "}
            <span className="font-semibold text-text-primary">49,90€</span>
          </p>
        </div>
      </div>
    </section>
  );
}
