import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "ca", "en", "fr"],
  defaultLocale: "es",
  localeDetection: true,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];
