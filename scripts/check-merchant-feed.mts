// Validates the product feeds (src/lib/merchant-feed.ts) against the Merchant Center
// and ChatGPT feed specs and against the real prices (PRICING / STRIPE_CATALOG).
//
//   npx tsx --tsconfig tsconfig.json scripts/check-merchant-feed.mts [feedBaseUrl]
//
// With feedBaseUrl (e.g. http://localhost:3034) it also checks the served feeds are
// byte-identical to the builders' output and have the right content type.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  FEED_FORMATS,
  FEED_IMAGES,
  buildFeedItems,
  buildGoogleMerchantXml,
  buildOpenAiJsonl,
  buildOpenAiRecords,
  feedPrice,
} from "../src/lib/merchant-feed";
import { PRICING, STRIPE_CATALOG } from "../src/lib/pricing";
import { DELIVERY_BUSINESS_DAYS, SITE_URL } from "../src/lib/product-facts";

const items = buildFeedItems();
const xml = buildGoogleMerchantXml(items);

// ── Items ────────────────────────────────────────────────────────────────────
assert.equal(items.length, FEED_FORMATS.length, "one item per format");
assert.equal(new Set(items.map((i) => i.id)).size, items.length, "unique ids");

for (const item of items) {
  const where = `[${item.id}]`;
  assert.ok(item.id.length <= 50, `${where} id ≤ 50`);
  assert.ok(item.title.length > 0 && item.title.length <= 150, `${where} title 1-150`);
  assert.ok(item.description.length > 0 && item.description.length <= 5000, `${where} description 1-5000`);
  assert.ok(!/\bIA\b|inteligencia artificial|\bAI\b/i.test(`${item.title} ${item.description} ${item.highlights.join(" ")}`), `${where} no AI selling point`);
  for (const h of item.highlights) assert.ok(h.length <= 150, `${where} highlight ≤ 150`);
  assert.ok(item.highlights.length <= 10, `${where} ≤ 10 highlights`);
  assert.ok(item.link.startsWith(`${SITE_URL}/`), `${where} link on the verified domain`);
  for (const u of [item.imageLink, ...item.additionalImageLinks]) {
    assert.ok(u.startsWith(`${SITE_URL}/images/feed/`) && u.endsWith(".jpg"), `${where} image url ${u}`);
  }
  assert.ok(item.additionalImageLinks.length <= 10, `${where} ≤ 10 additional images`);

  // Price = the real catalog price (VAT-inclusive), formatted "49.90 EUR".
  assert.equal(item.priceCents, PRICING[item.format].price, `${where} price = PRICING`);
  assert.equal(item.priceCents, STRIPE_CATALOG[item.format].amount, `${where} price = STRIPE_CATALOG`);
  assert.match(feedPrice(item.priceCents), /^\d+\.\d{2} EUR$/, `${where} price format`);
  assert.ok(item.priceCents > 0, `${where} price > 0`);

  // Shipping: free, ES only; printed books only to peninsula + Balearics.
  assert.ok(item.shipping.length > 0, `${where} has shipping`);
  for (const s of item.shipping) {
    assert.equal(s.country, "ES");
    assert.equal(s.priceCents, 0, `${where} free shipping`);
    for (const d of [s.handling.min, s.handling.max, s.transit.min, s.transit.max]) assert.ok(Number.isInteger(d) && d >= 0 && d <= 30, `${where} days 0-30`);
    assert.ok(s.handling.min <= s.handling.max && s.transit.min <= s.transit.max, `${where} min ≤ max`);
    if (item.printed) {
      assert.equal(s.postalCode, undefined, `${where} no postal code (Google rejects it for ES)`);
      assert.equal(s.handling.min + s.transit.min, DELIVERY_BUSINESS_DAYS.min, `${where} min days = promise`);
      assert.equal(s.handling.max + s.transit.max, DELIVERY_BUSINESS_DAYS.max, `${where} max days = promise`);
    }
  }
}

// ── Google XML ───────────────────────────────────────────────────────────────
assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "xml declaration");
assert.ok(xml.includes('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'), "rss + g namespace");
const xmlItems = xml.split("<item>").slice(1);
assert.equal(xmlItems.length, items.length, "xml item count");
const REQUIRED = ["id", "title", "description", "link", "image_link", "availability", "price", "brand", "identifier_exists", "condition", "google_product_category", "is_bundle", "age_group", "shipping"];
xmlItems.forEach((block, i) => {
  for (const f of REQUIRED) assert.ok(block.includes(`<g:${f}>`), `xml item ${i}: g:${f}`);
  const val = (f: string) => block.match(new RegExp(`<g:${f}>([^<]*)</g:${f}>`))?.[1];
  assert.equal(val("id"), items[i].id);
  assert.equal(val("price"), feedPrice(PRICING[items[i].format].price), `xml price ${items[i].id}`);
  assert.equal(val("availability"), "in_stock");
  assert.equal(val("condition"), "new");
  assert.equal(val("identifier_exists"), "no");
  assert.equal(val("brand"), "Meapica");
  assert.equal(val("is_bundle"), "no");
  assert.equal(val("age_group"), "kids");
  assert.ok(!/<g:gtin>|<g:mpn>/.test(block), "no identifiers on custom goods");
});
// Every raw & is an entity (well-formedness spot check; the full check is xmllint).
assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), "escaped ampersands");

// ── OpenAI JSONL ─────────────────────────────────────────────────────────────
const jsonl = buildOpenAiJsonl(items);
const lines = jsonl.trimEnd().split("\n");
assert.equal(lines.length, items.length, "jsonl line count");
lines.forEach((line, i) => {
  const r = JSON.parse(line) as Record<string, unknown>;
  for (const f of ["item_id", "title", "description", "url", "brand", "seller_name", "image_url", "availability", "price"]) {
    assert.ok(typeof r[f] === "string" && (r[f] as string).length > 0, `jsonl ${i}: ${f}`);
  }
  assert.equal(r.price, feedPrice(PRICING[items[i].format].price));
  assert.equal(r.availability, "in_stock");
});
assert.deepEqual(buildOpenAiRecords(items).map((r) => r.item_id), items.map((i) => i.id));

// ── Image files (built by scripts/build-merchant-feed-images.mts) ─────────────
for (const rel of Object.values(FEED_IMAGES)) {
  const file = path.join(process.cwd(), "public", rel);
  assert.ok(existsSync(file), `missing ${rel}`);
  const meta = await sharp(file).metadata();
  assert.equal(meta.format, "jpeg", `${rel} is a JPEG`);
  assert.ok((meta.width ?? 0) >= 1500 && (meta.height ?? 0) >= 1500, `${rel} ≥ 1500 px`);
  assert.ok(meta.xmp?.toString().includes("digitalsourcetype/trainedAlgorithmicMedia"), `${rel} IPTC DigitalSourceType`);
}

// ── Served feeds (optional) ──────────────────────────────────────────────────
const base = process.argv[2];
if (base) {
  const g = await fetch(`${base}/feeds/google-merchant.xml`);
  assert.equal(g.status, 200, "google feed 200");
  assert.match(g.headers.get("content-type") ?? "", /^application\/xml/);
  assert.equal(await g.text(), xml, "served google feed = builder");
  const o = await fetch(`${base}/feeds/openai-products.jsonl`);
  assert.equal(o.status, 200, "openai feed 200");
  assert.match(o.headers.get("content-type") ?? "", /^application\/jsonl/);
  assert.equal(await o.text(), jsonl, "served openai feed = builder");
}

console.log(`✓ merchant feeds OK (${items.length} items${base ? `, served by ${base}` : ""})`);
