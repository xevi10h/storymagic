// URLs the Advent calendar UI links to (PDF route, create flow), in one place.

import type { AdventLocale } from "@/lib/advent/render";
import type { AdventChild } from "./child-store";

/** /api/advent/pdf for one door ("all" = the 24-story compilation). */
export function pdfHref({ locale, door, child, devNow }: { locale: AdventLocale; door: number | "all"; child: AdventChild; devNow: string | null }): string {
  const q = new URLSearchParams({ door: String(door), locale });
  if (child.source === "character") q.set("character", child.id);
  else {
    q.set("name", child.name);
    q.set("gender", child.gender);
  }
  if (devNow) q.set("now", devNow);
  return `/api/advent/pdf?${q.toString()}`;
}

/** /create prefilled with the child (a saved character skips to its look). */
export function createHref(child: AdventChild | null, template?: string): { pathname: "/create"; query: Record<string, string> } {
  const query: Record<string, string> = { utm_source: "advent", utm_medium: "web", utm_campaign: "advent" };
  if (child) query.name = child.name;
  if (child?.source === "character") query.characterId = child.id;
  if (template) query.template = template;
  return { pathname: "/create", query };
}
