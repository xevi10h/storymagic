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
  | Showcase / ejemplo / landing / OG / waitlist | `toShowcaseUrl` → public `showcase` mirror (never signed: cached pages + OG) | public |
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
   page (landing, `/ejemplo`, OG, waitlist) from `showcase`.
4. **Env (Vercel prod):** `CRON_SECRET` set (both crons need it); `NEXT_PUBLIC_SITE_URL=https://meapica.shop` (avatar anchors are fetched from it); `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED`
   unset/false until the DPIA + OpenAI DPA are signed.
5. **Deploy the code** (works with the bucket still public: signed URLs also work on public buckets).
   Check `/ejemplo`, landing BookCollection, waitlist page, blog; create a book end to end
   (protagonist → prepare → story → generating screen shows images → preview).
6. **Apply** 140400 (flip `illustrations` to private + owner read policies).
7. **Apply** 140500 whenever convenient.
8. Smoke test: preview of an existing story, dashboard avatar, a new book's generating screen and
   preview, `/ejemplo/[id]`, an old public illustrations URL → 400. `GET /api/cron/purge-photos`
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

**Setup is code:** `STRIPE_KEY=sk_… npx tsx --tsconfig tsconfig.json scripts/stripe-setup-catalog.mts --webhook-url=https://meapica.shop/api/webhooks/stripe`
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
- Webhook endpoint (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
  `charge.dispute.created`); a NEW endpoint prints its signing secret once. **The last two events are
  new (2026-09-30): add them to the existing live + test endpoints (or re-run the script).**

**Endpoints:** both modes point at `https://meapica.shop/api/webhooks/stripe`; the route verifies with
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
`https://meapica.shop/api/webhooks/gelato?secret=<GELATO_WEBHOOK_SECRET>` (Gelato sends no signature
or custom headers) for `order_status_updated` and `order_item_tracking_code_updated`. Gelato retries
a failed delivery only 3×, so the fulfilment cron also reconciles every hour via `GET /v4/orders/{id}`.
**2026-09-28: the registered URL returns 401 (no/incorrect secret) — must be fixed in the dashboard.**

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

## Domains (2026-09-30)

- **Primary: `meapica.shop`** (+ `www`), registered at **Hostinger** 2026-09-30, DNS managed there (API token at `~/.config/hostinger/token`,
  `PUT https://developers.hostinger.com/api/dns/v1/zones/meapica.shop`). Records: `@ A 76.76.21.21`, `www CNAME cname.vercel-dns.com`.
  All canonical URLs, sitemap, OG, emails, printed books (back cover + QR) and ads use it.
- **Legacy: `meapica.com`** stays attached to the Vercel project and serves the same site, but its DNS (Spaceship) is no longer
  under our control: nothing critical (Stripe/Gelato webhooks, auth redirects, email sending, Meta domain) may depend on it.
- Status 2026-09-30: `NEXT_PUBLIC_SITE_URL=https://meapica.shop` (prod) ✔; Supabase Auth Site URL `https://meapica.shop` + allow-list
  (.shop, www.shop, .com, www.com, localhost:3013) ✔ via Management API (`SUPABASE_ACCESS_TOKEN=$(cat ~/.config/supabase-profiles/meapica)`);
  Stripe live webhook `we_1UKekqAyKcfLUpfGWsbB0sRn` → `https://meapica.shop/api/webhooks/stripe` ✔ (owner, 2026-10-01; CLI profile `stripe -p meapica` can read, lacks `webhook_write`);
  Gelato webhook moved to `.shop` by the owner 2026-10-01 (endpoint verified: 200 with secret, 401 without; old secretless webhook deleted); Meta domain verification: meapica.com + meapica.shop VERIFIED 2026-10-01 (meta tags in root layout + TXT `facebook-domain-verification=…` on Hostinger @).
- **Email (2026-10-01):** Resend domain `meapica.shop` (id `ac086507-5e3d-4851-a800-bd85e4d7be6c`, eu-west-1, Atalaya Resend account) **verified**; DNS on Hostinger: `resend._domainkey` TXT, `send` MX + TXT (SPF), `rsend` CNAME, `_dmarc` TXT `p=none; rua=admin@casmar.tech`. Prod env: `RESEND_API_KEY` = sending-only key scoped to that domain (`meapica-prod-sending`), `EMAIL_FROM=Meapica <pedidos@meapica.shop>`, `EMAIL_REPLY_TO=admin@casmar.tech` (customer replies land in the owner's Gmail). Admin key for domain management: `~/.config/resend/meapica`.

## Ads tracking — TikTok (2026-10-01)

TikTok Ads account (advertiser id 7691596144782180404, under review 2026-10-01) + pixel `DAV0N7JC77U88MSOEFPG` behind the same
consent banner. Env (Vercel production): `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (build-time), `TIKTOK_EVENTS_TOKEN` (Events Manager › pixel ›
Settings › Generate access token; token file `~/.config/meapica/tiktok_events_token`), optional `TIKTOK_TEST_EVENT_CODE`.
Status 2026-10-01: Events API token set in prod (test event accepted, code 0). Plan: 3-day paid test (~20 €/day ad group) created in the Ads Manager UI (the campaign API needs an approved developer app).
