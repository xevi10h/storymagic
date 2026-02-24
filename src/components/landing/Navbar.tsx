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
    <nav className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-brand" />
          <span className="text-xl font-bold text-text-primary">
            Story<span className="text-brand">Magic</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-secondary transition-colors hover:text-brand"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <Link
            href="/crear"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
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
            <X className="h-6 w-6 text-text-primary" />
          ) : (
            <Menu className="h-6 w-6 text-text-primary" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3 text-base font-medium text-text-secondary transition-colors hover:text-brand"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/crear"
            className="mt-3 block rounded-full bg-brand px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            onClick={() => setMobileOpen(false)}
          >
            Crear mi cuento
          </Link>
        </div>
      )}
    </nav>
  );
}
