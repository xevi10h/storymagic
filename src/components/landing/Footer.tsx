export default function Footer() {
  return (
    <footer className="mt-12 border-t-8 border-[#8B4513] bg-[#2C1810] pt-20 pb-10 text-[#E6D4C8]">
      <div className="mx-auto max-w-6xl px-8">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <div className="mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-primary">menu_book</span>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                StoryMagic
              </span>
            </div>
            <p className="font-body mb-6 text-sm leading-relaxed text-[#A1887F]">
              Taller de cuentos personalizados. <br />
              Hechos a mano, con tinta y papel. <br />
              Sin baterías, solo imaginación.
            </p>
          </div>

          {/* Taller */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">Taller</h4>
            <ul className="font-body space-y-3 text-sm text-[#A1887F]">
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Nuestros papeles
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Proceso artesanal
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Envíos y empaquetado
                </a>
              </li>
            </ul>
          </div>

          {/* Atención */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">Atención</h4>
            <ul className="font-body space-y-3 text-sm text-[#A1887F]">
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Dudas frecuentes
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Seguimiento de envío
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-primary" href="#">
                  Garantía de calidad
                </a>
              </li>
            </ul>
          </div>

          {/* Club de Lectura */}
          <div>
            <h4 className="mb-6 font-display text-lg font-bold text-white">Club de Lectura</h4>
            <p className="font-body mb-4 text-sm text-[#A1887F]">
              Consejos para fomentar la lectura sin pantallas.
            </p>
            <div className="flex flex-col gap-3">
              <input
                className="font-body rounded border border-[#5D4037] bg-white/5 px-4 py-3 text-sm text-white placeholder-[#5D4037] focus:border-primary focus:outline-none"
                placeholder="Tu correo electrónico"
                type="email"
              />
              <button className="font-body rounded bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-800">
                Unirme al club
              </button>
            </div>
          </div>
        </div>

        <div className="font-body flex flex-col items-center justify-between gap-4 border-t border-[#5D4037] pt-8 text-xs text-[#5D4037] md:flex-row">
          <p>© 2023 StoryMagic Artesanos. Hecho con amor.</p>
          <div className="flex gap-6">
            <a className="transition-colors hover:text-white" href="#">
              Aviso Legal
            </a>
            <a className="transition-colors hover:text-white" href="#">
              Privacidad
            </a>
            <a className="transition-colors hover:text-white" href="#">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
