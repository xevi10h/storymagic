# Audit 2026-09-28 — purchase, fulfilment, post-purchase, SEO/GEO

Read-only audit run after creation flow v2 went live (2026-09-28). Nothing was changed.
Each area is worked in its own conversation (prompts in `docs/next-chats-prompts.md`).
Verify every file:line before acting — code moves.

## 1. Purchase: Stripe + final book

Works: checkout creates order + Stripe session with story/user/format metadata
(`src/app/api/checkout/route.ts:126-164`); webhook and `/checkout/verify` flip `pending → paid`
with a CAS update and exactly-once confirmation email; cron every 5 min calls `/complete`;
resumable final pipeline (lease, per-scene checkpoints, `render_stage`, QA, `ready`, retries,
ops alerts); final book ≈100-110 s / ≈$1.8 (fits 270 s). Vercel prod has `STRIPE_ENVIRONMENT=live`,
test+live keys, `CRON_SECRET`, `GELATO_FULFILLMENT_MODE=direct`. 0 live Meapica sessions so far.

P0
- **Live Stripe webhook `we_1T8hz2…` (meapica.com/api/webhooks/stripe) is DISABLED** and only
  listens to `checkout.session.completed/expired`. If the buyer closes the tab after paying the
  order stays `pending` forever (cron only takes `paid`, `cron/fulfill-orders/route.ts:68`).
  Re-enable/recreate, add `checkout.session.async_payment_succeeded` + `charge.refunded`, check
  `STRIPE_WEBHOOK_SECRET_LIVE`. No test-mode endpoint exists.
- **PDF download likely broken on Vercel**: `api/stories/[storyId]/pdf/route.ts:118-129,217-227`
  streams the PDF through the function (4.5 MB response cap; print PDFs are 4.6-31 MB) and renders
  digital-only books on demand with `maxDuration=60` (line 9) while the pipeline needs ~100 s and
  only pre-builds PDFs for physical orders (`pipeline.ts:530`). Fix: build the PDF in the pipeline
  for every format, store it in `book-pdfs`, redirect to a signed URL.
- **Stripe shows "Constrack"** (shared account `business_profile.name`) and descriptor
  "XAVIER HUIX TRENCO" → trust/chargeback risk. Decision: separate Stripe account vs rename.

P1
- VAT: all 6 Prices (live+test 990/3490/4990) `tax_behavior: unspecified`, no `tax_code`, no
  `automatic_tax`, no `invoice_creation`; add-on `price_data` (`checkout/route.ts:93-99`) same.
  Books are likely **4 % IVA** in Spain (printed + ebook) — confirm with gestor. B2C → `inclusive`.
- Extra copy: UI says "mismo formato" (`es.json:1151`), pipeline orders `quantity: 2`
  (`pipeline.ts:616`), but a second hardcover sells for +15 € (`pricing.ts:66-68`) — likely below
  cost; Stripe line says "Extra Copy (Softcover)".
- No `charge.refunded` handling → refunded orders still generate and print.
- Free shipping to 18 countries incl. GB/CH/NO (`checkout/route.ts:143-149`): no shipping rates,
  no phone for the carrier, customs unhandled; copy promises "España y resto de Europa".
- `EMAIL_FROM` unset in prod → sender falls back to `hola@constrack.pro` (`email/send.ts:13`);
  `OPS_ALERT_EMAIL` unset.

P2
- `success_url`/`cancel_url` without locale, no Checkout `locale` (`checkout/route.ts:139-140`).
- No idempotency key on `sessions.create` (double click = 2 sessions); `payment_method_types:["card"]` only.
- Checkout requires `generated_text` + preview/ready; fulfilment throws without `imagePlan`
  (`pipeline.ts:274-277`) → old previews unpurchasable, no UI message.

## 2. Gelato

