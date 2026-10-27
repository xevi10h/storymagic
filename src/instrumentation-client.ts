// Runs in the browser before the app hydrates (Next.js instrumentation-client).
// Vercel BotID: invisible bot check on the routes in src/lib/botid/routes.ts.
import { initBotId } from "botid/client/core";
import { BOTID_PROTECTED_ROUTES } from "@/lib/botid/routes";

initBotId({ protect: BOTID_PROTECTED_ROUTES });
