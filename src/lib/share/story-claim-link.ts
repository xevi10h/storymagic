// Server-only: the "continue your book" URL for an email to the story's owner, plus the
// activity stamp that keeps the guest purge (30 days idle, /api/cron/purge-guests) from
// deleting the story while the link (valid 30 days, ./story-claim-token.ts) still works.

import type { FulfilmentClient } from "@/lib/fulfilment/db";
import { createStoryClaimToken, storyClaimUrl } from "./story-claim-token";

export async function issueStoryClaimLink(
  db: FulfilmentClient,
  p: { storyId: string; email: string; locale: string; siteUrl: string },
): Promise<string> {
  const { token } = createStoryClaimToken(p.storyId, p.email);
  // Never on a story still painting: /generate reads updated_at to spot a stuck run.
  const { error } = await db
    .from("stories")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", p.storyId)
    .neq("status", "generating");
  if (error) console.error(`[story-claim] activity not recorded for ${p.storyId}: ${error.message}`);
  return storyClaimUrl(p.siteUrl, p.locale, token);
}
