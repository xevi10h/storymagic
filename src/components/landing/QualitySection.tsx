export default function QualitySection() {
  return (
    <section className="relative overflow-hidden bg-white py-24" id="artisanal">
      <div className="torn-paper-top" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-16 lg:flex-row">
          {/* Left — Image with decorative backing */}
          <div className="relative lg:w-1/2">
            <div className="absolute -top-6 -left-6 -z-10 h-full w-full -rotate-2 rounded-lg border border-[#D6C4A0] bg-[#E8DCC4]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Close up of high quality book binding and thick paper pages"
              className="h-[500px] w-full rounded-lg object-cover shadow-2xl sepia-[0.15]"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDkkQQPk7OzCfnx7WJj8dX7WuRKk5U-0GgJph8-YJux6aF7G0ex0WWvtSFid1o75OS-uWXltC3oQOxgBVgTLcEiih2DIj0MbEixxGOL5TGqFq6SiveRUIbeeZej-kUGQS3NK0uQtU7cF1PEjH60T8p1XEIySV7vfa-tlEst4gInjUUefKTNGIj8NfdwgDYs3uY24tSK3ghbaJ0JVS6ScLTbtySclznSEKryioJEJAGKyZABYYoxY84jI24SQQwHmfHUy8D7BKDCgHNb"
            />
            {/* Floating eco badge */}
            <div className="absolute -right-6 -bottom-10 w-48 rotate-3 border border-stone-200 bg-white p-6 shadow-xl">
              <div className="flex flex-col items-center text-center">
                <span className="material-symbols-outlined mb-2 text-4xl text-green-700">eco</span>
                <span className="font-body text-sm font-bold text-secondary">
                  Impresión local &amp; sostenible
                </span>
              </div>
            </div>
          </div>

          {/* Right — Text content */}
          <div className="flex flex-col gap-8 lg:w-1/2">
            <span className="font-body text-sm font-bold uppercase tracking-widest text-primary">
              Calidad de Librería
            </span>
            <h2 className="font-display text-4xl font-bold leading-tight text-secondary">
              Objetos hechos para perdurar en el tiempo
            </h2>
            <p className="font-body text-lg text-text-soft">
              No es solo un cuento, es un recuerdo tangible. Huimos de lo efímero digital para
              crear libros robustos.
            </p>

            <div className="mt-4 space-y-8">
              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-secondary text-secondary">
                  <span className="material-symbols-outlined">book</span>
                </div>
                <div>
                  <h3 className="mb-1 font-display text-xl font-bold text-secondary">
                    Encuadernación Tradicional
                  </h3>
                  <p className="font-body text-sm text-text-soft">
                    Cosido al hilo y tapas reforzadas. Resiste el paso de los años y de las manos
                    pequeñas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-secondary text-secondary">
                  <span className="material-symbols-outlined">texture</span>
                </div>
                <div>
                  <h3 className="mb-1 font-display text-xl font-bold text-secondary">
                    Textura del Papel
                  </h3>
                  <p className="font-body text-sm text-text-soft">
                    Papel Munken de 170g con un ligero tono crema para no cansar la vista. Rugosidad
                    natural al tacto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="torn-paper-bottom" />
    </section>
  );
}
