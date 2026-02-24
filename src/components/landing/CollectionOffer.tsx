import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CollectionOffer() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-br from-text-primary to-[#2a2a4a] p-10 text-center text-white shadow-xl sm:p-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            Oferta colección
          </span>

          <h2 className="mt-6 text-3xl font-bold sm:text-4xl">
            3 libros = <span className="text-brand-light">20% descuento</span>
          </h2>

          <p className="mx-auto mt-4 max-w-lg text-lg text-gray-300">
            Crea una saga para tu hijo. Tres aventuras, un mismo héroe. Cada
            libro una nueva historia, un nuevo mundo por descubrir.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/crear"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Crear mi colección
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-400">
            El descuento se aplica automáticamente al añadir 3 libros al
            carrito.
          </p>
        </div>
      </div>
    </section>
  );
}
