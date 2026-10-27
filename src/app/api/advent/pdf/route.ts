import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { mailSafeName } from "@/lib/email/mail-safe-name";
import { formatChildName } from "@/lib/child-name";
import { ADVENT_DOORS_COUNT, compilationReady, isAdventLocale, isDoorOpen } from "@/lib/advent/calendar";
import { ADVENT_DOORS } from "@/lib/advent/stories";
import { ADVENT_COPY } from "@/lib/advent/copy";
import { adventDeName, asAdventGender, personalizeStory } from "@/lib/advent/personalize";
import { adventFileSlug, renderCompilationPdf, renderDoorPdf } from "@/lib/advent/pdf";
import { loadOwnCharacter } from "@/lib/advent/account";
import { portraitPng } from "@/lib/advent/assets";
import { adventToday } from "@/lib/advent/today";

/**
 * GET /api/advent/pdf?door=5|all&locale=es|ca — one door (or, from 24 Dec, the 24-story
 * compilation) as a 20×20 cm PDF, rendered in memory, nothing stored, names never logged.
 *  - &character=<uuid>: the caller's own saved character (session cookie, guests too) →
 *    name, gender and watercolour portrait from it;
 *  - otherwise &name=…&gender=boy|girl|neutral → name-only PDF.
 * Only open doors (Spain date; dev-only &now=YYYY-MM-DD).
 * 200 application/pdf · 400 invalid · 403 door_locked · 429 · 500
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkMemoryRateLimit(`advent_pdf:${clientIp}`, { maxRequests: 40, windowSeconds: 600 }).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const q = request.nextUrl.searchParams;
  const locale = q.get("locale") ?? "";
  if (!isAdventLocale(locale)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const today = adventToday(q.get("now"));
  const doorParam = q.get("door") ?? "";
  const all = doorParam === "all";
  const door = Number(doorParam);
  if (!all && !(Number.isInteger(door) && door >= 1 && door <= ADVENT_DOORS_COUNT)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (all ? !compilationReady(today) : !isDoorOpen(door, today)) return NextResponse.json({ error: "door_locked" }, { status: 403 });

  let name = mailSafeName(formatChildName(q.get("name") ?? ""));
  let gender = asAdventGender(q.get("gender"));
  let portraitUri: string | null = null;
  const characterId = q.get("character");
  if (characterId) {
    if (!/^[0-9a-f-]{36}$/i.test(characterId)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const character = user ? await loadOwnCharacter(user.id, characterId) : null;
    if (!character) return NextResponse.json({ error: "not_found" }, { status: 404 });
    name = mailSafeName(character.name);
    gender = character.gender;
    if (character.traits) portraitUri = await portraitPng(character.traits).catch(() => null);
  }
  if (!name) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  try {
    const child = { name, deName: adventDeName(locale, name, gender), portraitUri };
    const copy = ADVENT_COPY[locale].file;
    const slug = adventFileSlug(name);
    const pdf = all
      ? await renderCompilationPdf(
          locale,
          ADVENT_DOORS.map((d, i) => personalizeStory(i + 1, d.stories[locale], locale, name, gender)),
          child,
        )
      : await renderDoorPdf(locale, personalizeStory(door, ADVENT_DOORS[door - 1].stories[locale], locale, name, gender), child);
    const filename = all ? copy.compilation(slug) : copy.door(slug, door);
    const bytes = new Uint8Array(pdf);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (err) {
    console.error("[advent/pdf] render failed:", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
