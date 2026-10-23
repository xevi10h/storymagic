# Stack & infrastructure (Meapica)

> The full stack table, data model and file tree live in `docs/technical-architecture.md`;
> the image engine in `docs/generation-pipeline.md`. This file holds infrastructure
> runbooks that change how things are deployed.

## Supabase Storage buckets

| Bucket | Access | Holds |
|---|---|---|
| `illustrations` | **Private** | Every generated image of a child: avatar portraits, character sheets, scenes, covers |
| `showcase` | Public | Marketing copies only: is_showcase example books, waitlist covers, style samples, blog images, mock art |
| `book-pdfs` | Private, server-only (client policies dropped 20260930160000) | Rendered PDFs (digital download + Gelato print files), 1 h / 7 d signed URLs |
| `child-photos` | Private, server-only (no storage policies) | The child's photo (flagged feature): bytes read server-side, never a URL; deleted after the early child sheet, hourly purge ≤ 24 h |

## Private illustrations (2026-09-27)

Illustrated likenesses of real children were world-readable by URL, forever. Now:

- **DB stores object paths** ("illustration refs"): `stories.cover_image_url`,
  `stories.character_portrait_url`, `characters.avatar_url`, `story_illustrations.image_url`,
  and `generated_text.imagePlan.avatarUrl` / `imageAssets.*`. Legacy rows holding the old
  public URL keep working (`illustrationPath()` parses the path out).
- **Ownership comes from the path**, never from a user-editable column:
  `{storyId}/…` → story owner · `portraits/{userId}/…` → that user · legacy
  `portraits/{uuid}/…` → only when one of the user's own rows references it.
- **Signed URLs** (`src/lib/storage/illustration-urls.ts`, batch `createSignedUrls`):

  | Consumer | How | TTL |
  |---|---|---|
  | Book preview / flipbook (`GET /api/stories/[id]`) | `signStoryRowImages` (owner via RLS query + `user_id`) | 1 h |
  | Dashboard avatars (`GET /api/dashboard`) | `signIllustrationRefs` + `userAccess` | 1 h |
  | Generating screen (`GET /api/stories/[id]?light=true` → `preview_progress`) | `signPreviewProgress` (owner via RLS query + `user_id`), stable `key` per image so polls don't swap images | 1 h |
  | AI portrait (`POST /api/characters/portrait`, not used by the v2 UI) | signed on upload; re-sign own refs via `POST /api/illustrations/sign` | 24 h |
  | OpenAI references, QA judge, PDF render (preview, final, print) | `toServerFetchUrl` (service role) | 10 min |
  | Gelato | never sees illustrations: images are embedded in the print PDFs (`book-pdfs`, 7-day signed URL) | — |
  | Showcase / examples / landing / OG / waitlist | `toShowcaseUrl` → public `showcase` mirror (never signed: cached pages + OG) | public |
  | Emails | contain no child imagery | — |

- **Anonymous guests** are `authenticated` Supabase users with a uid, so they own their
  stories/portraits exactly like registered users.
- **next/image** only optimizes `/storage/v1/object/public/**` (`next.config.ts`): the
  optimizer caches by full URL for max(minimumCacheTTL, upstream max-age = 1 year), which
  would outlive a signature. Children's images render with plain `<img>`.
- **Input hardening**: `POST /api/stories` stores only the caller's own portrait path;
  `/generate` re-checks it before using it as a reference. The child photo is addressed only by
  a `child-photos` object path (`{userId}/{uuid}.jpg`, regex + ownership + open consent row), so no
  client-supplied URL is ever fetched. The pre-rendered avatar anchor is a `/images/avatar/…` path
  (strict regex) fetched only from our own site (`NEXT_PUBLIC_SITE_URL`), never from a request-derived host.
- Storage RLS (`20260927140400_private_illustrations.sql`): all old policies mentioning the
  bucket dropped; owners may SELECT their own story folders / `portraits/{uid}/`; no client
  writes (uploads are service-role only).

### Deploy order — creation flow v2 (do not reorder)

Six migrations, all dated 2026-09-27. Apply them **one at a time** (Supabase MCP `apply_migration`,
which records the version, or the SQL editor followed by
`supabase migration repair --status applied <version>`), never with a single `supabase db push`:
`20260927140400` must wait until the new code is live.

| Version | File | When |
|---|---|---|
| 20260927140000 | `child_photos.sql` (private bucket, `photo_consents`, purge RPC) | before the deploy (additive) |
| 20260927140100 | `streaming_preview.sql` (`character_preps`, `stories.character_prep_id`, `stories.preview_progress`) | before the deploy (additive) |
| 20260927140200 | `character_look_traits.sql` (`characters.glasses`, `characters.freckles`) | before the deploy (additive) |
| 20260927140300 | `showcase_bucket.sql` (public `showcase`) | before `publish-showcase` |
| 20260927140400 | `private_illustrations.sql` (flip + owner policies) | AFTER the deploy |
| 20260927140500 | `illustration_paths_backfill.sql` (URLs → paths, idempotent) | any time after 140400 |

1. **Apply** 140000, 140100, 140200 (additive; the old code ignores them).
2. **Apply** 140300 (creates public `showcase`).
3. **Run** `npx tsx --tsconfig tsconfig.json scripts/publish-showcase.mts --dry-run`, then without
   `--dry-run` (copies showcase stories, waitlist covers, style samples, blog images; rewrites
   blog rows to the showcase URL). Must precede the deploy: the new code serves every public
   page (landing, `/examples`, OG, waitlist) from `showcase`.
4. **Env (Vercel prod):** `CRON_SECRET` set (both crons need it); `NEXT_PUBLIC_SITE_URL=https://meapica.es` (avatar anchors are fetched from it); `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED`
   unset/false until the DPIA + OpenAI DPA are signed.
5. **Deploy the code** (works with the bucket still public: signed URLs also work on public buckets).
   Check `/examples`, landing BookCollection, waitlist page, blog; create a book end to end
   (protagonist → prepare → story → generating screen shows images → preview).
6. **Apply** 140400 (flip `illustrations` to private + owner read policies).
7. **Apply** 140500 whenever convenient.
8. Smoke test: preview of an existing story, dashboard avatar, a new book's generating screen and
   preview, `/examples/[slug]`, an old public illustrations URL → 400. `GET /api/cron/purge-photos`
   with the bearer secret → 200.

**Rollback:** `update storage.buckets set public = true where id = 'illustrations';` (code keeps working).

**Operational rule:** after flagging a story `is_showcase = true`, re-run `scripts/publish-showcase.mts`
(otherwise its images 404 on public pages). Unflagging does not delete the public copy.
Showcase stories may be `ready` or `ordered` (`SHOWCASE_STATUSES` in `src/lib/showcase.ts`). Current
examples (showcase v2, 2026-09-30): Martí/space, Aitana/pirates, Noa/forest, Leo/dinosaurs, Lucía/castle
(ES originals made by the production pipeline, owner `showcase+examples@meapica.com`) plus ca/en/fr copies that
reuse the same art rows with translated text (`story_decisions.showcaseTranslationOf` = the ES id); ids in
`docs/product-spec.md` › Showcase curation. The mirror also copies each book's hero portrait and adventure map
(`generated_text.imageAssets.finalHero/finalMap`) for the example PDF.

Known residuals: legacy portraits (`portraits/{uuid}/…`) can be re-signed by any user who
writes that path into their own character row — only possible for someone who already had the
old public URL. A preview tab left open > 1 h shows broken images for pages not yet loaded
(reload fixes it). `illustration_library` (unused cache table) was not migrated.

## Payments — Stripe (2026-09-28)

