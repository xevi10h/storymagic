// Free printable tools (Reyes 2026): the registry of routes, locales and content
// dates. Shared by client and server — no server-only imports here.
//
// English slugs (project URL convention), Spanish/Catalan content. The tools exist
// only in es + ca (owner decision 2026-10-02): /en/tools/* and /fr/tools/* 404,
// they are not in the sitemap and hreflang lists es + ca (+ x-default = es).

export const TOOL_LOCALES = ["es", "ca"] as const;
export type ToolLocale = (typeof TOOL_LOCALES)[number];

export function isToolLocale(locale: string): locale is ToolLocale {
  return (TOOL_LOCALES as readonly string[]).includes(locale);
}

export const TOOL_IDS = ["letter", "reply"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const TOOLS_HUB_PATH = "/tools";

export const TOOL_SLUGS: Record<ToolId, string> = {
  letter: "letter-to-the-three-kings",
  reply: "reply-from-the-three-kings",
};

/** Path without the locale prefix, e.g. "/tools/letter-to-the-three-kings". */
export function toolPath(tool: ToolId): string {
  return `${TOOLS_HUB_PATH}/${TOOL_SLUGS[tool]}`;
}

/**
 * Date the page content was last written (sitemap lastmod). Bump it when the
 * copy, the FAQ or the PDF design changes — never on a plain deploy.
 */
export const TOOLS_CONTENT_UPDATED = "2026-10-02";

/** Published blog post about Reyes gifts (exists in es and ca). */
export const REYES_BLOG_PATH = "/blog/three-kings-gift-ideas";

/** hreflang map for a tools path: es + ca, x-default = es. */
export function toolAlternates(baseUrl: string, path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const loc of TOOL_LOCALES) languages[loc] = `${baseUrl}/${loc}${path}`;
  languages["x-default"] = `${baseUrl}/es${path}`;
  return languages;
}

/**
 * Where the language switcher sends a reader of a tools page who picks a locale
 * without tools (en/fr): the Reyes gift page, which exists in every locale.
 */
export function toolsFallbackPath(pathname: string, targetLocale: string): string | null {
  if (isToolLocale(targetLocale)) return null;
  return pathname === TOOLS_HUB_PATH || pathname.startsWith(`${TOOLS_HUB_PATH}/`) ? "/gifts/three-kings" : null;
}
