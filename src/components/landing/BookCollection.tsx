const BOOKS = [
  {
    title: "El Bosque Encantado",
    description: "Ilustraciones estilo gouache sobre papel texturizado.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC6VL_AYqEty2H-GbV81WP_azfa6-IU9kYV335jDZwd4snVh3otFA0MLoHWzYBVRN6D7uO6bEFGhpnzN-NUinjaYGN0HlgT1dOrbips2Im89VsZRyTu-1V11GVPrma6xPMEKRBhlVhLpHl_mt8bkHQwuhNbWsxIeJndFCX9sJiIJtt31XHdiKH6_MBR4lvbIxqMGr915OaUtE8B6HC-E9cFrDodvb0saZB_Arw2STBeUL4o93_O5P1_AKxGrZxtlgICx5yeCsm7Diec",
    hasBadge: true,
  },
  {
    title: "Misión Espacial",
    description: "Acuarelas cósmicas y papel de alto gramaje.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuABBA0Cf06fPnqKSfGRm48Pmu6ucN-jUEVB4HEwyp-DBH-xxNU5J_KCoHPCTwqmiwLMRseYBXwbRpHgq9uGNsFjGl5RhN408EvyctgZzWyxWGPtAoOWRBqqLf6HYJ6JHExoCBXpq4UW8ANQYnEa9PuknwvT7CnGVOeOS7yJBU2sEszUjY0x_mXI_Hhc2iI-v8CqAuBFA55xP-nK_bsvWEmgN_L1YmVe5GI5bQD1_m9-emm22sbMoQqYpkXSt7WSjqHd-KmyZYEHrJ8D",
    hasBadge: false,
  },
  {
    title: "El Reino Submarino",
    description: "Tonos oceánicos impresos en calidad archivo.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBNgOqfWleS4dgz8lpSn13SgKrqUX_lP8f64zkeoepf32guQ7HsMYX45v2De6eISqj4HKCS6vKKvM3ZXXvHgQcfkScKM69Qq8C9c23L3XfJxnYyf-Amm2dWaNV0rMpNApWD-CoAZgVSgpoHsiAdE-SHMcIjcbkNUDOIFXpw_VN5172nLLzKL-pTmyhy6Im4agwWHIb4rcpVepJWGLcQ9krIodcO40-np3zmYRQDyte5QPiC3O5Wg2dlzxX5J03TD8dTpwAXyuXeYFLH",
    hasBadge: false,
  },
];

export default function BookCollection() {
  return (
    <section className="bg-cream px-4 py-24" id="catalog">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:flex-row">
          <div>
            <h2 className="mb-4 font-display text-4xl font-bold text-secondary">
              Nuestra Biblioteca Física
            </h2>
            <p className="max-w-xl text-lg text-text-soft">
              Ediciones limitadas en papel premium. Historias que se sienten mejor al tacto.
            </p>
          </div>
          <a
            className="group flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-primary hover:text-primary-hover"
            href="#"
          >
            Ver colección completa
            <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">
              arrow_right_alt
            </span>
          </a>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {BOOKS.map((book) => (
            <div
              key={book.title}
              className="group cursor-pointer rounded-lg border border-border-light/50 bg-white p-4 pb-6 shadow-sm transition-all duration-300 hover:shadow-xl"
            >
              <div className="relative mb-6 aspect-[3/4] overflow-hidden rounded-sm bg-cream shadow-inner">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-90 transition-transform duration-700 group-hover:scale-105"
                  style={{
                    backgroundImage: `url('${book.image}')`,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "url('https://www.transparenttextures.com/patterns/rough-cloth.png')",
                  }}
                />
                {book.hasBadge && (
                  <div className="absolute top-0 right-0 rounded-bl-lg bg-primary px-3 py-1 text-xs font-bold text-white shadow-sm">
                    Tapa Dura
                  </div>
                )}
              </div>

              <div className="space-y-3 px-2">
                <h3 className="font-display text-2xl font-bold text-secondary transition-colors group-hover:text-primary">
                  {book.title}
                </h3>
                <p className="line-clamp-2 text-sm italic text-text-soft">
                  {book.description}
                </p>
                <div className="mt-2 flex flex-col gap-2 border-t border-border-light/50 pt-2">
                  <div className="flex items-center justify-between text-sm text-text-muted">
                    <span>Tapa blanda</span>
                    <span className="font-bold text-secondary">34.90€</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-text-muted">
                    <span>Tapa dura (Premium)</span>
                    <span className="font-bold text-primary">44.90€</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
