import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

/** Operator panel chrome (header + content width). */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink-soft">
      <header className="sticky top-0 z-20 border-b border-brand/10 bg-paper">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5 text-brand-deep">
            <BrandLogo className="h-5 w-auto" />
            <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
              Operaciones
            </span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 text-sm sm:flex">
            <Link href="/admin" className="rounded-xl px-3 py-1.5 font-semibold text-ink-soft hover:bg-line">
              Pedidos
            </Link>
          </nav>
          <span className="ml-auto truncate text-xs text-ink-muted">{email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
