// Server half of Vercel BotID: one checkBotId() per protected request
// (routes in src/lib/botid/routes.ts; the browser attaches the challenge headers).
//
// - Production on Vercel: real Deep Analysis. A request without the headers
//   (curl, a script, a route missing from the protect list) is a bot.
// - `next dev` (NODE_ENV !== "production"): human, nothing is called
//   (BOTID_DEV_BYPASS=BAD-BOT forces "bot" there to test the 403 path).
// - BOTID_MODE=monitor: bots are logged but let through (still under the per-IP
//   guest caps of src/lib/guest-caps.ts). Emergency valve if real visitors are
//   ever misclassified; default is enforce (403).
// - checkBotId itself failing (Vercel API down): allowed and logged, the per-IP
//   caps and the global daily preview cap still apply.
//
// Every decision logs `[botid] <route> human|bot` in the Vercel logs.

import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { BOTID_CHECK_LEVEL } from "./routes";

export type BotIdRoute = "guest_session" | "email_otp" | "prepare" | "portrait" | "preview";

export const BOT_DETECTED_ERROR = "bot_detected";

function isMonitorMode(): boolean {
  return process.env.BOTID_MODE?.trim().toLowerCase() === "monitor";
}

const DEV_BYPASS_VALUES = ["HUMAN", "BAD-BOT", "GOOD-BOT", "ALLOWED"] as const;
type DevBypass = (typeof DEV_BYPASS_VALUES)[number];

function devBypass(): DevBypass | undefined {
  const value = process.env.BOTID_DEV_BYPASS?.trim().toUpperCase();
  return DEV_BYPASS_VALUES.find((v) => v === value);
}

/** 403 response when the caller is a bot (enforce mode), otherwise null. */
export async function refuseBot(route: BotIdRoute): Promise<NextResponse | null> {
  let isBot: boolean;
  try {
    const verdict = await checkBotId({
      advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
      // Dev-only verdict for testing (BOTID_DEV_BYPASS=BAD-BOT npm run dev); ignored in production.
      developmentOptions: { bypass: devBypass() },
    });
    // Verified crawlers (Googlebot…) have no business on these POST routes either.
    isBot = verdict.isBot || verdict.isVerifiedBot;
  } catch (err) {
    console.error(`[botid] ${route} check failed, allowed:`, err instanceof Error ? err.message : err);
    return null;
  }
  const monitor = isMonitorMode();
  console.info(`[botid] ${route} ${isBot ? "bot" : "human"}${isBot && monitor ? " (monitor: allowed)" : ""}`);
  if (!isBot || monitor) return null;
  return NextResponse.json({ error: BOT_DETECTED_ERROR }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
