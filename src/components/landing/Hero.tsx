import { ArrowRight, Leaf, Truck } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="torn-edge-bottom relative overflow-hidden bg-cream pt-28 pb-28 sm:pt-36 sm:pb-36">
      {/* Ambient blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-[10%] h-80 w-80 rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute right-[5%] bottom-20 h-96 w-96 rounded-full bg-amber-200/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text */}
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-badge-border bg-badge-bg px-4 py-1.5 text-sm font-semibold text-secondary">
              <Leaf className="h-4 w-4" />
              Papel FSC certificado
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-text-main lg:text-7xl">
              Menos pantallas,
              <br />
              <span className="text-primary">más historias</span>
              <br />
              para tocar.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-text-soft">
              Crea un cuento ilustrado único donde tu hijo es el protagonista.
              Personalizado, impreso con calidad artesanal y enviado a tu
              puerta.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/crear"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-xl"
              >
                Personalizar libro
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#artesanal"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-8 py-3.5 text-base font-bold text-text-main transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                Ver calidad del papel
              </a>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-text-muted">
              <span className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-green-700" />
                Papel FSC
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary" />
                Envío artesanal
              </span>
            </div>
          </div>

          {/* Polaroid book mockup */}
          <div className="relative flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-4 -rotate-2 rounded-lg bg-badge-bg" />
              <div className="relative rotate-1 rounded-lg bg-white p-4 pb-12 shadow-xl transition-transform hover:rotate-0">
                <div className="flex h-[340px] w-[280px] items-center justify-center rounded bg-cream sm:h-[400px] sm:w-[340px]">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-sm sm:h-32 sm:w-32">
                      <span className="text-5xl sm:text-6xl">📖</span>
                    </div>
                    <p className="font-display text-lg font-bold text-text-main">
                      Tu hijo, el protagonista
                    </p>
                    <p className="mt-2 text-sm text-text-muted">
                      Cada ilustración, cada detalle,
                      <br />
                      creado para hacer magia.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-center font-display text-sm text-text-soft">
                  Un cuento hecho solo para ti
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
