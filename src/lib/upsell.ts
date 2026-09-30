// Post-purchase offers (pure, no imports, so it can be checked with
// `node --experimental-strip-types src/lib/upsell.check.mjs`).
//
// Owner decisions 2026-09-30:
//  - pdf_upgrade: a paid (not refunded) PDF order of a story → its FIRST printed copy
//    with the PDF price deducted (hardcover 40,00 €, softcover 25,00 €), no time limit.
//  - extra_copy_repeat: a paid (not refunded) printed order of a story → more printed
//    copies at the checkout extra-copy price (29,90 / 19,90 €) for 60 days from that
//    order; afterwards the normal price. Ships separately (its own Gelato order).
//
// The price is decided server-side (/api/checkout) from the buyer's own orders; the
// library and the emails only display what this function returns.

export type UpsellOffer = "pdf_upgrade" | "extra_copy_repeat";
export type UpsellFormat = "hardcover" | "softcover";

export const UPSELL_OFFERS: readonly UpsellOffer[] = ["pdf_upgrade", "extra_copy_repeat"];
export const EXTRA_COPY_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

/** Same set as PAID_ORDER_STATUSES (preview-access.ts), duplicated to stay import-free. */
const LIVE_STATUSES = new Set(["paid", "producing", "shipped", "delivered"]);
const PHYSICAL = new Set(["hardcover", "softcover"]);

/** Stripe catalog item (STRIPE_CATALOG key in pricing.ts) that each offer sells, per format. */
export const OFFER_CATALOG_ITEMS = {
  pdf_upgrade: { hardcover: "upgrade_hardcover", softcover: "upgrade_softcover" },
  extra_copy_repeat: { hardcover: "extra_copy_hardcover", softcover: "extra_copy_softcover" },
} as const satisfies Record<UpsellOffer, Record<UpsellFormat, string>>;

export type OfferCatalogItem = (typeof OFFER_CATALOG_ITEMS)[UpsellOffer][UpsellFormat];

export interface UpsellOrderRow {
  id: string;
  user_id: string | null;
  story_id: string | null;
  format: string;
  status: string;
  refunded_at: string | null;
  created_at: string;
  /** Offer this order was bought with (orders.offer), null for a normal purchase. */
  offer?: string | null;
}

export interface StoryUpsell {
  offer: UpsellOffer;
  storyId: string;
  /** The paid order that makes the story eligible (PDF order / printed order). */
  sourceOrderId: string;
  /** Format of that order (preselects the same format for an extra copy). */
  sourceFormat: string;
  /** Last moment the price applies (ISO), null = no time limit. */
  expiresAt: string | null;
}

function isLive(o: UpsellOrderRow): boolean {
  return LIVE_STATUSES.has(o.status) && !o.refunded_at;
}

/**
 * The offer (if any) a buyer gets on a new printed copy of a story, from their own
 * orders. Orders of other users, detached orders (null user/story), unpaid, closed
 * and refunded orders never count. The extra-copy price wins when both apply (it is
 * the lower one). `upgradeAvailable: false` hides the PDF upgrade (its Stripe Price
 * is missing on this account: fail soft, normal price).
 */
export function upsellForStory(
  orders: readonly UpsellOrderRow[],
  opts: { userId: string | null | undefined; storyId: string | null | undefined; now: number; upgradeAvailable?: boolean },
): StoryUpsell | null {
  const { userId, storyId, now } = opts;
  if (!userId || !storyId) return null;
  const mine = orders.filter((o) => o.user_id === userId && o.story_id === storyId && isLive(o));

  // Extra copy: window anchored on the latest printed purchase of the book itself
  // (a post-purchase copy does not restart the 60 days).
  const anchor = mine
    .filter((o) => PHYSICAL.has(o.format) && o.offer !== "extra_copy_repeat")
    .map((o) => ({ o, t: Date.parse(o.created_at) }))
    .filter(({ t }) => Number.isFinite(t))
    .sort((a, b) => b.t - a.t)[0];
  if (anchor) {
    const expires = anchor.t + EXTRA_COPY_WINDOW_DAYS * DAY_MS;
    if (now < expires) {
      return {
        offer: "extra_copy_repeat",
        storyId,
        sourceOrderId: anchor.o.id,
        sourceFormat: anchor.o.format,
        expiresAt: new Date(expires).toISOString(),
      };
    }
  }
  // A printed copy exists (upgrade used, or bought at full price): no upgrade.
  if (mine.some((o) => PHYSICAL.has(o.format))) return null;

  if (opts.upgradeAvailable === false) return null;
  const pdf = mine.find((o) => o.format === "digital_pdf");
  if (pdf) return { offer: "pdf_upgrade", storyId, sourceOrderId: pdf.id, sourceFormat: pdf.format, expiresAt: null };
  return null;
}

/** Catalog item an offer sells for a printed format. */
export function offerCatalogItem(offer: UpsellOffer, format: UpsellFormat): OfferCatalogItem {
  return OFFER_CATALOG_ITEMS[offer][format];
}

export function isUpsellOffer(value: unknown): value is UpsellOffer {
  return typeof value === "string" && (UPSELL_OFFERS as readonly string[]).includes(value);
}
