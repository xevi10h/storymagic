import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "ca", "en", "fr"],
  defaultLocale: "es",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];
