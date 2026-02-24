import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function CollectionOffer() {
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-center">
          <div className="relative">
            {/* Double border effect */}
            <div className="absolute -inset-3 rounded-lg border-2 border-dashed border-stone-300" />
            <div className="relative rotate-1 overflow-hidden rounded-lg bg-secondary p-10 text-center text-white shadow-xl transition-transform hover:rotate-0 sm:p-16">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#8D6E63] px-4 py-1.5 text-sm font-bold">
                Oferta colección
              </span>

              <h2 className="mt-6 font-display text-3xl font-bold sm:text-4xl">
                3 libros ={" "}
                <span className="text-[#D2691E]">20% descuento</span>
              </h2>

              <p className="mx-auto mt-4 max-w-lg text-lg text-[#D7CCC8]">
                Crea una saga para tu hijo. Tres aventuras, un mismo héroe. Cada
                libro una nueva historia, un nuevo mundo por descubrir.
              </p>

              <div className="mt-8">
                <Link
                  href="/crear"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-700"
                >
                  Crear mi colección
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <p className="mt-6 text-sm text-[#A1887F]">
                El descuento se aplica automáticamente al añadir 3 libros al
                carrito.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
