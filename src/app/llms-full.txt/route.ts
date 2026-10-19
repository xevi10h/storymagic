// /llms-full.txt (llmstxt.org): the brief plus the full text of the facts sheet, the
// guides and the blog, for answer engines that read one file. Built in lib/llms.ts.

import { llmsFull } from "@/lib/llms";

// Quotes this season's order-by dates and the blog rows: rebuild daily.
export const revalidate = 86400;

export async function GET() {
  return new Response(await llmsFull(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
