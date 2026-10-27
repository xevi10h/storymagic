import { NextResponse } from "next/server";
import { ADVENT_DOORS_COUNT } from "@/lib/advent/calendar";
import { doorArtJpeg } from "@/lib/advent/assets";

/**
 * GET /api/advent/art/{door} — the door's illustration as JPEG for the daily email
 * (Outlook desktop does not render webp). Static art only (no child data): long cache.
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ door: string }> }) {
  const door = Number((await params).door);
  if (!Number.isInteger(door) || door < 1 || door > ADVENT_DOORS_COUNT) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    const jpeg = new Uint8Array(await doorArtJpeg(door));
    return new Response(jpeg, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpeg.byteLength),
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, immutable",
      },
    });
  } catch (err) {
    console.error("[advent/art] failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }
}
