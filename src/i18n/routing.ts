import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "ca", "en", "fr"],
  defaultLocale: "es",
  localeDetection: true,
  // No `Link: …; rel="alternate"; hreflang` response header: next-intl builds it
  // from the request host (so www/.com copies advertised themselves) and its
  // x-default is the unprefixed path. The <link rel="alternate"> tags in each
  // page's metadata are the single hreflang source.
  alternateLinks: false,
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];
