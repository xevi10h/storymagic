import { buildOpenAiJsonl } from "@/lib/merchant-feed";

// ChatGPT product feed (developers.openai.com/commerce/specs/feed, JSONL): the same
// items as the Google Merchant feed. Rendered at build time from constants.
export const dynamic = "force-static";

export function GET() {
  return new Response(buildOpenAiJsonl(), {
    headers: {
      "Content-Type": "application/jsonl; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
