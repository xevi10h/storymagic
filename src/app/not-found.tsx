import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { buttonClass } from "@/components/ui";

/**
 * Fallback 404 for URLs outside any locale. Rendered inside the root layout
 * (which owns <html>/<body> and the brand CSS), without the next-intl provider,
 * so copy is Spanish (default locale) and links point to /es.
 */
export default function RootNotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-4 text-center">
      <Link href="/es" aria-label="Meapica" className="mb-12 rounded-md">
        <BrandLogo className="h-7 text-brand-deep" />
      </Link>
      <p className="font-display text-6xl font-bold tabular-nums text-brand sm:text-7xl">404</p>
      <h1 className="mt-4 text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">
        Página no encontrada
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-body">
        Esta página se ha perdido en una aventura. Volvamos al inicio para encontrar el camino.
      </p>
      <div className="mt-8 flex flex-col items-center gap-2">
        <Link href="/es" className={buttonClass()}>
          Volver al inicio
        </Link>
        <Link href="/es/crear" className={buttonClass({ variant: "quiet" })}>
          o crea un cuento nuevo
        </Link>
      </div>
    </main>
  );
}
