// /llms.txt (llmstxt.org): the short brief. Built in lib/llms.ts from the same facts as
// the site copy and the JSON-LD; /llms-full.txt carries the full page text.

import { llmsBrief } from "@/lib/llms";

// Quotes this season's order-by dates and the Black Friday offer (ends 30 Nov 23:59): rebuild hourly.
export const revalidate = 3600;

export function GET() {
  return new Response(llmsBrief(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
