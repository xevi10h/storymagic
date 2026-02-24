import { BookOpen, Mail } from "lucide-react";
import Link from "next/link";

const FOOTER_LINKS = {
  producto: [
    { label: "Colección", href: "#coleccion" },
    { label: "Pack Aventura", href: "#" },
    { label: "Calidad artesanal", href: "#artesanal" },
    { label: "Precios", href: "#coleccion" },
  ],
  soporte: [
    { label: "Preguntas frecuentes", href: "#" },
    { label: "Envíos y entregas", href: "#" },
    { label: "Contacto", href: "#" },
    { label: "Devoluciones", href: "#" },
  ],
  legal: [
    { label: "Aviso legal", href: "#" },
    { label: "Política de privacidad", href: "#" },
    { label: "Términos y condiciones", href: "#" },
    { label: "Cookies", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t-8 border-accent bg-[#2C1810]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold text-white">
                Story<span className="text-primary">Magic</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-[#A1887F]">
              Cuentos infantiles personalizados, ilustrados con cariño e
              impresos con calidad artesanal. Creados en nuestro taller digital.
            </p>

            <div className="mt-6">
              <p className="font-display text-sm font-semibold text-[#D7CCC8]">
                Club de lectura
              </p>
              <form className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1887F]" />
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full rounded-lg border border-[#5D4037] bg-[#3E2723] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-[#A1887F] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700"
                >
                  Unirme
                </button>
              </form>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#D7CCC8]">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#A1887F] transition-colors hover:text-primary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-[#3E2723] pt-8">
          <p className="text-center text-sm text-[#A1887F]">
            © {new Date().getFullYear()} StoryMagic. Todos los derechos
            reservados. Hecho con cariño para las familias que creen en la magia
            de leer juntos.
          </p>
        </div>
      </div>
    </footer>
  );
}
