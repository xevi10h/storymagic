import Link from "next/link";

export default function AdventurePack() {
  return (
    <section className="relative overflow-hidden bg-pack-bg py-24 text-pack-text">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC7hINU9mwp25NrO_Iq3UCLpiX6Nz0XiawzNamGSrZh0kL8fDqnwIFgpNn_-GLdb1ldzSzlqpQJWQamAikyN8afx0SbRSFTZKd45IQ5zShVrJ6BMYJW1K5NYi-eH8Wq08tm2Crw0ChGQ-KMxUz9PW6b4o_QMCYnx7udmk-sOx_YlaG-NZjOL8fdNZDUIhfhLWFE3NZWRUga1qVlZLMAS0_FU_n9IXNxCAQDN8Vusne4x9wB2bYW4MKaZPscIsRrBapgRX5ccWoNCkVg')",
        }}
      />
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-center gap-12 rounded-2xl border border-border-warm bg-pack-inner p-8 shadow-2xl md:flex-row md:p-16">
          {/* Left — Text */}
          <div className="flex-1 text-center md:text-left">
            <span className="mb-4 inline-block rounded bg-pack-badge px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              Experiencia Completa
            </span>
            <h2 className="mb-6 font-display text-3xl font-bold text-white md:text-5xl">
              Pack Aventura Artesanal
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-pack-muted">
              La magia se extiende fuera del libro. Incluye{" "}
              <strong className="text-white">carta física personalizada</strong> del personaje
              principal, hoja de pegatinas mate y marcapáginas de madera.
            </p>
            <Link
              href="/crear"
              className="mx-auto flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-bold text-white shadow-lg transition-transform hover:-translate-y-1 hover:bg-primary-hover md:mx-0"
            >
              <span className="material-symbols-outlined">card_giftcard</span>
              Añadir extras físicos (+12.90€)
            </Link>
          </div>

          {/* Right — Polaroid image */}
          <div className="relative flex-1">
            <div className="rotate-2 bg-white p-3 shadow-xl transition-transform duration-300 hover:rotate-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Gift set with book, stickers and coloring pencils on a table"
                className="h-auto w-full sepia-[0.2]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgbajYrzRnL4XE3sG513pFRed1tLDRzw7P8yVbC5sDY73010Q_cVzcHERjGVa6VzLC4Z9qu0I_XX4KvYoRWWWLBnXXkUsEEujruWJSzvjfQRR2ZIkwL2aUwbrGMC3F53ujhJ5PhWwNN3IIQwOv8WWB2U7XNvI3vhM8u1T-f8OHfEElGy9sA0VwMZOgh3eafeYSg5vCL3W2yXYNqFPyjsOs8kjxP4P0DSaY_lmJ2rs-TNU6rOJJHIAiyreOJ_kTK1Z8ndJ_Cg4WpdmS"
              />
              <div className="pt-3 pb-1 text-center font-display text-gray-500">
                El regalo perfecto
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
