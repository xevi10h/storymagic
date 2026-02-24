"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Manifiesto", href: "#manifesto" },
  { label: "Colección", href: "#catalog" },
  { label: "Artesanal", href: "#artisanal" },
  { label: "Familias", href: "#reviews" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full px-4 py-4 transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-lg border border-stone-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="text-primary">
            <span className="material-symbols-outlined text-3xl">menu_book</span>
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-secondary">
            StoryMagic
          </span>
        </div>

        <div className="hidden items-center gap-8 font-body md:flex">
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

        <Link
          href="/crear"
          className="hidden items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-orange-700 active:scale-95 md:flex"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          Crear mi cuento
        </Link>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
        >
          <span className="material-symbols-outlined text-2xl text-text-main">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-lg border border-stone-200 bg-white p-4 shadow-lg md:hidden">
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
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-orange-700"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Crear mi cuento
          </Link>
        </div>
      )}
    </nav>
  );
}
