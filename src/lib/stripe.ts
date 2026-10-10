import Stripe from "stripe";
import {
  OPTIONAL_CATALOG_ITEMS,
  STRIPE_CATALOG,
  type CatalogItemId,
  type OptionalCatalogItemId,
  type RequiredCatalogItemId,
} from "./pricing";

type StripeEnvironment = "test" | "live";

function getActiveEnvironment(): StripeEnvironment {
  const env = process.env.STRIPE_ENVIRONMENT?.trim() ?? "test";
  if (env !== "test" && env !== "live") {
    throw new Error(`Invalid STRIPE_ENVIRONMENT "${env}". Must be "test" or "live".`);
  }
  return env;
}

export function getStripeSecretKey(): string {
  const env = getActiveEnvironment();
  const key =
    env === "test"
      ? process.env.STRIPE_SECRET_KEY_TEST?.trim()
      : process.env.STRIPE_SECRET_KEY_LIVE?.trim();

  if (!key || key.startsWith("sk_test_...") || key.startsWith("sk_live_...")) {
    throw new Error(`STRIPE_SECRET_KEY_${env.toUpperCase()} is not configured`);
  }
  return key;
}

/**
 * Every configured webhook signing secret (live and test endpoints both point at
 * the same URL). The handler verifies against each and then only processes events
 * whose mode matches STRIPE_ENVIRONMENT (see isEventForActiveEnvironment).
 */
export function getStripeWebhookSecrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET_LIVE, process.env.STRIPE_WEBHOOK_SECRET_TEST]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && s !== "whsec_...");
}

export function isEventForActiveEnvironment(event: Stripe.Event): boolean {
  return event.livemode === (getActiveEnvironment() === "live");
}

let _stripe: Stripe | null = null;
let _stripeEnv: StripeEnvironment | null = null;

export function getStripe(): Stripe {
  const currentEnv = getActiveEnvironment();
  // Recreate instance if environment switched (e.g. during dev hot-reload)
  if (!_stripe || _stripeEnv !== currentEnv) {
    _stripe = new Stripe(getStripeSecretKey());
    _stripeEnv = currentEnv;
  }
  return _stripe;
}

// ── Catalog (prices by lookup_key, see scripts/stripe-setup-catalog.mts) ─────

export interface StripeCatalog {
  prices: Record<RequiredCatalogItemId, string>;
  /** Items added after the first live setup: absent (offer hidden) until the setup script runs. */
  optionalPrices: Partial<Record<OptionalCatalogItemId, string>>;
  /** Seller NIF tax id (txi_…) printed on invoices; null if not configured. */
  sellerTaxId: string | null;
}

const OPTIONAL = new Set<CatalogItemId>(OPTIONAL_CATALOG_ITEMS);

/** Price id of any catalog item, or null when an optional item is not set up. */
export function catalogPriceId(catalog: StripeCatalog, item: CatalogItemId): string | null {
  return OPTIONAL.has(item)
    ? (catalog.optionalPrices[item as OptionalCatalogItemId] ?? null)
    : catalog.prices[item as RequiredCatalogItemId];
}

const CATALOG_TTL_MS = 10 * 60_000;
let _catalog: { env: StripeEnvironment; at: number; value: StripeCatalog } | null = null;

/**
 * Resolve the catalog Prices on the active account. Throws if a required Price is
 * missing or its amount/tax behaviour drifted from STRIPE_CATALOG — the UI shows
 * those amounts, so Checkout must never charge something else. Optional items
 * (OPTIONAL_CATALOG_ITEMS) fail soft: missing or drifted → left out, logged.
 */
export async function getStripeCatalog(): Promise<StripeCatalog> {
  const env = getActiveEnvironment();
  if (_catalog && _catalog.env === env && Date.now() - _catalog.at < CATALOG_TTL_MS) return _catalog.value;

  const stripe = getStripe();
  const ids = Object.keys(STRIPE_CATALOG) as CatalogItemId[];
  // Stripe accepts at most 10 lookup_keys per list call: query in chunks.
  const keys = ids.map((id) => STRIPE_CATALOG[id].lookupKey);
  const chunks = Array.from({ length: Math.ceil(keys.length / 10) }, (_, i) => keys.slice(i * 10, i * 10 + 10));
  const [priceLists, taxIds] = await Promise.all([
    Promise.all(chunks.map((lookup_keys) => stripe.prices.list({ lookup_keys, active: true, limit: 100 }))),
    stripe.taxIds.list({ limit: 100 }),
  ]);
  const prices = { data: priceLists.flatMap((l) => l.data) };
  const resolved = {} as Record<RequiredCatalogItemId, string>;
  const optionalPrices: Partial<Record<OptionalCatalogItemId, string>> = {};
  for (const id of ids) {
    const item = STRIPE_CATALOG[id];
    const price = prices.data.find((p) => p.lookup_key === item.lookupKey);
    const problem = !price
      ? `Stripe price "${item.lookupKey}" missing in ${env} — run scripts/stripe-setup-catalog.mts`
      : price.unit_amount !== item.amount || price.currency !== "eur" || price.tax_behavior !== "inclusive"
        ? `Stripe price "${item.lookupKey}" (${price.id}) is ${price.unit_amount} ${price.currency} ${price.tax_behavior}, expected ${item.amount} eur inclusive`
        : null;
    if (OPTIONAL.has(id)) {
      if (problem) console.warn(`[stripe] ${problem} (optional: its offer is hidden)`);
      else optionalPrices[id as OptionalCatalogItemId] = price!.id;
      continue;
    }
    if (problem) throw new Error(problem);
    resolved[id as RequiredCatalogItemId] = price!.id;
  }
  const value = { prices: resolved, optionalPrices, sellerTaxId: taxIds.data.find((t) => t.type === "es_cif")?.id ?? null };
  _catalog = { env, at: Date.now(), value };
  return value;
}

/**
 * Is the PDF → printed upgrade sellable on this account (both Prices set up)?
 * Never throws: any Stripe problem hides the offer.
 */
export async function isPdfUpgradeAvailable(): Promise<boolean> {
  try {
    const catalog = await getStripeCatalog();
    return !!catalog.optionalPrices.upgrade_hardcover && !!catalog.optionalPrices.upgrade_softcover;
  } catch (err) {
    console.warn("[stripe] Catalog unavailable, PDF upgrade hidden:", err instanceof Error ? err.message : err);
    return false;
  }
}

// Re-export pricing for convenience in server routes
export { PRICING, ADDONS, type BookFormat, type AddonId } from "./pricing";
