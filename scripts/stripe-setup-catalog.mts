// Idempotent Stripe setup for Meapica on ONE account/mode (the one behind the key):
//   Stripe Tax (head office Barcelona, ES registration "small_seller": 4 % books,
//   Spanish VAT on EU digital sales under the 10k € OSS threshold), the seller NIF
//   for invoices, every STRIPE_CATALOG Product/Price (VAT-inclusive, lookup keys from
//   src/lib/pricing.ts, incl. the PDF → printed upgrade and the gift-voucher Prices), the
//   referral + gift-voucher coupons (src/lib/promo-codes.ts) and the webhook endpoint.
//
//   STRIPE_KEY=sk_test_... npx tsx --tsconfig tsconfig.json scripts/stripe-setup-catalog.mts \
//     [--webhook-url=https://meapica.shop/api/webhooks/stripe] [--dry-run]
//
// Re-run after changing an amount in STRIPE_CATALOG: a new Price takes over the
// lookup key (transfer_lookup_key) and the old one is archived.
// A NEW webhook endpoint prints its signing secret ONCE → STRIPE_WEBHOOK_SECRET_{TEST|LIVE}.

import Stripe from "stripe";
import { STRIPE_CATALOG, type CatalogItemId } from "../src/lib/pricing";
import { REFERRAL_COUPON_ID, REFERRAL_DISCOUNT_CENTS, VOUCHER_COUPON_IDS, VOUCHER_FORMATS } from "../src/lib/promo-codes";

const SELLER = {
  nif: "41649433K", // Xavier Huix Trenco (autónomo), same as the legal pages
  address: { line1: "Carrer Aribau 140, 5º", city: "Barcelona", postal_code: "08036", state: "B", country: "ES" },
};
export const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.dispute.created",
];

const key = process.env.STRIPE_KEY?.trim();
if (!key) throw new Error("STRIPE_KEY is required");
const dryRun = process.argv.includes("--dry-run");
const webhookUrl = process.argv.find((a) => a.startsWith("--webhook-url="))?.split("=")[1];
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") ? "LIVE" : "TEST";
const log = (...a: unknown[]) => console.log(`[${mode}]`, ...a);
const act = async <T,>(what: string, fn: () => Promise<T>): Promise<T | null> => {
  log(dryRun ? `would ${what}` : what);
  return dryRun ? null : fn();
};

const account = await stripe.accounts.retrieve();
log(`account ${account.id} · ${account.settings?.dashboard?.display_name} · descriptor ${account.settings?.payments?.statement_descriptor}`);

// ── Stripe Tax ────────────────────────────────────────────────────────────────
await act("set tax settings (head office, inclusive default)", () =>
  stripe.tax.settings.update({
    head_office: { address: SELLER.address },
    defaults: { tax_behavior: "inclusive", tax_code: STRIPE_CATALOG.hardcover.taxCode },
  }),
);
const regs = await stripe.tax.registrations.list({ status: "active", limit: 100 });
const esReg = regs.data.find((r) => r.country === "ES");
if (esReg) log(`ES tax registration ${esReg.id} (${JSON.stringify(esReg.country_options.es)})`);
else
  await act("create ES tax registration (standard, small_seller)", () =>
    stripe.tax.registrations.create({
      country: "ES",
      country_options: { es: { type: "standard", standard: { place_of_supply_scheme: "small_seller" } } },
      active_from: "now",
    }),
  );

// ── Seller NIF (shown on invoices) ──────────────────────────────────────────
const taxIds = await stripe.taxIds.list({ limit: 100 });
const nif = taxIds.data.find((t) => t.value === SELLER.nif);
if (nif) log(`seller tax id ${nif.id} (${nif.type})`);
else await act(`create seller tax id es_cif ${SELLER.nif}`, () => stripe.taxIds.create({ type: "es_cif", value: SELLER.nif }));

// ── Catalog ───────────────────────────────────────────────────────────────────
for (const [id, item] of Object.entries(STRIPE_CATALOG) as [CatalogItemId, (typeof STRIPE_CATALOG)[CatalogItemId]][]) {
  const existing = (await stripe.prices.list({ lookup_keys: [item.lookupKey], expand: ["data.product"], limit: 1 })).data[0];
  const product = existing?.product as Stripe.Product | undefined;
  const ok =
    existing &&
    existing.active &&
    existing.unit_amount === item.amount &&
    existing.currency === "eur" &&
    existing.tax_behavior === "inclusive";
  if (ok && product) {
    if (product.tax_code !== item.taxCode || product.name !== item.name) {
      await act(`update product ${product.id} (${id}) name/tax_code`, () =>
        stripe.products.update(product.id, { name: item.name, tax_code: item.taxCode }),
      );
    }
    log(`${id}: ${existing.id} ${item.amount} ✓`);
    continue;
  }
  const productId =
    product?.id ??
    (
      await act(`create product ${id}`, () =>
        stripe.products.create({ name: item.name, tax_code: item.taxCode, metadata: { meapica_item: id } }),
      )
    )?.id;
  const created = await act(`create price ${id} ${item.amount} (inclusive, lookup ${item.lookupKey})`, () =>
    stripe.prices.create({
      product: productId!,
      currency: "eur",
      unit_amount: item.amount,
      tax_behavior: "inclusive",
      lookup_key: item.lookupKey,
      transfer_lookup_key: true,
    }),
  );
  if (created && existing) await stripe.prices.update(existing.id, { active: false });
  if (created) log(`${id}: ${created.id} ${item.amount} ✓`);
}

