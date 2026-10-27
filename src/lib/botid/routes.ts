// Vercel BotID (invisible, no Cloudflare): the routes whose requests carry the
// challenge headers. Shared by the browser (src/instrumentation-client.ts, which
// patches fetch/XMLHttpRequest for these same-origin paths only) and the server
// (src/lib/botid/server.ts). The check level must be identical on both sides or
// every check fails, hence one constant.
//
// Deep Analysis (Kasada ML) is billed per checkBotId() call on Pro: $1 / 1,000.
// Every route below runs one check per call, so a visitor who gets a preview costs
// about 3-4 checks (guest session, character prep, preview) ≈ $0.004.

import type { initBotId } from "botid/client/core";

type ProtectedRoute = Parameters<typeof initBotId>[0]["protect"][number];

export const BOTID_CHECK_LEVEL = "deepAnalysis" as const;

const POST = (path: string): ProtectedRoute => ({
  path,
  method: "POST",
  advancedOptions: { checkLevel: BOTID_CHECK_LEVEL },
});

export const BOTID_PROTECTED_ROUTES: ProtectedRoute[] = [
  POST("/api/auth/guest-session"),
  POST("/api/auth/email-otp"),
  POST("/api/characters/prepare"),
  POST("/api/characters/portrait"),
  POST("/api/stories/*/generate"),
];
