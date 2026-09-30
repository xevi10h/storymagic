# Stack & infrastructure (Meapica)

> The full stack table, data model and file tree live in `docs/technical-architecture.md`;
> the image engine in `docs/generation-pipeline.md`. This file holds infrastructure
> runbooks that change how things are deployed.

## Supabase Storage buckets

| Bucket | Access | Holds |
|---|---|---|
| `illustrations` | **Private** | Every generated image of a child: avatar portraits, character sheets, scenes, covers |
| `showcase` | Public | Marketing copies only: is_showcase example books, waitlist covers, style samples, blog images, mock art |
| `book-pdfs` | Private | Rendered PDFs (digital download + Gelato print files), 1 h / 7 d signed URLs |
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
4. **Env (Vercel prod):** `CRON_SECRET` set (both crons need it); `NEXT_PUBLIC_SITE_URL=https://meapica.com` (avatar anchors are fetched from it); `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED`
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
examples (2026-09-30): Hugo, Carla and Pau (ES originals, ordered 2026-09-29) plus ca/en/fr copies that
reuse the same art rows with translated text (`story_decisions.showcaseTranslationOf` = the ES id).

Known residuals: legacy portraits (`portraits/{uuid}/…`) can be re-signed by any user who
writes that path into their own character row — only possible for someone who already had the
old public URL. A preview tab left open > 1 h shows broken images for pages not yet loaded
(reload fixes it). `illustration_library` (unused cache table) was not migrated.

## Payments — Stripe (2026-09-28)

**Account:** Meapica has its own Stripe account (not Constrack's). Sandbox `acct_1UKcQsBD04FISl5u`
("Meapica sandbox", ES/EUR). Live `acct_1UKcQRAyKcfLUpfG` ("Meapica", descriptor "MEAPICA"),
activated and configured 2026-09-28 (setup script run; live webhook `we_1UKekqAyKcfLUpfGWsbB0sRn`).
Seller on invoices: Xavier Huix Trenco (autónomo), NIF 41649433K, Carrer Aribau 140, 5º, 08036 Barcelona.

**Setup is code:** `STRIPE_KEY=sk_… npx tsx --tsconfig tsconfig.json scripts/stripe-setup-catalog.mts --webhook-url=https://meapica.com/api/webhooks/stripe`
(idempotent, `--dry-run` available) configures, on the account behind the key:
- Stripe Tax: head office Barcelona, ES registration `standard` / `small_seller` (Spanish VAT also on
  EU digital sales while under the 10 000 € OSS threshold; switch to OSS with the gestor when crossed),
  default `tax_behavior: inclusive`. Verified: 4 % (`reduced_rated`) for both tax codes, 0 % Canarias.
- Seller tax id `es_cif 41649433K` (printed on invoices).
- Catalog = `STRIPE_CATALOG` in `src/lib/pricing.ts` (single source): 5 VAT-inclusive Prices with lookup
  keys `meapica_{digital_pdf,softcover,hardcover,extra_copy_softcover,extra_copy_hardcover}`
  (9,90 / 34,90 / 49,90 / 19,90 / 29,90 €), tax codes `txcd_10302000` (digital book) and
  `txcd_35010001` (children's book). Changing an amount: edit `STRIPE_CATALOG`, re-run the script
  (new Price takes the lookup key, old one archived). The server refuses to sell if a Price's
  amount/tax behaviour drifts from the code (`getStripeCatalog`).
- Webhook endpoint (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.expired`, `charge.refunded`); a NEW endpoint prints its signing secret once.

**Endpoints:** both modes point at `https://meapica.com/api/webhooks/stripe`; the route verifies with
`STRIPE_WEBHOOK_SECRET_LIVE` and `STRIPE_WEBHOOK_SECRET_TEST` and ignores events whose mode ≠
`STRIPE_ENVIRONMENT`. Test endpoint: `we_1UKdD8BD04FISl5urkd8gXlZ` (sandbox). The old Constrack live
endpoint `we_1T8hz2…` is obsolete once the new live account is in use.

**Env (Vercel production):** `STRIPE_ENVIRONMENT` (`live`), `STRIPE_SECRET_KEY_LIVE`,
`STRIPE_WEBHOOK_SECRET_LIVE`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST` (the last two
already hold the Meapica sandbox values). No publishable key is used (redirect Checkout).

**Checkout:** `automatic_tax`, `invoice_creation` (factura with NIF; Stripe Invoicing fee applies),
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

## Gelato (print + shipping)

**Env (Vercel prod):** `GELATO_API_KEY`, `GELATO_PRODUCT_UID_HARDCOVER` / `_SOFTCOVER` (glued-left,
170 g silk, matt), `GELATO_FULFILLMENT_MODE=direct` (ships to the customer), `GELATO_WEBHOOK_SECRET`.
No Gelato sandbox: orders are `draft` unless `STRIPE_ENVIRONMENT=live`.

**Webhook:** register in Gelato → Developer → Webhooks
`https://meapica.com/api/webhooks/gelato?secret=<GELATO_WEBHOOK_SECRET>` (Gelato sends no signature
or custom headers) for `order_status_updated` and `order_item_tracking_code_updated`. Gelato retries
a failed delivery only 3×, so the fulfilment cron also reconciles every hour via `GET /v4/orders/{id}`.
**2026-09-28: the registered URL returns 401 (no/incorrect secret) — must be fixed in the dashboard.**

**Shipping:** Spain only, península + Baleares; Canarias/Ceuta/Melilla excluded (postcode guard
before print). Standard shipping included in the price; at submit a live quote picks the cheapest
method. Phone collected in Checkout and sent to Gelato for the carrier. Delivery times and Reyes
order cut-offs: `src/lib/shipping.ts` (re-quote before each campaign).
