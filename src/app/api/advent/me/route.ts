import { NextResponse } from "next/server";
import { loadAdventAccount } from "@/lib/advent/account";

/**
 * GET /api/advent/me — who is reading the Advent calendar (src/lib/advent/account.ts).
 * 200 { signedIn, portraitEmail, character: { id, name, gender, traits } | null }
 * portraitEmail is the account's own confirmed address (null for guests): the only
 * address the portrait PDFs can be emailed to. Private, never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const account = await loadAdventAccount();
    return NextResponse.json(
      { signedIn: account.userId !== null, portraitEmail: account.portraitEmail, character: account.character },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("[advent/me] failed:", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ signedIn: false, portraitEmail: null, character: null }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
