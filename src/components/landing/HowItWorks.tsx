export default function HowItWorks() {
  return (
    <section className="relative border-y border-border-light bg-white py-20" id="manifesto">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="mb-16 text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            Vuelta a los orígenes
          </span>
          <h2 className="mt-2 font-display text-4xl font-bold text-secondary">
            Magia real en 3 pasos artesanales
          </h2>
        </div>

        <div className="relative grid grid-cols-1 gap-12 md:grid-cols-3">
          {/* Dotted connector line */}
          <div className="absolute top-12 right-[16%] left-[16%] z-0 hidden h-0.5 border-t-2 border-dashed border-border-light md:block" />

          {/* Step 1 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-sand shadow-md">
              <span className="material-symbols-outlined text-4xl text-primary">auto_stories</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">Elige una historia</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              Selecciona una trama diseñada para ser leída en voz alta y tocar el corazón.
            </p>
          </div>

          {/* Step 2 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-earth shadow-md">
              <span className="material-symbols-outlined text-4xl text-secondary">brush</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">Personalización manual</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              Adaptamos las ilustraciones con estilo acuarela para que tu hijo se reconozca.
            </p>
          </div>

          {/* Step 3 */}
          <div className="group flex flex-col items-center text-center">
            <div className="relative z-10 mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-sage shadow-md">
              <span className="material-symbols-outlined text-4xl text-success">inventory_2</span>
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-secondary">Recibe un tesoro</h3>
            <p className="max-w-xs text-sm leading-relaxed text-text-soft">
              Un libro físico, encuadernado con cariño, llega a tu puerta listo para ser amado.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
