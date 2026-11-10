import { buildGoogleMerchantXml } from "@/lib/merchant-feed";

// Google Merchant Center product feed (RSS 2.0 + g: namespace), fetched daily by a
// scheduled fetch (docs/stack.md → Merchant Center). Built from constants and today's date
// (the seasonal Reyes edition is listed only while it can be ordered): static, re-rendered
// at most hourly so that edition leaves the feed without a deploy.
export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return new Response(buildGoogleMerchantXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      // The feed is for Merchant Center, not a page: keep it out of the web index.
      "X-Robots-Tag": "noindex",
    },
  });
}
