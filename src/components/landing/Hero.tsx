import { ArrowRight, Leaf, Truck } from "lucide-react";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream pt-28 pb-20 sm:pt-36 sm:pb-28">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-brand-light/20 blur-3xl" />
        <div className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-4 py-1.5 text-sm font-medium text-brand">
              <Leaf className="h-4 w-4" />
              Papel FSC certificado
            </p>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
              Menos pantallas,
              <br />
              <span className="text-brand">más historias</span>
              <br />
              para tocar.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-text-secondary">
              Crea un cuento ilustrado único donde tu hijo es el protagonista.
              Personalizado, impreso con calidad artesanal y enviado a tu
              puerta.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/crear"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-xl hover:shadow-brand/30"
              >
                Personalizar libro
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#artesanal"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-text-primary transition-colors hover:border-brand/30 hover:bg-cream"
              >
                Ver calidad del papel
              </a>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-text-muted">
              <span className="flex items-center gap-1.5">
                <Leaf className="h-4 w-4 text-green-600" />
                Papel FSC
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand" />
                Envío artesanal
              </span>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="relative h-[400px] w-[340px] sm:h-[480px] sm:w-[400px]">
              <div className="absolute inset-0 rotate-3 rounded-2xl bg-brand/10" />
              <div className="absolute inset-0 -rotate-2 rounded-2xl bg-amber-100/60" />
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-2xl">
                <div className="p-8 text-center">
                  <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-cream">
                    <span className="text-6xl">📖</span>
                  </div>
                  <p className="text-lg font-bold text-text-primary">
                    Tu hijo, el protagonista
                  </p>
                  <p className="mt-2 text-sm text-text-muted">
                    Cada ilustración, cada detalle,
                    <br />
                    creado para hacer magia.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
