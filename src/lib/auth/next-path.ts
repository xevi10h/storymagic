// Post-login destination ("next") — pure helpers, safe in client, server and middleware.
//
// Every auth step (login screen, email link, code, Google callback, middleware)
// carries `next` as a locale-less, same-origin relative path ("/dashboard?tab=orders").
// Anything else (absolute URLs, protocol-relative "//evil.com", backslashes, auth or
// API routes) falls back to the default, so no auth URL can become an open redirect.
// The locale is added back only when navigating (localizedPath).

export const DEFAULT_NEXT_PATH = "/dashboard";

const LOCALES = ["es", "ca", "en", "fr"] as const;
export type AuthLocale = (typeof LOCALES)[number];

export function isAuthLocale(value: unknown): value is AuthLocale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

const BASE = "http://next.invalid";
const MAX_LENGTH = 512;

/**
 * Validate a `next` value and return a safe relative path without locale prefix
 * (pathname + search, never a hash). Accepts one level of URL-encoding
 * ("%2Fdashboard") and a leading locale ("/ca/dashboard" → "/dashboard").
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_NEXT_PATH): string {
  if (typeof raw !== "string") return fallback;
  let value = raw.trim();
  if (!value || value.length > MAX_LENGTH) return fallback;

  // One level of encoding ("%2Fcreate%2Fabc%2Fpreview") from older links.
  if (/^%2f/i.test(value)) {
    try {
      value = decodeURIComponent(value);
    } catch {
      return fallback;
    }
  }

  // Relative path only: "/x" but never "//host", "/\host" or anything with a scheme.
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and control characters are normalised by browsers into "//host".
  // (encoded backslashes too: no legitimate destination contains one).
  if (/[\\\u0000-\u001f\u007f]|%5c/i.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  let pathname = url.pathname;
  const localeMatch = pathname.match(/^\/(es|ca|en|fr)(?=\/|$)/);
  if (localeMatch) pathname = pathname.slice(localeMatch[0].length) || "/";

  // Never bounce back into the auth screens or onto a raw API route.
  if (/^\/(auth|api)(\/|$)/.test(pathname)) return fallback;

  return `${pathname}${url.search}`;
}

/** "/dashboard" + "ca" → "/ca/dashboard" ("/" → "/ca"). */
export function localizedPath(locale: string, nextPath: string): string {
  const loc = isAuthLocale(locale) ? locale : "es";
  const safe = sanitizeNextPath(nextPath);
  return safe === "/" ? `/${loc}` : `/${loc}${safe}`;
}

/** Login screen URL (locale-less, for the next-intl Link/router) carrying next + optional email. */
export function loginHref(nextPath?: string | null, email?: string | null): string {
  const params = new URLSearchParams();
  const next = nextPath ? sanitizeNextPath(nextPath) : null;
  if (next && next !== DEFAULT_NEXT_PATH) params.set("next", next);
  if (email) params.set("email", email);
  const qs = params.toString();
  return qs ? `/auth/login?${qs}` : "/auth/login";
}

/** Absolute "Ver mi pedido" link for order emails: login with the email prefilled → orders tab. */
export function orderAccessUrl(siteUrl: string, locale: string, email?: string | null): string {
  const loc = isAuthLocale(locale) ? locale : "es";
  const params = new URLSearchParams({ next: "/dashboard?tab=orders" });
  if (email) params.set("email", email);
  return `${siteUrl.replace(/\/+$/, "")}/${loc}/auth/login?${params.toString()}`;
}