// ── Coupons (referral "10 € y 10 €" + gift vouchers) ──────────────────────────
// Fixed ids so the app finds them (src/lib/growth/stripe-promotions.ts; missing = feature
// hidden). Each is restricted to the BOOK products (applies_to), so a referral code never
// discounts the PDF / extra copies / upgrades, and a voucher only pays its own format.
// Coupons are immutable: a wrong one is reported, delete it in the Dashboard and re-run.
async function bookProductId(item: "digital_pdf" | "softcover" | "hardcover"): Promise<string | null> {
  const price = (await stripe.prices.list({ lookup_keys: [STRIPE_CATALOG[item].lookupKey], active: true, limit: 1 })).data[0];
  return price ? (typeof price.product === "string" ? price.product : price.product.id) : null;
}
async function ensureCoupon(
  id: string,
  products: (string | null)[],
  params: Omit<Stripe.CouponCreateParams, "id" | "applies_to">,
  matches: (c: Stripe.Coupon) => boolean,
): Promise<void> {
  if (products.some((p) => !p)) {
    log(`coupon ${id}: book product missing (catalog not created yet${dryRun ? " — dry run" : ""}), skipped`);
    return;
  }
  const wanted = [...(products as string[])].sort();
  const existing = await stripe.coupons.retrieve(id, { expand: ["applies_to"] }).catch((err: { code?: string }) => {
    if (err.code === "resource_missing") return null;
    throw err;
  });
  if (existing) {
    const got = [...(existing.applies_to?.products ?? [])].sort();
    const ok = existing.valid && matches(existing) && JSON.stringify(got) === JSON.stringify(wanted);
    if (ok) log(`coupon ${id} ✓`);
    else log(`WARNING coupon ${id} differs (valid=${existing.valid}, products ${got.join(",")} vs ${wanted.join(",")}): delete it in the Dashboard and re-run`);
    return;
  }
  await act(`create coupon ${id} (${wanted.join(", ")})`, () =>
    stripe.coupons.create({ id, ...params, applies_to: { products: wanted }, metadata: { meapica: "promo-codes" } }),
  );
}

const [pdfProduct, softProduct, hardProduct] = await Promise.all([bookProductId("digital_pdf"), bookProductId("softcover"), bookProductId("hardcover")]);
await ensureCoupon(
  REFERRAL_COUPON_ID,
  [softProduct, hardProduct],
  { name: "Recomendación · 10 € libro impreso", amount_off: REFERRAL_DISCOUNT_CENTS, currency: "eur", duration: "once" },
  (c) => c.amount_off === REFERRAL_DISCOUNT_CENTS && c.currency === "eur",
);
const bookProducts = { digital_pdf: pdfProduct, softcover: softProduct, hardcover: hardProduct };
// Customer-facing in Checkout (max 40 characters).
const VOUCHER_COUPON_NAMES = { hardcover: "Tarjeta regalo · tapa dura", softcover: "Tarjeta regalo · tapa blanda", digital_pdf: "Tarjeta regalo · PDF" };
for (const format of VOUCHER_FORMATS) {
  await ensureCoupon(
    VOUCHER_COUPON_IDS[format],
    [bookProducts[format]],
    { name: VOUCHER_COUPON_NAMES[format], percent_off: 100, duration: "once" },
    (c) => c.percent_off === 100,
  );
}

// ── Webhook ───────────────────────────────────────────────────────────────────
if (webhookUrl) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const hook = endpoints.data.find((e) => e.url === webhookUrl);
  if (hook) {
    await act(`update webhook ${hook.id} (enable + events)`, () =>
      stripe.webhookEndpoints.update(hook.id, { enabled_events: WEBHOOK_EVENTS, disabled: false }),
    );
    log(`webhook ${hook.id} → ${webhookUrl} (secret unchanged; roll it in the Dashboard if lost)`);
  } else {
    const created = await act(`create webhook → ${webhookUrl}`, () =>
      stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: WEBHOOK_EVENTS,
        api_version: Stripe.API_VERSION as Stripe.WebhookEndpointCreateParams.ApiVersion,
        description: "Meapica orders",
      }),
    );
    if (created) log(`webhook ${created.id} created. SIGNING SECRET (store as STRIPE_WEBHOOK_SECRET_${mode}): ${created.secret}`);
  }
}