Works: product UIDs `photobooks-{hard,soft}cover_pf_200x200…_bt_glued-left_ct_matt-lamination`
(170 g silk) valid, ship to ES/FR/DE/GB/CH/NO; `pageCount` = inner pages, even 28-200 (checked live).
Print cost ES excl. shipping (live price API): hardcover **11,76 €** (12,36 € at 34 pages),
softcover **8,92 €**. Cover geometry from live `/v3/products/{uid}/cover-dimensions`, parity,
208 mm page, DPI ≥150 (warn <300) validated before submit (`print-files.ts:30-53`). Dedupe: CAS
claim + `orders:search` by `orderReferenceIds`; 8 retries with backoff, alert from attempt 3; cron
every 5 min; >48 h stuck escalates. Draft orders only when `STRIPE_ENVIRONMENT` ≠ live (no Gelato
sandbox key). Prod env has `GELATO_API_KEY`, both `GELATO_PRODUCT_UID_*`, `GELATO_WEBHOOK_SECRET`,
`GELATO_FULFILLMENT_MODE=direct`. Address mapped from Stripe shipping (`pipeline.ts:544`).
Status transitions forward-only with CAS + exactly-once emails.

P0
- **Tracking never captured**: `webhooks/gelato/route.ts:180-196` reads
  `event.items[].shipment.trackingCode`, but `order_item_status_updated` is flat; tracking comes in
  `order_status_updated.items[].fulfillments[]` (ignored by `handleOrderStatusUpdated`, `:172`) and
  `order_item_tracking_code_updated` (falls to silent `default`, `:56`). Types `types.ts:108-128`
  wrong. → "shipped" email and dashboard never have a tracking link.
- **Webhook registration unverified**: Gelato has no signature/custom headers, so the secret must
  be `?secret=` in the registered URL; if missing, every event 401s silently
  (`launch-checklist.md:28`). Check in the Gelato dashboard.

P1
- `pending_approval` mapped to "producing" (`fulfilment/logic.ts:20`) though Gelato waits for
  manual approval; `on_hold`/`not_connected` only logged (`route.ts:108`) → alert ops for all three.
- Extra copy "(Softcover)" 15 € (`pricing.ts:66-68`) but `pipeline.ts:616` orders quantity 2 of the
  same product → a second hardcover for ~12,40 € net vs 11,76 € + shipping.
- No status reconciliation cron (Gelato retries webhooks only 3×/5 s) → poll `GET /v4/orders/{id}`
  for orders stuck in producing/shipped.
- `launch-checklist.md:66-72` stale (says `test`/`owner`; prod is `live`/`direct`).

P2: connected (split) orders treated as duplicates (`pipeline.ts:588`, webhook lookup by
`gelato_order_id` only, `route.ts:93`); only first word → `firstName` (`pipeline.ts:549`); no phone
collected (`checkout/route.ts:143`); `delivered` depends on carrier.

Margin (shipping not verified — quote call was blocked): hardcover 49,90 € incl. shipping =
41,24 € net at 21 % / 47,98 € at 4 %; cost 11,76 € print + ES shipping + ~1 € Stripe + ~1,75 $
images. Previous real ES quote: margin ≈21,7 € hardcover / ≈12,5 € softcover (at 21 %).
Open: VAT 4 % vs 21 % (≈6,7 € margin swing), keep softcover?, countries (GB/CH/NO customs;
FR/DE/IT need translated books; ES-only or ES+PT?), extra copy real softcover vs reprice,
manual approval enabled in the Gelato account?, glued vs layflat/sewn binding (earlier "cosido" claims).

## 3. Post-purchase + user area

Works: Resend REST emails es/ca/en/fr for order confirmed (physical/digital), book ready, in
production, shipped (tracking), delivered; exactly-once via CAS columns
(`fulfilment/emails.ts:28-51`, `pipeline.ts:646`, `webhooks/gelato/route.ts:140-166`); guest
recipient from Stripe `customer_details.email`. Dashboard (`dashboard/page.tsx`): stories / orders /
characters tabs, title edit, 4-step order stepper, PDF download, "new book with this character"
(`/crear?characterId=`). `/perfil` exists.

P0
- **meapica.com has no email DNS**: no SPF, DKIM (`resend._domainkey`), DMARC, `send.` MX, no MX
  for replies. Emails come from `hola@constrack.pro`.
- **Emails greet the child** ("Hola Teo,") instead of the parent (`order-emails.ts:59,119,338`).
- **"Book ready" link** `/api/stories/{id}/pdf` (`pipeline.ts:392`): 404 for a logged-in different
  account (`pdf/route.ts:64-70`); **anyone without a session gets the PDF of any paid storyId**, no
  token (`pdf/route.ts:45-60`); `?force=true` re-renders unthrottled. Need per-order tokenised link.
