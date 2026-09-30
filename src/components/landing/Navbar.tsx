import { headers } from "next/headers";
import { parseDateOverride, SEASON_NOW_HEADER, spainToday } from "@/lib/shipping";
import NavbarClient from "./NavbarClient";

/**
 * Marketing header, server entry: resolves the season date at render time so
 * the seasonal banner is in the static/ISR HTML (no client-only pop-in = no CLS).
 * Production never reads request headers here, so pages stay static.
 */
export default async function Navbar() {
  let today = spainToday();
  if (process.env.NODE_ENV !== "production") {
    today = parseDateOverride((await headers()).get(SEASON_NOW_HEADER)) ?? today;
  }
  return <NavbarClient seasonToday={today} />;
}
