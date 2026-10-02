import { buildGoogleMerchantXml } from "@/lib/merchant-feed";

// Google Merchant Center product feed (RSS 2.0 + g: namespace), fetched daily by a
// scheduled fetch (docs/stack.md → Merchant Center). Built from constants only, so it
// is rendered once at build time and changes with each deploy.
export const dynamic = "force-static";

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
