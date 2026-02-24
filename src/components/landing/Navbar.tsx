"use client";

import { useState } from "react";
import { BookOpen, Menu, X } from "lucide-react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Manifiesto", href: "#manifiesto" },
  { label: "Colección", href: "#coleccion" },
  { label: "Artesanal", href: "#artesanal" },
  { label: "Familias", href: "#familias" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full">
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
        <div className="flex h-14 items-center justify-between rounded-lg border border-stone-200 bg-white/95 px-5 shadow-sm backdrop-blur-sm">
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold text-text-main">
              Story<span className="text-primary">Magic</span>
            </span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-soft transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:block">
            <Link
              href="/crear"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-orange-700 hover:shadow-lg"
            >
              Crear mi cuento
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileOpen ? (
              <X className="h-6 w-6 text-text-main" />
            ) : (
              <Menu className="h-6 w-6 text-text-main" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mx-4 mt-2 rounded-lg border border-stone-200 bg-white p-4 shadow-lg sm:mx-6 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3 text-base font-medium text-text-soft transition-colors hover:text-primary"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/crear"
            className="mt-3 block rounded-lg bg-primary px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-orange-700"
            onClick={() => setMobileOpen(false)}
          >
            Crear mi cuento
          </Link>
        </div>
      )}
    </nav>
  );
}
