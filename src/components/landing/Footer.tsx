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
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-brand" />
              <span className="text-lg font-bold text-text-primary">
                Story<span className="text-brand">Magic</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Cuentos infantiles personalizados, ilustrados con cariño e impresos
              con calidad artesanal. Creados en nuestro taller digital.
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-text-primary">
                Club de lectura
              </p>
              <form className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full rounded-full border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Unirme
                </button>
              </form>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-secondary transition-colors hover:text-brand"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-gray-100 pt-8">
          <p className="text-center text-sm text-text-muted">
            © {new Date().getFullYear()} StoryMagic. Todos los derechos
            reservados. Hecho con cariño para las familias que creen en la magia
            de leer juntos.
          </p>
        </div>
      </div>
    </footer>
  );
}
