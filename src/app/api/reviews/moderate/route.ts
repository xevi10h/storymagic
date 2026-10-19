import { createFulfilmentClient } from "@/lib/fulfilment/db";
import { escapeHtml } from "@/lib/email/layout";
import { revalidateReviewPages } from "@/lib/reviews/revalidate";
import { reviewKey, verifyReviewToken } from "@/lib/reviews/review-token";

/**
 * Owner moderation of one review, from the signed link in the "New review" alert email
 * (src/lib/reviews/notify-owner.ts). GET only shows the review and a button (mail
 * scanners open links); the POST form hides it, or publishes it when the customer
 * consented. SQL alternative: docs/technical-architecture.md › Reviews.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#FFF8F0;color:#1b120e;margin:0;padding:32px 16px}main{max-width:520px;margin:0 auto;background:#fff;border:1px solid #f3ebe7;border-radius:16px;padding:24px}
blockquote{margin:16px 0;padding:12px 16px;background:#FFF8F0;border-radius:12px;white-space:pre-line}button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:12px 20px;cursor:pointer;background:#E86C3A;color:#fff;margin-right:8px}
button.secondary{background:#f3ebe7;color:#1b120e}p{line-height:1.5}</style></head><body><main><h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(title)}</h1>${body}</main></body></html>`;
  return new Response(html, { status, headers: HEADERS });
}

function reviewIdFrom(token: string | null): string | null {
  try {
    return verifyReviewToken("moderate", token, reviewKey("moderate"));
  } catch {
    return null;
  }
}

async function loadReview(id: string) {
  const supabase = createFulfilmentClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, display_name, status, publish_consent")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { supabase, review: data };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  const id = reviewIdFrom(token);
  if (!id || !token) return page("Invalid link", "<p>This moderation link is not valid.</p>", 400);
  try {
    const { review } = await loadReview(id);
    if (!review) return page("Review not found", "<p>It was deleted (or its order was).</p>", 404);
    const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const canPublish = review.publish_consent && review.status !== "published";
    const actions = [
      review.status !== "hidden" ? `<button name="action" value="hide">Hide from the site</button>` : "",
      canPublish ? `<button name="action" value="publish" class="${review.status === "hidden" ? "" : "secondary"}">Publish</button>` : "",
    ].join("");
    return page(
      `Review by ${review.display_name}`,
      `<p>${stars} · status <strong>${escapeHtml(review.status)}</strong>${review.publish_consent ? "" : " · no consent to publish (never shown)"}</p>
<blockquote>${escapeHtml(review.body ?? "(no text)")}</blockquote>
${actions ? `<form method="post"><input type="hidden" name="t" value="${escapeHtml(token)}">${actions}</form>` : "<p>Nothing to do.</p>"}`,
    );
  } catch (err) {
    console.error("[reviews/moderate] Read failed:", err instanceof Error ? err.message : err);
    return page("Unavailable", "<p>Could not read the review. Try again later.</p>", 500);
  }
}

export async function POST(request: Request) {
  let token: string | null = null;
  let action: string | null = null;
  try {
    const form = await request.formData();
    token = typeof form.get("t") === "string" ? (form.get("t") as string) : null;
    action = typeof form.get("action") === "string" ? (form.get("action") as string) : null;
  } catch {
    // fall through: invalid
  }
  const id = reviewIdFrom(token);
  if (!id || (action !== "hide" && action !== "publish")) return page("Invalid request", "<p>Open the link from the email again.</p>", 400);

  try {
    const { supabase, review } = await loadReview(id);
    if (!review) return page("Review not found", "<p>It was deleted (or its order was).</p>", 404);
    if (action === "publish" && !review.publish_consent) {
      return page("Cannot publish", "<p>The customer did not consent to publishing this review.</p>", 409);
    }
    const now = new Date().toISOString();
    const update =
      action === "hide"
        ? { status: "hidden" as const, updated_at: now }
        : { status: "published" as const, published_at: now, updated_at: now };
    const { error } = await supabase.from("reviews").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    console.log(`[reviews/moderate] Review ${id} → ${update.status}`);
    revalidateReviewPages();
    return page(action === "hide" ? "Review hidden" : "Review published", `<p>Done. The site pages refresh within a minute.</p>`);
  } catch (err) {
    console.error("[reviews/moderate] Update failed:", err instanceof Error ? err.message : err);
    return page("Unavailable", "<p>Could not update the review. Try again later.</p>", 500);
  }
}