- **No withdrawal-exemption notice at checkout** (art. 103 c/m LGDCU; digital PDF needs express
  consent + acknowledgement of losing the right).

P1
- Confirmation email is not a receipt: no amount, VAT line, items, address (`order-emails.ts:84-90`)
  while the success page calls it "tu comprobante". No invoice (factura simplificada) anywhere.
- No customer email on failure/delay/refund/cancel (ops alerts only, `fulfilment/alerts.ts`).
- Guests can't recover books on another device: anonymous sessions (`guest-session.ts:18`), upgrade
  only email+password/linkIdentity on the same device (`auth/signup/page.tsx:49-60,116`); checkout
  email (`orders.customer_email`) never linked to an account; no magic link / "find my order".
- Dashboard PDF button hidden once shipped/delivered (`dashboard/page.tsx:341`).
- No reorder / gift-another-copy flow.

P2 — more book types
- 10 worlds; each = `STORY_TEMPLATES` (`create-store.ts:293`), `STORY_TREES`
  (`story-trees/index.ts:18`), hardcoded `VALID_TEMPLATE_IDS` (`api/stories/route.ts:8`),
  `TEMPLATE_THEMES` (`pdf/theme.ts:54`), `THEME_TEMPLATE` (`seo-landing.ts:33`), `data.templates` in
  4 message files, cover + ~39 path-art images (~0,50 € fal). ~1-2 days per world. Derive the
  registries from one source first. Seasonal worlds need availability windows (none today).
- Siblings / 2 protagonists = schema change (`stories.character_id` single) + prompts/consistency/
  avatar → multi-week.

## 4. SEO / GEO (score 62/100)

Good: 116 sitemap URLs, hreflang es/ca/en/fr + x-default, self-canonicals, per-page OG, Product/
Offer with `valueAddedTaxIncluded: true`, AI crawlers allowed.
**No search data at all**: meapica not in `cana` (`~/.config/casmar-analytics/sites.json`), no GSC
property. Owner must verify `sc-domain:meapica.com` in GSC and add the service account.

P0
- Home mobile Lighthouse 57, FCP 8.4 s, LCP 11.3 s: full Material Symbols font (1.1 MB,
  render-blocking) in `src/app/layout.tsx:34`; hotlinked temporary Stitch image
  `lh3.googleusercontent.com/aida-public/...` in `globals.css:204`; `/es` served `no-store`.
- Home title "Meapica — Historias Reales para Tocar" / H1 without "cuento personalizado".
- `/llms.txt` 404.
- Product schema: `icon-512.png` as image (`components/seo/JsonLd.tsx:123`), no
  `shippingDetails`/`hasMerchantReturnPolicy`, `sameAs: []` (line 24).
- GSC + Bing Webmaster + IndexNow not set up (ChatGPT search uses Bing).

P1
- `/crear` noindex but canonical → `/es` (`[locale]/layout.tsx:32`) and home title; robots rule
  `/*/crear/` (`robots.ts:11`) never matches.
- `/en/blog`, `/fr/blog` indexed with 0 posts. `/ejemplo` thin, no OG; `/ejemplo/[id]` noindex
  (`ejemplo/[storyId]/layout.tsx:94`) though real books are the best proof.
- CLS 0.193 on SEO pages; `/legal` has 5 H1s; FAQPage only on /legal; sitemap `lastmod` = build time.
- Blog: 6 posts, es/ca only, no OG/schema on index.

P2: en/fr programmatic pages (half the URLs) only if selling there (product decision); `Book`
schema on showcase books; Organization `contactPoint` + address.

Market: ES SERPs owned by listicles (bebesymas, adslzone) + Mumablue (34,99 €), Hurra Héroes,
Wonderbly, Lola Pirindola, Aventopia. **CA SERPs weak** (Ludobooks, Xevidom, Bosc de Contes).
Oct–Dec window = Navidad + Reyes (pages indexed and linked by mid-November).
GEO: get into cited listicles (free real book to editors), honest comparison page with verifiable
facts, fact-dense Q&A, llms.txt + Wikidata + sameAs, genuine forum presence (SocPetit, r/spain).
Never fabricate reviews/stats.
