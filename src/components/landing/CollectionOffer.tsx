import Link from "next/link";

export default function CollectionOffer() {
  return (
    <section className="px-4 py-20">
      <div className="relative mx-auto max-w-5xl rotate-1 border-2 border-stone-200 bg-white p-2 shadow-2xl">
        <div
          className="relative overflow-hidden border border-stone-300 p-8 text-center md:p-16"
          style={{
            backgroundImage:
              "url('https://www.transparenttextures.com/patterns/cream-paper.png')",
          }}
        >
          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="font-body mb-2 block text-sm font-bold uppercase tracking-widest text-primary">
              Biblioteca Personal
            </span>
            <h2 className="mb-6 font-display text-4xl font-bold text-secondary md:text-5xl">
              Construye su legado de lectura
            </h2>
            <p className="mb-8 font-serif text-xl italic text-text-soft">
              3 libros físicos = 20% de descuento. <br />
              Historias que guardarán para sus propios hijos.
            </p>
            <Link
              href="/crear"
              className="font-body mx-auto inline-flex items-center gap-2 rounded bg-secondary px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-stone-800"
            >
              Comenzar la colección
              <span className="material-symbols-outlined">auto_stories</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
