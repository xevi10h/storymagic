"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { trackEvent } from "@/lib/tracking/consent";
import { getFirstTouch } from "@/lib/tracking/attribution";
import { beforeSend, redactPath } from "@/lib/tracking/vercel-analytics";

/**
 * Vercel Web Analytics (cookieless, so it loads whatever the cookie choice; see
 * lib/tracking/vercel-analytics.ts) + the `landing_view` funnel event, once per page load.
 * Rendered before <Tracking /> so `window.va` exists when other effects send events.
 */
export default function VercelAnalytics() {
  // Runs after <Analytics />'s own effect (child effects first), so the event is queued, not lost.
  useEffect(() => {
    const page = redactPath(getFirstTouch()?.landing_path ?? location.pathname);
    if (page !== null) trackEvent("landing_view", { page: page.slice(0, 100) });
  }, []);

  return <Analytics beforeSend={beforeSend} />;
}
