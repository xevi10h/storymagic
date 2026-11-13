// /llms-full.txt (llmstxt.org): the brief plus the full text of the facts sheet, the
// guides and the blog, for answer engines that read one file. Built in lib/llms.ts.

import { llmsFull } from "@/lib/llms";

// Quotes this season's order-by dates, the Black Friday offer (ends 30 Nov 23:59) and the blog rows: rebuild hourly.
export const revalidate = 3600;

export async function GET() {
  return new Response(await llmsFull(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
