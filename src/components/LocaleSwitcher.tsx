"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
  fr: "Français",
};

const LOCALE_SHORT: Record<Locale, string> = {
  es: "ES",
  ca: "CA",
  en: "EN",
  fr: "FR",
};

export default function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(newLocale: Locale) {
    setOpen(false);
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("language")}
        className="flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-medium text-text-main transition-colors hover:border-border-medium hover:bg-cream"
      >
        <span className="material-symbols-outlined text-lg">language</span>
        <span>{LOCALE_SHORT[locale]}</span>
        <span className="material-symbols-outlined text-base text-text-muted">
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-border-light bg-white py-1.5 shadow-lg">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => handleChange(loc)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-cream ${
                locale === loc
                  ? "font-semibold text-primary"
                  : "text-text-soft hover:text-text-main"
              }`}
            >
              <span className="w-6 text-xs font-bold text-text-muted">
                {LOCALE_SHORT[loc]}
              </span>
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