**Account:** Meapica has its own Stripe account (not Constrack's). Sandbox `acct_1UKcQsBD04FISl5u`
("Meapica sandbox", ES/EUR). Live `acct_1UKcQRAyKcfLUpfG` ("Meapica", descriptor "MEAPICA"),
activated and configured 2026-09-28 (setup script run; live webhook `we_1UKekqAyKcfLUpfGWsbB0sRn`).
Seller on invoices: Xavier Huix Trenco (autónomo), NIF 41649433K, Carrer Aribau 140, 5º, 08036 Barcelona.

**Setup is code:** `STRIPE_KEY=sk_… npx tsx --tsconfig tsconfig.json scripts/stripe-setup-catalog.mts --webhook-url=https://meapica.es/api/webhooks/stripe`
(idempotent, `--dry-run` available) configures, on the account behind the key:
- Stripe Tax: head office Barcelona, ES registration `standard` / `small_seller` (Spanish VAT also on
  EU digital sales while under the 10 000 € OSS threshold; switch to OSS with the gestor when crossed),
  default `tax_behavior: inclusive`. Verified: 4 % (`reduced_rated`) for both tax codes, 0 % Canarias.
- Seller tax id `es_cif 41649433K` (printed on invoices).
- Catalog = `STRIPE_CATALOG` in `src/lib/pricing.ts` (single source): 5 VAT-inclusive Prices with lookup
  keys `meapica_{digital_pdf,softcover,hardcover,extra_copy_softcover,extra_copy_hardcover}`
  (9,90 / 34,90 / 49,90 / 19,90 / 29,90 €) + `meapica_upgrade_{softcover,hardcover}` (25,00 / 40,00 €, PDF→print
  upgrade; created in TEST 2026-09-30, **run the script with the live key at deploy** — until then the upgrade
  offer is hidden, never mispriced), tax codes `txcd_10302000` (digital book) and
  `txcd_35010001` (children's book). Changing an amount: edit `STRIPE_CATALOG`, re-run the script
  (new Price takes the lookup key, old one archived). The server refuses to sell if a Price's
  amount/tax behaviour drifts from the code (`getStripeCatalog`).
- Coupons (2026-10-09, `src/lib/promo-codes.ts`): `meapica_referral_10` (10 € amount_off EUR, applies_to the
  softcover + hardcover products) and `meapica_voucher_{hardcover,softcover,digital_pdf}` (100 %, applies_to that
  format's product), plus catalog Prices `meapica_voucher_{digital_pdf,softcover,hardcover}` (9,90 / 34,90 / 49,90 €,
  same tax codes as the books). Created in TEST 2026-10-09; **run the script with the live key at deploy** (until
  then referral codes and vouchers stay hidden). Coupons are immutable: a wrong one is reported, delete + re-run.
  Promotion codes are created by the app (one per order / reward / voucher), never by the script.
- Webhook endpoint (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
  `charge.dispute.created`); a NEW endpoint prints its signing secret once. **The last two events are
  new (2026-09-30): add them to the existing live + test endpoints (or re-run the script).**

**Endpoints:** both modes point at `https://meapica.es/api/webhooks/stripe` (moved 2026-10-23: live
`we_1UKekqAyKcfLUpfGWsbB0sRn` from `.shop`, test from `meapica.com`); the route verifies with
`STRIPE_WEBHOOK_SECRET_LIVE` and `STRIPE_WEBHOOK_SECRET_TEST` and ignores events whose mode ≠
`STRIPE_ENVIRONMENT`. Test endpoint: `we_1UKdD8BD04FISl5urkd8gXlZ` (sandbox). The old Constrack live
endpoint `we_1T8hz2…` is obsolete once the new live account is in use.

**Env (Vercel production):** `STRIPE_ENVIRONMENT` (`live`), `STRIPE_SECRET_KEY_LIVE`,
`STRIPE_WEBHOOK_SECRET_LIVE`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST` (the last two
already hold the Meapica sandbox values). No publishable key is used (redirect Checkout).

**Checkout:** `automatic_tax`, `invoice_creation` (factura with NIF; Stripe Invoicing fee applies),
`tax_id_collection` (customer may add a NIF → factura completa; a full refund issues a credit note =
factura rectificativa, `src/lib/fulfilment/payments.ts`),
locale es/en/fr (Stripe has no Catalan → es), shipping ES only, card only, promotion codes allowed.
Invoices are not VeriFactu-compliant: move to a VeriFactu tool before the obligation applies (2027).

**Stripe-mode isolation:** local dev uses the prod database. Cron + pipeline only fulfil orders whose
`stripe_checkout_session_id` prefix matches `STRIPE_ENVIRONMENT` (`isOrderForActiveStripeMode`,
`src/lib/fulfilment/logic.ts`), so a paid test order is never printed by the live deployment.

**Local testing:** run the dev server with `MOCK_MODE=false NEXT_PUBLIC_MOCK_MODE=false
STRIPE_ENVIRONMENT=test STRIPE_WEBHOOK_SECRET_TEST=<stripe listen secret>` and
`stripe listen --api-key $STRIPE_SECRET_KEY_TEST --forward-to localhost:3013/api/webhooks/stripe`.
Real-purchase scripts: `e2e/_real-create.mjs` (guest → preview, ~$0.35), `e2e/_real-buy.mjs`
(Checkout with 4242…; `FORMAT`, `EXTRA=1`, `VIA_API=1`), `e2e/_real-api.mjs`, `e2e/_real-dash.mjs`.
Mocked UI suite: `npx playwright test e2e/paywall.spec.ts`.

### Deploy order — commerce block (2026-09-28)

| Version | File | When |
|---|---|---|
| 20260928120000 | `commerce_ready.sql` (statuses cancelled/refunded, download_token, consent, invoice, refunded_at, unique session id) | applied 2026-09-28 (additive) |
| 20260928120100 | `orders_no_client_insert.sql` (drop "Users can insert own orders") | applied 2026-09-28 after the deploy |

**Status 2026-09-28: LIVE.** Deployed (1770b50), live keys + webhook secret in Vercel, prod smoke test
OK (live session 79,80 € / IVA 3,07 €; expired event delivered → order `cancelled`). Remaining: one
real payment + refund by the owner; the old Constrack endpoint `we_1T8hz2…` was already disabled.

Go-live (done): activate the live account → run the setup script with the live key + `--webhook-url` →
set `STRIPE_SECRET_KEY_LIVE` / `STRIPE_WEBHOOK_SECRET_LIVE` in Vercel → deploy → apply 120100 →
one real live payment + immediate refund (owner OK) → disable the old Constrack endpoint.

## Accounts, admin & retention (2026-09-30)

**Supabase Auth (dashboard, not in git — owner applies):** custom SMTP = Resend (`smtp.resend.com:465`,
user `resend`); Email OTP length 6, expiry 3600; manual linking ON; Google provider ON; Site URL
`https://meapica.shop`; redirect allow-list `https://meapica.shop/**`, `https://www.meapica.shop/**`, `https://meapica.com/**`, `https://www.meapica.com/**`,
`http://localhost:3013/**`. Templates "Magic Link" and "Change Email Address" = `supabase/templates/*.html`
(+ `.subject.txt`).

**Anti-abuse (Cloudflare Turnstile + daily cap):** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Vercel, all envs,
inlined at build → redeploy after changing; unset = no captcha). The Turnstile secret lives only in Supabase
→ Auth → Attack Protection (enable only after the site key is deployed). Captcha tokens are sent on
`signInAnonymously` and `signInWithOtp` (the only calls Supabase checks). `DAILY_PREVIEW_CAP` (default 300,
0 = off): global per-UTC-day ceiling on new AI previews; ops alert at 80 % and 100 % via `OPS_ALERT_EMAIL`.

**Env (Vercel prod):** `ADMIN_EMAILS` (comma-separated; empty = nobody gets into `/admin`).
`CRON_SECRET` also guards `/api/cron/purge-guests` (vercel.json, daily 03:40 UTC) and `/api/cron/upsell-reminders` (daily 08:00 UTC, `?dry_run=1`). Unsubscribe tokens are HMAC-signed with a key derived from `SUPABASE_SERVICE_ROLE_KEY`; commercial emails send `List-Unsubscribe` + `List-Unsubscribe-Post` via Resend headers. Guest-merge cookie
key is derived from `SUPABASE_SERVICE_ROLE_KEY` (no new var).

### Deploy order — accounts/orders/security (2026-09-30)

| Version | File | When |
|---|---|---|
| 20260930130000 | `guest_merge.sql` (`merge_guest_account` RPC, service role only) | before the deploy (additive) |
| 20260930140000 | `order_notifications.sql` (notice email claims, `disputed_at`, `fulfilment_hold_reason`) | before the deploy (code selects them) |
| 20260930150000 | `admin_and_retention.sql` (requeue/reprint columns, `order_status_history`, `admin_audit_log`, `account_erasures`) | before the deploy |
| 20260930155000 | `upsell_offers.sql` (`orders.offer`, `offer_source_order_id`, index user_id+story_id) | before the deploy (checkout writes them) |
| 20260930156000 | `marketing_email.sql` (`orders.marketing_opt_out`, `upsell_reminder_sent_at`, `email_suppressions`) | before the deploy |
| 20260930160000 | `security_hardening.sql` (no browser writes, locked showcase, book-pdfs server-only, orders FKs SET NULL, newsletter/rate_limits closed) | **after** the deploy |
| 20260930170000 | `daily_preview_cap.sql` (atomic per-day counter RPC; code falls back to an approximate count without it) | after the deploy |
| 20260930180000 | `paywall_columns.sql` (revoke client read of `stories.generated_text` / `story_illustrations.prompt_used`; drop owner direct-read storage policy) | **after** the deploy |

## Gelato (print + shipping)

**Env (Vercel prod):** `GELATO_API_KEY`, `GELATO_PRODUCT_UID_HARDCOVER` / `_SOFTCOVER` (glued-left,
170 g silk, matt), `GELATO_FULFILLMENT_MODE=direct` (ships to the customer), `GELATO_WEBHOOK_SECRET`.
No Gelato sandbox: orders are `draft` unless `STRIPE_ENVIRONMENT=live`.

**Webhook:** register in Gelato → Developer → Webhooks
`https://meapica.es/api/webhooks/gelato?secret=<GELATO_WEBHOOK_SECRET>` (Gelato sends no signature
or custom headers) for `order_status_updated` and `order_item_tracking_code_updated`. Gelato retries
a failed delivery only 3×, so the fulfilment cron also reconciles every hour via `GET /v4/orders/{id}`.
Registered on `meapica.shop` with the secret since 2026-10-01; **move to the `.es` URL above is pending** (see Domains below).
**First real print order 2026-10-09** (gift code, hardcover, Sabadell): Gelato `orderType: order`, files `passed`,
shipped direct to the customer with `package_48_72`, cost 16,56 € (11,76 book + 4,80 shipping), delivery estimate 10-11 days.

**Shipping:** Spain only, península + Baleares; Canarias/Ceuta/Melilla excluded (postcode guard
before print). Standard shipping included in the price; at submit a live quote picks the cheapest
method. Phone collected in Checkout and sent to Gelato for the carrier. Delivery times and Reyes
order cut-offs: `src/lib/shipping.ts` (re-quote before each campaign).

## Ads tracking — Meta (2026-09-30)

Meta Pixel + Conversions API behind an AEPD cookie banner. Off until the env vars exist (Vercel production):
`NEXT_PUBLIC_META_PIXEL_ID` (build-time, redeploy after setting), `META_CAPI_TOKEN`, optional `META_CAPI_TEST_EVENT_CODE`
(Stripe test-mode purchases → Events Manager › Test events). External: Meta Business portfolio, ad account (EUR, Europe/Madrid),
dataset "Meapica web", `meapica.shop` domain verification (DNS TXT). Owner setup + first campaign: `docs/ads/setup-guide.md`.
Code map: `docs/technical-architecture.md` › Ads tracking. No TikTok Pixel (TikTok is organic only).

## Domains (meapica.es primary since 2026-10-23)

> **Live 2026-10-23 (`4c6cdbc`, promoted by hand):** Turnstile widget `0x4AAAAAAFLSoggPOt81EmD4` (shared with Constrack,
> named "constrack.pro +1 (Spin)") now lists `meapica.es` + `www.meapica.es`. Vercel: `meapica.es` no redirect,
> `www.meapica.es` and `www.meapica.shop` 308 → `meapica.es`, `meapica.shop` no domain redirect (middleware 308s pages, `/api`
> served). Supabase Site URL `https://meapica.es`. `vercel promote` restored auto-promotion
> (`autoAssignCustomDomains: true`, no `lastRollbackTarget`): pushes to `main` go live again.
> Changing domain redirects: `vercel api /v9/projects/prj_q2l2AcxlyfjXJEMLvirbrinMZbVf/domains/<name> -X PATCH -F redirect=<host|null>
> -F redirectStatusCode=308` (clear the apex redirect first: Vercel refuses chained redirects).

- **Primary: `meapica.es`** (+ `www`), registered at **Hostinger**, DNS there (API token `~/.config/hostinger/token`,
  `PUT https://developers.hostinger.com/api/dns/v1/zones/meapica.es`). Records: `@ A 216.150.1.1` + `216.150.16.1`,
  `www CNAME fc2bc1c75745d993.vercel-dns-017.com.`, Resend (`resend._domainkey` TXT, `send` MX + SPF TXT, `rsend` CNAME,
  root MX `10 receive-euw1.forge.rmta.net.` for inbound), `_dmarc` TXT `p=none`, `google-site-verification=zi6ZAB…` TXT.
  All canonical URLs, sitemap, OG, emails, legal texts, printed books (back cover + QR) use it (`src/lib/product-facts.ts`
  `SITE_URL`, `NEXT_PUBLIC_SITE_URL`).
- **Legacy: `meapica.shop`** (primary 2026-09-30 → 2026-10-23). **Keep renewing it forever:** printed books' QR, sent pitches,
  social bios and pins point to it. Stays attached to Vercel **without** a domain-level redirect, so `/api/*` webhooks still
  registered on it keep working; `src/middleware.ts` 308s every page to `meapica.es`. Once Stripe, Gelato and Resend inbound
  webhooks are on `.es`, it can become a domain-level 301 in Vercel. `www.meapica.shop` = Vercel 301 → `meapica.es`.
- **Legacy: `meapica.com`** stays attached and redirects too, but its DNS (Spaceship) is no longer ours: nothing may depend on it.
- **Host canonicalization:** `src/middleware.ts` 308-redirects `www.meapica.es`, `meapica.shop`, `www.meapica.shop`, `meapica.com`,
  `www.meapica.com` to `https://meapica.es` + same path/query (explicit list: localhost and `*.vercel.app` untouched).
  `/api/*` is never redirected (a webhook on an alias host must not get a 308); files outside the matcher (sitemap.xml,
  robots.txt, images) are still served on the aliases. Vercel domain redirects: `www.meapica.es` → `meapica.es`.
  next-intl's `Link` hreflang header is off (`alternateLinks: false`); hreflang lives in each page's `<link rel="alternate">`.
- **Supabase Auth:** Site URL `https://meapica.es`; allow-list .es, www.es, .shop, www.shop, .com, www.com, localhost:3013
  (Management API with `SUPABASE_PAT` from `.env.local`). SMTP sender `pedidos@meapica.es` via smtp.resend.com.
- **Email:** Resend domain `meapica.es` (id `28782f60-3f1a-4ec4-a80c-1977c165d5b5`, eu-west-1, Atalaya Resend account, sending +
  receiving) verified 2026-10-23. Prod `RESEND_API_KEY` = sending-only key scoped to it (`meapica-es-prod-sending`, file
  `~/.config/resend/meapica-es-sending`), `EMAIL_FROM=Meapica <pedidos@meapica.es>`, `EMAIL_REPLY_TO=admin@casmar.tech`.
  Inbound `*@meapica.es` → same Resend `email.received` webhook → forwarded to admin@casmar.tech from `hola@meapica.es`.
  Old domain `meapica.shop` (id `ac086507-…`) stays verified so `*@meapica.shop` keeps receiving.
  Admin key for domain management: `~/.config/resend/meapica`.
- **Webhooks (2026-10-23):** Stripe LIVE `we_1UKekqAyKcfLUpfGWsbB0sRn` and TEST `we_1UKdD8BD04FISl5urkd8gXlZ` (was on
  meapica.com) → `https://meapica.es/api/webhooks/stripe`. Resend inbound webhook `11260e42…` →
  `https://meapica.es/api/webhooks/resend-inbound` (test email OK). **Gelato still on `meapica.shop/api/webhooks/gelato`**
  (works through the alias): pending, no `gelato` browser profile yet and the dashboard sits behind Cloudflare; change the host
  only, keep path + `?secret=`. Until it moves, `meapica.shop` cannot become a domain-level 301.
- **Meta domain verification:** meapica.com + meapica.shop verified (meta tags in root layout + TXT on .shop). meapica.es: pending
  (no `meta-business` browser profile; the Graph API has no domain-verification edge for our system-user token). Get the TXT from
  Business settings › Brand safety › Domains and add it to Hostinger (add-only).
- **Gmail "Send mail as" (2026-10-23):** `Xavi de Meapica <hola@meapica.es>` added and confirmed in admin@casmar.tech (alias,
  smtp.resend.com:465 SSL, user `resend`, password = `~/.config/resend/meapica-es-sending`). `hola@meapica.shop` kept.
- **Bing DNS verification:** CNAME `410a995a7b95552813a6359ec6817435.meapica.es` → `verify.bing.com.` (Hostinger, 2026-10-23).

## Ads tracking — TikTok (2026-10-01)

TikTok Ads account (advertiser id 7691596144782180404, under review 2026-10-01) + pixel `DAV0N7JC77U88MSOEFPG` behind the same
consent banner. Env (Vercel production): `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (build-time), `TIKTOK_EVENTS_TOKEN` (Events Manager › pixel ›
Settings › Generate access token; token file `~/.config/meapica/tiktok_events_token`), optional `TIKTOK_TEST_EVENT_CODE`.
Status 2026-10-01: Events API token set in prod (test event accepted, code 0). Plan: 3-day paid test (~20 €/day ad group) created in the Ads Manager UI (the campaign API needs an approved developer app).

## Search & analytics measurement (2026-10-01)

- **Google Search Console:** Domain properties `sc-domain:meapica.es` (primary, verified 2026-10-23 via Site Verification API +
  DNS TXT, owner admin@casmar.tech) and `sc-domain:meapica.shop` (legacy, TXT `TCFgqmj9…`). 2026-10-23: sitemap
  `https://meapica.es/sitemap.xml` submitted (API) and **Change of address** .shop → .es confirmed (Settings › Change of address,
  validation passed; "Este sitio web se está trasladando", start 23-10-2026). Keep both properties and the 308s for 180+ days.
  meapica.com has no GSC property (its DNS isn't ours).
- **GA4:** property `556936860` "Meapica" (account 384452227, Europe/Madrid, EUR, 14-month retention), web stream `15937070228`,
  measurement ID `G-R4KZQ2ZYQ2`. Key events: `purchase`, `begin_checkout`. Browser gtag loads only after cookie consent (same banner
  as the pixels), Consent Mode v2 default denied → update granted, revoked on withdrawal. Events: view_item, add_to_cart,
  begin_checkout, generate_lead, purchase (via `trackEvent()`). Server purchase: GA4 Measurement Protocol (EU endpoint
  `region1.google-analytics.com/mp/collect`) from the Stripe webhook, only with consent + `_ga` client id + live mode;
  dedup with the browser purchase via `transaction_id = purchase_<checkout session id>`. Check: `npx tsx scripts/check-ga4-mp.mts`.
- **Env (Vercel production):** `NEXT_PUBLIC_GA4_ID` (build-time; unset = GA4 off), `GA4_API_SECRET` (MP secret "stripe-webhook",
  copy at `~/.config/meapica/ga4_api_secret`).
- **PostHog (2026-10-02):** EU cloud, project `291845` "Meapica" (Europe/Madrid), https://eu.posthog.com/project/291845. Product
  analytics + session replay, loaded only after the same cookie consent (`src/lib/tracking/posthog.ts`, started/stopped by
  `Tracking.tsx`). Ingestion through our own proxy `/ingest/*` → `eu.i.posthog.com` / `eu-assets.i.posthog.com` (rewrites in
  `next.config.ts`, `/ingest` excluded from the middleware matcher; `skipTrailingSlashRedirect` is on, so the middleware does
  the `/x/` → `/x` 308 itself). Events: autocapture, `$pageview` on history change, `create_step` (step 1-3 of `/create`) and
  every `trackEvent()` name (ViewContent, AddToCart, InitiateCheckout, Purchase, Lead, ToolDownload, and since 2026-10-03
  `generation_start` {retry} / `preview_ready` {seconds} from `/create/<id>/generate`, also sent to GA4 under the same names and to
  Meta as custom events). Privacy: on
  `/create|dashboard|profile|checkout|preview|auth` replay masks all text, text attributes and inputs and autocapture drops
  element text; signed/blob/data images are blocked; `/preview/<token>` sends nothing. Withdrawal: opt-out, persistence off,
  every `ph_*` cookie/storage key deleted. Headless browsers are dropped as bots (test with real Chrome). Project settings:
  replay on, console logs off, network timings off (request URLs carry signed image links), min duration 2 s. Env: `NEXT_PUBLIC_POSTHOG_KEY` (phc_…, build-time; unset = PostHog off).
  Personal API key (phx_, owner's) for the PostHog API is not stored in the repo.
- **cana:** project key `meapica` in `~/.config/casmar-analytics/sites.json`, GSC site `sc-domain:meapica.es` since 2026-10-23
  (`cana gsc …` / `cana ga4 …` from this repo).
- **IndexNow:** key file `public/2ecdea1c8139eed8afa1e608880f24f7.txt`; after a deploy run `node scripts/indexnow-ping.mjs`
  (pings api.indexnow.org with every sitemap URL; `--dry-run` to count). Bing recognises it (IndexNow page: 90 URLs, source Self, 2026-10-09).
- **Bing Webmaster Tools (2026-10-19):** `meapica.shop/` is verified in the shared Casmar Bing account (with atalaya.watch, constrack.pro,
  licita-ia.com…), signed in with Google. Sitemap `https://meapica.shop/sitemap.xml` submitted 2026-10-19 (Processing). Headless access:
  `pw-session.mjs run bing-webmaster <script>` (browser-session service `bing-webmaster`, profile `google`; the sign-in dialog is shadow
  DOM, click "Google" by coordinates). Direct pages: `/webmasters/{sitemaps,indexnow}?siteUrl=https://meapica.shop/`.
  **2026-10-23:** `https://meapica.es/` added and verified (DNS CNAME, see Domains), sitemap `https://meapica.es/sitemap.xml`
  submitted (Processing). Bing's current UI has no Site Move tool: the 308s + IndexNow (94 URLs pinged on .es, 202) carry the move.
- **GSC "Request indexing" (no API):** headless via browser-session (`google-search-console`, ~10 URLs/day); check status first with the
  URL Inspection API (cana service account). 2026-10-19: 10 requested (`/es/about`, `/ca/about`, `/ca/gifts/christmas`, `/ca/gifts`,
  `/{es,ca}/christmas-delivery`, `/es/gift-voucher`, `/es/blog/three-kings-gift-ideas`, `/es/personalized-books/in-catalan`, `/es/themes`);
  sitemap resubmitted. Already indexed then: three-kings (es/ca), es/christmas, tio-de-nadal, in-catalan (+by-age), es/gifts, examples,
  personalized-books (es/ca). Still unknown to Google (next batches): ca/themes + theme pages, ca/gift-voucher, tools, ca/compare, blog posts,
  ca/gifts/{birthday,sant-jordi,first-birthday}, es/gifts/{baptism,end-of-school,name-day,graduation,sant-jordi}, 5 example stories, es/legal.
- **Weekly SEO report (2026-10-02):** `scripts/seo-weekly-report.mjs` emails a short Spanish HTML report to admin@casmar.tech
  every **Monday 09:00 Europe/Madrid**: GSC clicks/impressions/CTR/position, top 5 queries + pages, sitemap status and per-URL
  index status (URL Inspection API over every sitemap URL), GA4 users/sessions/organic sessions/key events (purchase,
  begin_checkout, generate_lead, tool_download), flags (drops >30 %, new queries, non-indexed URLs) and 3 recommended actions.
  Window: 7 days ending 3 days ago (GSC final data lags) vs the 7 days before. Auth: the cana Service Account + DWD
  (`~/.config/casmar-analytics/sa-key.json`, project from `sites.json`) for GSC/GA4 and for Gmail (sends as admin@casmar.tech
  through `gws` with `GOOGLE_WORKSPACE_CLI_TOKEN`, so no gws profile/OAuth dependency). No npm deps.
  Manual: `node scripts/seo-weekly-report.mjs --dry-run` (prints HTML), `--no-inspect` (skip URL Inspection, faster),
  `--to <addr>`, `--subject-prefix "[TEST]"`. A full run takes ~2-3 min (URL Inspection).
  Schedule: launchd agent `~/Library/LaunchAgents/com.casmar.meapica-seo-weekly.plist` (label `com.casmar.meapica-seo-weekly`,
  absolute node path from nvm v22.22.2: update the plist if node is upgraded), log `~/Library/Logs/meapica-seo-weekly.log`.
  Runs only on the owner's laptop: a run missed while asleep fires at next wake; if the Mac is powered off at 09:00 that week is skipped.
  Run now: `launchctl kickstart gui/$(id -u)/com.casmar.meapica-seo-weekly`.
  Disable: `launchctl bootout gui/$(id -u)/com.casmar.meapica-seo-weekly` (and delete the plist to make it permanent;
  re-enable with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.casmar.meapica-seo-weekly.plist`).

## Social (organic posts through Zernio, 2026-10-04)

- **Accounts:** Instagram + TikTok `@meapica_books`, Facebook page "Meapica", YouTube channel + Pinterest `meapica` (connected 2026-10-04;
  videos go to YouTube as Shorts, every post goes to Pinterest as a pin linking to the site, on the default board
  "Cuentos personalizados para niños"), all in Zernio (`https://zernio.com/api/v1`,
  OpenAPI at `https://zernio.com/openapi.json`). Key: `ZERNIO_API_KEY` or `~/.config/zernio/api_key`. Shared helpers: `scripts/social/zernio.mjs`.
- **One post = one folder:** `docs/social/posts/<YYYY-MM-DD>/post.json` + its media. Fields: `id`, `time` (Europe/Madrid), `lang`, `title` (YouTube + Pinterest), `madeForKids` (videos, YouTube COPPA flag: true for stories a child watches),
  `media[]` (`file`, `type`, `alt` for images), `ig`, `fb` (same caption with the UTM link instead of "link en la bio"), `tiktok`,
  `tiktokTitle` (image posts), `coverMs`, `aiVideo` (dramatised people: platform disclosure), `platforms` (optional list, e.g. `["instagram","facebook","tiktok"]`; default every connected account. Since 2026-10-19 posts leave out YouTube (21 views from 12 Shorts) and Pinterest (spam block on the domain)).
- **Runner:** `node scripts/social/schedule.mjs` (dry run: checks every upcoming post and prints the plan) / `--schedule` (uploads the media
  and creates the scheduled posts; Zernio publishes at `time`). Idempotent: a post already in Zernio for that day with the same caption is
  skipped. Only the next 6 days are scheduled (Zernio media uploads expire after 7), so it has to run at least every few days; a time already
  past today is published at once. `--days=N` (owner's Mac only, up to 31) schedules N days ahead: media of posts more than 6 days out is uploaded to the public Supabase bucket `showcase` under `social/<date>/` (permanent URL, needs `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`) instead of Zernio's temp storage. Local checks block a post with a price lacking "IVA incluido / IVA inclòs", "IA", an em-dash, a TikTok caption asking to comment CUENTO/CONTE (the DM automation is Instagram and Facebook only), missing alt
  text or media. It warns when fewer than 3 days of content are left. Not scheduled yet (no launchd job): owner decision pending.
- **Renderers** (real example books, pages rasterised from `/api/showcase/{id}/pdf`; need `pdftoppm` + `ffmpeg`; `.build/` is git-ignored):
  `node scripts/social/render-book-carousel.mjs <dir>/carousel.json` (1080×1350 slides: book pages, idea cards) and
  `node scripts/social/render-video.mjs <dir>/video.json` (1080×1920: full-screen art with slow zoom or pan, narrator, burned-in
  captions timed from the voice, music bed; the brand shows only at the end: `"outro": true` appends the animated logo `docs/social/brand/outro.mp4`, built by
  the HyperFrames project `videos/outro-libro/` (3.6 s, chosen by the owner 2026-10-04: the spine of the book "M" stands up, its two pages swing open, the loose leaves flick out and the name flows out of the open book with a warm light; sting mixed from the bundled Pixabay SFX in `assets/sting.wav`; the music bed ends before it). Other candidates kept for reference: `videos/outro-pluma/` (the name written with a pen), `videos/outro-acuarela/` (watercolour wash) and `videos/meapica-outro/` (line then ink). Rebuild: `cd videos/outro-libro && npx hyperframes render . -q high -o renders/video.mp4`, then re-encode to `docs/social/brand/outro.mp4` at 30 fps H.264 + AAC 44.1 kHz stereo (the format `render-video.mjs` concatenates), or `brand: true` puts a `meapica.es` pill on the last beat of short loops). `outroSay` is spoken 0.3 s into the outro; when the line is longer than the outro clip, the clip's last frame is held until the line ends + 0.6 s (before 2026-10-23 the line was cut, so the address was never heard).
- **Storyboard and code-drawn videos (2026-10-07):** `render-video.mjs <video.json> --storyboard` writes `storyboard.jpg` (first frame of every beat with its title and line, no narration, about 40 s) to review before a full render. Formats that are pure motion graphics are HyperFrames projects under `videos/` (first one: `videos/name-reveal/`, "Escribe su nombre", `npx hyperframes check | snapshot | render` inside the folder); their MP4 is copied next to the post's `post.json`.
- **Closings and photo scenes (2026-10-07):** `"outro": "short"` in `video.json` appends the compact corporate closing `docs/social/brand/closing-short-<lang>.mp4` (HyperFrames project `videos/closing-short/`, one render per language by changing `LANG`); `"outro": true` still appends the logo outro. Scenes with people: start photos from `fal-ai/flux-2/edit` (`FAL_KEY`, real cover or spread as reference) animated with `SCENE_STYLE=photo node scripts/social/animate-scene.mjs` (Higgsfield, about $0.55 per 5 s clip).
- **Learning loop (2026-10-08):** `node scripts/social/learn.mjs` joins every post in `docs/social/posts/` (its `strategy` and `people` from `post.json`, voice and length from its video) with Zernio analytics and writes `docs/social/scoreboard.md`; run it before creating posts. `schedule.mjs` refuses a post without `strategy`.
- **Narrator:** ElevenLabs `eleven_v4`, one fixed voice (`VOICE_ID` in `render-video.mjs`, "María Díaz") for Spanish and Catalan;
  `ELEVENLABS_API_KEY` in `.env.local`. Lines are cached in `docs/social/.tts-cache/` (git-ignored), so a re-render costs nothing.
  Candidate samples: `docs/social/audio/voice-samples/`. **Music:** `docs/social/audio/*.mp3` (Pixabay Content License, see `CREDITS.md`).
- **Content rules and weekly formats:** `docs/social/playbook.md`. Marketing skills in `.claude/skills/` (see the playbook).
  Page numbers differ per book and per locale: check the PDF before picking pages.
- **Where it runs (2026-10-04):** content is generated on the owner's Mac (Claude session) and pushed to `main`. Two Claude cloud routines
  exist in the environment "Default" (https://claude.ai/code/routines): **"Meapica · publicar posts del día"** (`trig_01JFk1tnPtn6BR8nxieyRdkA`,
  daily 07:00 UTC, runs `schedule.mjs --schedule`, push notification on failure or when under 3 days of content remain) and
  **"Meapica · revisar comentarios y mensajes"** (`trig_01HmZCvtGrXGpGZhL9v7ZnL4`, hourly 06-20 UTC, read-only `inbox.mjs`; since 2026-10-12 a filter
  inside the routine prompt pushes each comment or message once, in the run after the clock hour it arrived in, and the 06:00 UTC run pushes
  a daily summary of everything still waiting. A message stays "waiting" until it is answered through Zernio or marked read there with
  `POST /inbox/conversations/{id}/read`: reading it in the Instagram app does not clear it). Both work since 2026-10-06: the owner added `ZERNIO_API_KEY` to the environment variables and opened the network to
  the Zernio hosts; verified with a manual run of each (exit 0). Post media must be in git for the cloud to upload it: `.gitignore` ignores
  `*.png` except `docs/social/posts/**/*.png`. Still missing for generating content in the cloud: `ELEVENLABS_API_KEY`, its host, and GitHub
  push access (Claude GitHub App not installed on the repo).
- **Moving scenes (2026-10-04, owner's choice):** each video mixes paid and free motion, joined with 0.35 s dissolves.
  Paid: `node scripts/social/animate-scene.mjs <out.mp4> "<prompt>" <start> [<end>]` (MiniMax H3 image-to-video through the Higgsfield API,
  key in `~/.config/higgsfield/credentials`; billed in dollars from a prepaid balance on the API console open.higgsfield.ai, about $0.55 per 5 s clip (estimated from the console's daily spend on 7 and 8 Oct 2026: 13 clips, about $7.2); balance $97.45 on 2026-10-08, read with the `browser-session` service `higgsfield-api`; with an `<end>` frame it renders a scene-to-scene transition).
  Used for the opening scene, the changes of place the story tells and the most magical moment (2 to 5 clips per video).
  Free: `scripts/social/render-ambient.mjs` (HyperFrames: character cut out with a local model, depth drift, light, particles),
  applied automatically by `render-video.mjs` to still beats when `video.json` has `"ambient": "forest|sea|night|day"`.
  In `video.json`: `img.video` = a clip in `clips/` (git-ignored, only the final `video.mp4` is committed), `full: true` plays a
  transition to its last frame, `ambientMode: "out"` on the beat before a transition, `titleTop` moves the hook label off a face.
  Zernio cannot delete Instagram or TikTok posts; replacing a published video means deleting those by hand.
- **Video encode:** H.264 CRF 25 (about 12 MB per minute). Page art is cut 9 % from the bottom (page-number badge) and the slow zoom runs
  on a 4x oversampled frame so it does not tremble.
- **Keyword → private message (2026-10-06):** `node scripts/social/setup-automations.mjs [--create]`. Four Zernio comment automations,
  account-wide on Instagram and Facebook: commenting or messaging `CUENTO` (ES) or `CONTE` (CA) sends a DM with a tracked button to the
  site and a short public reply. Captions of Instagram and Facebook posts end with the call to comment the keyword. Stats (triggered,
  delivered, link clicks) come back from the same script. Not available on TikTok, YouTube or Pinterest.
- **Ads:** Meta ad account "Meapica Ads" (`act_2479938985822992`) is connected in Zernio and active, but has **no payment method**
  (billingStatus `missing`, checked 2026-10-06): no campaign can run until the owner adds one in Meta.
- **TikTok Ads through Zernio (checked 2026-10-08):** the ad account is connected as a `tiktokads` account (Zernio id
  `6abe76003d9fcab2182a1c5a`, advertiser `7691596144782180404`, Business Center `7691596115342442502`, identity "Meapica").
  `GET /v1/ads/accounts?accountId=…` returns status and balances: cash 0, grant 0, no campaigns. Billing info
  submitted 2026-10-08 (VAT ES41649433K, Carrer Aribau 140 5º, 08036 Barcelona, Catalonia): Business Center now shows the ad
  account as "Approved"; what is missing is payments step 2 (add balance or a payment method, owner). The Business Center itself
  is "Unverified", which does not block ads. Headless: `ads.tiktok.com` answers 403, `business.tiktok.com/manage/*` works.
- **First TikTok paid test (live since 2026-10-08):** campaign `mpc_tiktok_traffic_es_q4-26` (TikTok campaign `1878487066110225`,
  ad group `1878487067234561`, ad `1878487071246434`, Zernio ad `6ac795af07c676baefcfd13b`), created with `POST /v1/ads/create`:
  goal traffic, 20 €/day (TikTok's minimum) until 2026-10-11, Spain 25-44 Spanish, video `noa-short-9x16-es.mp4`, landing `/es`
  with the TikTok UTM template. Real cap = the 10 € prepaid balance (auto recharge off). Identity must be `BC_AUTH_TT`
  (@meapica_books linked in Business Center): TikTok rejects `CUSTOMIZED_USER`. The AI-content label cannot be set through
  Zernio. Pause: `PUT /v1/ads/campaigns/1878487066110225/status` `{ "status": "paused", "platform": "tiktok" }`.
- **Second TikTok ad, free Reyes letter (created PAUSED 2026-10-10, nothing spent):** campaign `mpc_tiktok_traffic_es_reyes-letter_q4-26`
  (TikTok campaign `1878680561364114`, ad group `1878680561379394`, ad `1878680564590785`, Zernio ad `6aca6682c4957532f2c07385`):
  goal traffic, 20 €/day, Spain 25-44 Spanish, identity `BC_AUTH_TT` (`identityId` from `GET /v1/ads/tiktok-identities`), video
  `docs/ads/creatives/reyes-letter/reyes-letter-9x16-es.mp4` (14.8 s, real recording of the tool; folder is git-ignored, rebuild steps
  in its `video.json` and `src/`), landing `/es/tools/letter-to-the-three-kings` with the TikTok UTM template, no end date.
  TikTok review: approved. Created with `status: "PAUSED"` on `POST /v1/ads/create`. It cannot deliver until the owner adds balance
  (cash 0); the real cap is that prepaid balance. Start: `PUT /v1/ads/campaigns/1878680561364114/status`
  `{ "status": "active", "platform": "tiktok" }`. The first campaign (`1878487066110225`) was paused the same day so new balance
  does not go to it. What to read: `newsletter_subscribers` with `reyes_reminder_consent_at` set (before migration 20261022120000: `source = 'reyes_reminder'`) against TikTok clicks.
- **Media upload fallback:** if the presigned upload host (`*.r2.cloudflarestorage.com`) times out, as on 2026-10-10 from the Mac,
  `POST /v1/media/upload-direct` (multipart `file`, API key, 25 MB max) returns the same kind of public URL.
- **Inbox:** `node scripts/social/inbox.mjs` prints unanswered comments and unread DMs as JSON (read-only). `node scripts/social/reply.mjs dm <conversationId> "<text>"` answers a DM (adds Meta's human-agent tag when the 24 h window has closed) and marks the conversation read; `reply.mjs comment <postId> <commentId> "<text>"` answers a comment. Texts are approved by the owner first. First real sends 2026-10-12: three Instagram DMs (one four days old) and one TikTok comment reply, all accepted.
- `scripts/social/publish-first-posts.mjs` is the one-off of 3 Oct (already published).
- **Pinterest is blocked (found 2026-10-19):** every pin since 2026-10-10 failed with "Pinterest blocked the destination link as suspected spam"
  (all `meapica.shop` links; the 6 pins of 4-9 Oct are live, Zernio reports 0 impressions). Claim + appeal done 2026-10-19 (see Unblock status below); until the block is lifted the Pinterest leg of every post fails (the rest of the post publishes).
- **Native pins (2026-10-19):** `node scripts/social/render-pins.mjs <pins.json> [id]` renders 1000×1500 JPG pins from the example-book PDFs
  (cover, dedication, spread, portrait, grid, deadline layouts) and from the live free Reyes letter tool, and writes `pins.md` (title, board,
  UTM link, alt, description per pin). First batch: 15 pins (10 es, 5 ca) for the SEO landings in `docs/social/pinterest/2026-10-19/`,
  UTM `utm_campaign=org_q4-26-pins&utm_content=org_pi_pin_<id>`. Not scheduled: `schedule.mjs` does not read this folder.
- **Boards (created 2026-10-19 through Zernio `POST /v1/accounts/6ac2153cea6362e77f8beb54/pinterest-boards`, all public):** Cuentos personalizados para niños `1150669842234818144` (default), Regalos de Reyes para niños `1150669842234876604`, Regalos de Navidad para niños `1150669842234876606`, Regalos de cumpleaños para niños `1150669842234876607`, Cuentos personalizados por edad `1150669842234876608`, Contes personalitzats en català `1150669842234876609`. A pin targets one with `platformSpecificData.boardId`.
- **Unblock status (2026-10-19):** domain `meapica.shop` claimed on the Pinterest account (DNS TXT `pinterest-site-verification=…` added at Hostinger on `@`, nothing else touched; Settings > Enlace a Pinterest shows it connected). Link-block appeal filed through the Help Center form (Appeals > Pinterest blocked my site), Zendesk ticket **17012997**, answer goes to admin@casmar.tech. Until Pinterest lifts the block, pins to `meapica.shop` keep failing. The Help Center and settings work headless with the `pinterest` browser-session profile.

## Growth funnel + abandoned-preview reminders (2026-10-03)

- **Consent-independent funnel:** `stories.generation_started_at` / `stories.preview_ready_at` are set by the DB trigger
  `stories_funnel_timestamps` (first draft → generating, first preview-or-later status; the app never writes them).
  `node scripts/growth-funnel.mjs [--days N | --from YYYY-MM-DD --to YYYY-MM-DD] [--json] [--exclude-email X]` prints stories
  created → generation started → preview ready → order created → paid by Madrid day of story creation, with refunds, revenue
  (IVA incluido), a per-locale split and a per-source / per-campaign split from `stories.attribution` (first touch, no cookies;
  `(not captured)` until migration `20261019120000_story_attribution` is applied and for older stories). Read-only through the Management API (`/database/query/read-only`, token `SUPABASE_PAT`
  from env/.env.local or `~/.config/supabase-profiles/meapica`). Excludes showcase stories, test/e2e/admin users
  (`TEST_EMAIL_PATTERNS` in the script + `ADMIN_EMAILS` + `--exclude-email`) and 0 € paid orders. Falls back to story status
  until the migration is applied. `--json` feeds the weekly growth report.
- **Abandoned-preview reminders:** cron `/api/cron/preview-reminders` (vercel.json, every 15 min, `CRON_SECRET`; `?dry_run=1`,
  `?limit=N`, `?ignore_quiet=1`). Table `preview_reminders` (service role only). No new env vars: uses `RESEND_API_KEY`,
  `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (unsubscribe + share-token keys). Cover images in the email
  go through `GET /api/preview-image/<share token>` (302 to a 10-min signed URL of the private bucket). Checks:
  `npx tsx scripts/check-preview-reminders.mts`.
- **Meta CAPI logging (2026-10-03):** `sendMetaPurchase()` logs one line per outcome (`sent (live|test:CODE): events_received=1
  fbtrace_id=…`, `REJECTED …`, `NOT confirmed`, `FAILED`) and every skip reason. Vercel prod env vars are `sensitive`: `vercel env
  pull` returns them EMPTY, so an empty pulled value is not evidence of an empty secret.

### Referral + gift vouchers (2026-10-09)

- Webhook: no new event types. `checkout.session.completed` with `metadata.kind = gift_voucher` → voucher row +
  code + email (`src/lib/growth/gift-vouchers.ts`); book sessions additionally mint the order's referral code
  (best-effort, never retried from the webhook; the pipeline retries before rendering the PDF) and process the
  promotion code used (voucher redeemed / referral reward, retried by Stripe on failure). `charge.refunded` on a
  voucher payment deactivates its code + credit note.
- No new env vars. Voucher card links are HMAC-signed with a key derived from `SUPABASE_SERVICE_ROLE_KEY`.
- Rate limit `gift_voucher_checkout` (10 per hour per IP) on `POST /api/gift-voucher/checkout`.
- Setup (live, owner): `STRIPE_KEY=sk_live_… npx tsx --tsconfig tsconfig.json scripts/stripe-setup-catalog.mts --dry-run`, then without `--dry-run`.

### Deploy order — referral + gift vouchers (2026-10-09)

| Version | File | When |
|---|---|---|
| 20261009120000 | `referrals_and_gift_vouchers.sql` (`referral_codes`, `referral_rewards`, `gift_vouchers`, service role only) | **before** the deploy (additive; the webhook writes them) |

Order: apply the migration → deploy → run the setup script with the live key (features appear within 10 min, cache TTL).

### Deploy order — funnel + reminders (2026-10-03)

| Version | File | When |
|---|---|---|
| 20261003200655 | `funnel_and_preview_reminders.sql` (stories funnel columns + trigger + backfill, `preview_reminders`) | **before** the deploy (additive; the send-preview route degrades gracefully without it, the cron would fail) |

## Reyes deadline reminder (2026-10-22)

- Cron `/api/cron/reyes-reminders` (vercel.json, daily 09:00 UTC, `CRON_SECRET`; `?dry_run=1`, `?limit=N`, default 200).
  Sends only between `sendFrom` and `cutoff` (2026: 17-22 Dec), answers `{ migrationPending: true }` with 200 until
  migration `20261022120000_reyes_reminder` is applied. No new env vars (`RESEND_API_KEY`, `EMAIL_FROM`, unsubscribe key =
  service-role HKDF as the other marketing emails).
- Code: `src/lib/marketing/reyes-reminders.ts` (selection + claim), `src/lib/email/reyes-reminder.ts` (es/ca template),
  window in `src/lib/shipping.ts` (check: `node --experimental-strip-types src/lib/shipping.check.mjs`).
- **Order matters:** apply the migration BEFORE deploying the code: the new `/api/newsletter` writes
  `reyes_reminder_consent_at`, so without the column every Reyes opt-in would fail with a 500.

## Creator programme (live 2026-10-23)

- No new env vars. Uses `ADMIN_EMAILS` (`/admin/creators`), `OPS_ALERT_EMAIL` (payout request emails, fallback
  `GELATO_OWNER_EMAIL`), `STRIPE_ENVIRONMENT` + keys, `SUPABASE_SERVICE_ROLE_KEY`.
- **New webhook event `charge.dispute.closed`** (a lost chargeback voids the commission): in `WEBHOOK_EVENTS` of
  `scripts/stripe-setup-catalog.mts`; enable it on the LIVE and TEST endpoints (re-run the script with
  `--webhook-url=<the endpoint URL>` or add the event in the Dashboard). Without it, a lost chargeback keeps paying
  commission.
- Stripe: no setup script step. Each credit creates its own coupon `meapica_creator_credit_<uuid>` + one promotion code
  at runtime; it copies `applies_to` from `meapica_referral_10` (exists in LIVE, verified 2026-10-23). Audience codes
  stay as created by `scripts/social/create-creator-codes.sh` (coupon `pUqYq48o`, expire 2027-01-06).
- Seeding the existing creators: write `creators.csv` (`<handle>,<login email>` per line), then
  `node scripts/social/seed-creators.mjs creators.csv` (LIVE Stripe read, dry run) and `--apply` to insert into the
  Supabase project of `.env.local` (production), one row at a time (duplicates / invalid rows reported, never abort).
  New creators later: `/admin/creators`. Then `node scripts/social/backfill-creator-commissions.mjs` (dry run) and
  `--apply` for audience-code orders paid since 2026-10-06, before the deploy.
- Checks: `node --experimental-strip-types src/lib/creators.check.mjs`; `bash supabase/tests/creator_withdraw.check.sh`
  (spins a throwaway local Postgres from Homebrew `postgresql@16`, tests the double-spend guard, deletes it).

### Deploy order — creator programme (2026-10-23)

| Version | File | When |
|---|---|---|
| 20261023120000 | `creator_programme.sql` (orders promotion columns, `creators`, `creator_commissions`, `creator_withdrawals`, RPC `creator_withdraw`) | **before** the deploy (additive; the webhook writes them on every promotion-code order and refund) |

Order: apply the migration → deploy → enable `charge.dispute.closed` on the webhook endpoints → seed creators →
backfill → check `/admin/creators`.

## Customer reviews (2026-10-19)

- Cron `/api/cron/review-requests` (vercel.json, daily 10:00 UTC, `CRON_SECRET`; `?dry_run=1`, `?limit=N`). Answers
  `{ migrationPending: true }` with 200 until migration `20261019150000_reviews` is applied, so the cron can ship first.
- No new env vars: `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (review and
  moderation link keys), `OPS_ALERT_EMAIL` (owner email per new review, fallback `GELATO_OWNER_EMAIL`).
- Trustpilot: `TRUSTPILOT_REVIEW_URL` constant in `src/lib/product-facts.ts`, empty until the owner creates the profile
  (TODO); empty = link hidden.
- Moderation: link in the owner email (`/api/reviews/moderate?t=…`, confirm page + POST) or SQL in the dashboard:
  `update public.reviews set status = 'hidden', updated_at = now() where id = '…';`

### Deploy order — customer reviews (2026-10-19)

| Version | File | When |
|---|---|---|
| 20261019150000 | `reviews.sql` (`orders.shipped_at/delivered_at` + trigger + backfill, `orders.review_request_sent_at`, `reviews`, service role only) | before or after the deploy: the cron, the review API and the public pages degrade without it (no requests, 503, no reviews) |

Recommended: apply the migration, then deploy, then run `?dry_run=1` once to see how many orders are due.

## Product feeds — Google Merchant Center + ChatGPT (2026-10-02)

- **URLs (static, rebuilt each deploy):** `https://meapica.shop/feeds/google-merchant.xml` (RSS 2.0 + `g:` namespace) and
  `https://meapica.shop/feeds/openai-products.jsonl` (ChatGPT product feed spec, same data). Not in the sitemap, `X-Robots-Tag: noindex`,
  allowed by robots, outside the locale middleware (matcher skips `.xml` / `.jsonl`).
- **Code:** `src/lib/merchant-feed.ts` (builders, all facts from pricing / product-facts / shipping), routes in `src/app/feeds/*/route.ts`.
  Check: `npx tsx --tsconfig tsconfig.json scripts/check-merchant-feed.mts [http://localhost:3034]` (spec fields, prices = PRICING /
  STRIPE_CATALOG, postcode coverage, images; with a base URL also the served bytes).
- **Items:** 3, one per format, ids = the home Product JSON-LD skus (`meapica-hardcover` 49.90 EUR, `meapica-softcover` 34.90 EUR,
  `meapica-digital-pdf` 9.90 EUR, VAT included), all linking to `/es` (shows every price). `identifier_exists=no` (made to order),
  brand Meapica, `google_product_category` 543543 Print Books / 543542 E-books, age_group kids, is_bundle no. Shipping in the feed:
  free, ES postcodes 01000-34999, 36000-37999, 39000-50999 (no Canarias/Ceuta/Melilla), handling 2-4 + transit 5-6 business days
  (= the 7-10 day promise; the split is an estimate). Because the feed sends a shipping price, Merchant Center ignores account
  shipping settings for these items. Story worlds are not items: `/themes/*` only shows the "desde" price.
- **Images:** `public/images/feed/*.jpg` 1500 × 1500, the Noa showcase book in the site's own mockup + its cover art, with the IPTC
  `DigitalSourceType = trainedAlgorithmicMedia` XMP tag Google requires on AI-generated images. Rebuild (dev server on 3013):
  `npx tsx --tsconfig tsconfig.json scripts/build-merchant-feed-images.mts` (uses `/es/dev/book-mockup` with `cover/title/name/spine/panorama/scale` params).

**Status 2026-10-02: LIVE.** Account `5865149718` "Meapica", domain claimed, free listings ENABLED (ES). Data source
`10756117518` (daily fetch 06:00 Madrid), return policy `9351866615` (NO_RETURNS), customer service hola@meapica.shop.
**2026-10-23:** website changed to `https://meapica.es` and claimed (Merchant API `accounts/5865149718/homepage` + `:claim`,
`claimed: true`); data source fetch URL → `https://meapica.es/feeds/google-merchant.xml` (fetch triggered). Item links and images
in the feed already use `.es`. Still `.shop`: customer service email and the data source display name.
API access: service account `cana-agent@casmar-analytics.iam.gserviceaccount.com` is Admin in Merchant Center, Merchant API
enabled in GCP `casmar-analytics` and registered (`developerRegistration:registerGcp`); token with scope
`https://www.googleapis.com/auth/content` WITHOUT `sub` (no DWD). Item-level `postal_code` is rejected for ES
(`region_not_allowed`), so printed items ship country-wide in the feed; Canarias/Ceuta/Melilla are blocked at checkout.

### Merchant Center setup — OWNER (merchants.google.com, signed in as admin@casmar.tech)
1. Create the account: business name **Meapica**, country **Spain**, time zone Europe/Madrid, website `https://meapica.shop`;
   "Where do customers buy" = on your website.
2. **Business info:** legal name Xavier Huix Trenco, address Carrer Aribau 140, 5º, 08036 Barcelona, customer service email
   admin@casmar.tech; logo `public/images/icon-512.png`.
3. **Verify + claim** `meapica.shop` (Business info → Website): choose the **Search Console** method (property
   `sc-domain:meapica.shop` is already verified under admin@casmar.tech), then **Claim**.
4. **Shipping** (Settings → Shipping and returns → Shipping services → Add): name "Envío estándar", country Spain, currency EUR,
   areas = postcodes 01000-34999, 36000-37999, 39000-50999; order cut-off 23:59 Europe/Madrid; handling 2-4 business days, transit
   5-6 business days, Mon-Fri; rate **free**. (Backup only: the feed already carries the same shipping.)
5. **Returns** (Settings → Shipping and returns → Return policies → Add, country Spain): **No returns** ("doesn't accept returns",
   personalised goods, art. 103 c LGDCU); policy URL `https://meapica.shop/es/legal`. Note in the policy text: defects or transit
   damage reported within 30 days of delivery are reprinted free.
6. **Tax:** nothing to set (only US/CA have tax settings); prices are submitted VAT-inclusive as Spain requires.
7. **Feed** (Products → Add products → Add products from a file → **Add a file link**): URL
   `https://meapica.shop/feeds/google-merchant.xml`, no username/password, frequency **Daily**, 06:00 Europe/Madrid, country Spain,
   language Spanish, name "meapica-xml". Click "Fetch now" once, then check Products → Needs attention.
8. **Free listings** (Growth / Marketing → Manage programs, or Settings → Apps & services): enable **Free listings**. Shopping ads
   only when paid search starts (link Google Ads from the same screen).
9. Optional: link GA4 property 556936860 (Settings → Linked accounts) for conversion reporting.

### ChatGPT (OpenAI) — OWNER
Merchant onboarding is by application (chatgpt.com/merchants). When accepted, give them the JSONL URL above (or their SFTP upload);
`is_eligible_checkout` is false (no Instant Checkout integration).
