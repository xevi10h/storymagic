# Technical Architecture

## Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 (App Router) | Web application, SSR, SEO |
| Hosting | Vercel | Frontend deployment, serverless functions |
| Database | Supabase (PostgreSQL) | Data storage, auth, storage, real-time |
| Auth | Supabase Auth | Email + Google OAuth + anonymous sign-in |
| Payments | Stripe | Checkout, webhooks, order management |
| Story AI | Claude Sonnet 4 (Anthropic) | Text generation — prod |
| Story AI (dev) | Groq / Cerebras / Gemini | Free-tier fallbacks for local development |
| Image AI | FLUX.2 [flex] (BFL) | Illustration generation — visual-bible multi-reference (Recraft V3 fallback) |
| Illustration QA | Gemini 2.5 Flash (vision) | Per-scene consistency/coherence/quality judge + regen loop |
| Book Layout | @react-pdf/renderer | PDF composition (32-page book) |
| Printing | Gelato API | Print-on-demand, global fulfillment |
| i18n | next-intl | 4 locales: ES (default), CA, EN, FR |
| Email | Resend | Transactional emails (waitlist + order lifecycle: confirmed/producing/shipped/delivered) |
| Domain | TBD | meapica.com (not yet registered) |

## Supabase Project

- **Project ref:** `rmxjtugoyfaxxkiiayss`
- **MCP configured:** Yes (in `.mcp.json`)

## Data Model (Implemented)

```
profiles (extends Supabase auth.users)
├── id (uuid, PK, FK → auth.users)
├── name
├── created_at
└── updated_at

characters (saved hero profiles)
├── id (uuid, PK)
├── user_id (FK → profiles)
├── name
├── gender (boy / girl / neutral)
├── age (1-12)
├── hair_color (enum: black / brown-dark / brown / blonde / red)
├── skin_tone (enum: light / medium-light / medium-dark / dark / very-dark)
├── hairstyle (varies by gender)
├── interests (text[] — up to 4: space / animals / sports / castles / dinosaurs / music)
├── city
├── favorite_color (book theme accent color)
├── favorite_companion (open text — "best friend/companion")
├── avatar_url (FLUX.2 watercolor portrait, Supabase portraits/ bucket)
├── created_at
└── updated_at

stories
├── id (uuid, PK)
├── user_id (FK → profiles)
├── character_id (FK → characters)
├── title (nullable — auto-generated post-creation)
├── template_id (slug: space / forest / pirates / dinosaurs / superhero / chef / castle / safari / inventor / candy)
├── creation_mode (solo / together — legacy; defaults "solo" to keep payload valid)
├── story_decisions (jsonb — choices made along the adventure path)
├── special_moment (text — open text, optional)
├── dedication_text
├── sender_name
├── ending_choice
├── generated_text (jsonb — 12 scenes with title + text + image prompt)
├── pdf_url (storage path, nullable — cleared on re-generation)
├── status (draft / generating / ready / ordered / shipped)
├── saga_id (FK → sagas, nullable)
├── saga_order (integer, nullable)
├── created_at
└── updated_at

story_illustrations
├── id (uuid, PK)
├── story_id (FK → stories)
├── scene_number (1-12)
├── prompt_used (text)
├── image_url (text — Supabase Storage public URL)
├── status (pending / generating / ready / failed)
├── created_at
└── updated_at

illustration_library (cache table)
├── id (uuid, PK)
├── description_hash (text, unique — sha256 of prompt)
├── prompt (text)
├── image_url (text)
├── created_at
└── updated_at

orders
├── id (uuid, PK)
├── user_id (FK → profiles)
├── story_id (FK → stories)
├── stripe_payment_id
├── stripe_checkout_session_id
├── format (softcover / hardcover)
├── addons (jsonb — pack aventura, digital pdf, extra copy)
├── subtotal (decimal)
├── total (decimal)
├── currency (EUR)
├── shipping_name
├── shipping_address (jsonb)
├── gelato_order_id (nullable)
├── tracking_number (nullable)
├── status (pending / paid / producing / shipped / delivered)
├── created_at
└── updated_at

sagas
├── id (uuid, PK)
├── user_id (FK → profiles)
├── character_id (FK → characters)
├── title
├── type (linear / episodic / progression)
├── created_at
└── updated_at

newsletter_subscribers (waitlist)
├── id (uuid, PK)
├── name (text)
├── email (text, unique)
├── locale (text — es/ca/en/fr)
├── created_at
└── updated_at

blog_posts (editorial blog — Supabase CMS)
├── id (uuid, PK)
├── slug (text — English, shared across locales)
├── locale (text — es/ca/en/fr)   ── UNIQUE (locale, slug)
├── title / excerpt / body_markdown
├── cover_image_url (nullable)
├── author (text, default 'Meapica')
├── status (draft | published)    ── RLS: public reads published only; writes service-role only
├── published_at
├── seo_title / seo_description (nullable overrides)
├── related_type (gifts|ages|themes) / related_slug  ── cross-link to SEO landing
├── tags (text[])
├── created_at
└── updated_at
```

**Blog read path:** `src/lib/blog.ts` (untyped Supabase client) → `/blog` index + `/blog/[slug]` post. Markdown rendered with `marked`; styled via `.prose-article` in globals.css. `Article` + `BreadcrumbList` JSON-LD. Authoring v1 = seed via service role (no admin UI yet).

## Storage Buckets

| Bucket | Access | Path pattern | Content |
|--------|--------|-------------|---------|
| `illustrations` | Public | `{storyId}/{sceneNumber}.png`, `{storyId}/ref-{assetId}.png`, `portraits/ref-{uuid}.png` | FLUX.2 scene illustrations + visual-bible reference sheets + child avatar portraits |
| `book-pdfs` | Private | `{userId}/{storyId}.pdf` | Generated PDF books, served via signed URL |

## Generation Pipeline

> ⚠️ **The generation pipeline was substantially reworked 2026-06-15. The authoritative,
> current description (two-speed model split, per-stage models + resolution, measured
> costs, the per-scene character-consistency lock) lives in `docs/generation-pipeline.md`.**
> Key changes since the diagram below: PREVIEW uses a fast/cheap model
> (`PREVIEW_IMAGE_PROVIDER`/`PREVIEW_FAL_MODEL`, e.g. fal FLUX.2 dev) and `/complete`
> uses a premium model (`FINAL_IMAGE_PROVIDER`/`FINAL_FAL_MODEL` = flux-2-flex) +
> `FINAL_IMAGE_SCALE` for print resolution, regenerating ALL 12 scenes; the immutable
> character descriptor is now force-injected into every scene prompt; preview is 3 scenes.

```
User completes Step 3 (dedication + ending)
  │
  └─→ POST /api/stories (save character + draft)
        │
        └─→ Redirect to /crear/[storyId]/generar (generation animation)
              │
              └─→ POST /api/stories/[storyId]/generate
                    │
                    ├─→ 1. Story text generation
                    │      Provider auto-detection: ANTHROPIC_API_KEY → GROQ → CEREBRAS → GEMINI
                    │      Claude Sonnet 4 (prod): plain fetch, x-api-key auth
                    │      Output: 12 scenes (title + text + image_prompt each)
                    │      12-beat narrative arc
                    │
                    ├─→ 2. Illustration generation — FLUX.2 "visual bible" pipeline
                    │      a. Extract visual assets (LLM): protagonist + secondary
                    │         characters + recurring LOCATIONS + WARDROBE + PROPS (≤10)
                    │      b. Generate a frozen reference sheet per asset via FLUX.2
                    │         (protagonist sheet anchored to the child's real avatar)
                    │      c. Screenplay (LLM): per-scene fluxPrompt + asset IDs present
                    │      d. Generate each scene with FLUX.2 conditioned on up to 8 of
                    │         those reference images → whole-world consistency
                    │      Style: reinforced watercolor suffix (see lib/ai/style.ts)
                    │      Engine: ILLUSTRATION_PROVIDER=flux2 (FLUX2_MODEL=flux-2-flex)
                    │      Preview = 4 scenes here; rest generated post-purchase
                    │      Fallback: Recraft V3 (ILLUSTRATION_PROVIDER=recraft)
                    │
                    ├─→ 3. Save to Supabase
                    │      stories.generated_text = all 12 scenes
                    │      story_illustrations rows created/updated
                    │      stories.status = 'ready'
                    │
                    └─→ Redirect to /crear/[storyId]/preview

User clicks "Buy" in the preview
  │
  └─→ POST /api/checkout
        └─→ Stripe Checkout Session created
              └─→ On success: POST /api/webhooks/stripe (or /api/checkout/verify if it wins the race)
                    ├─→ Order → 'paid'
                    └─→ Physical order → email "order_confirmed" (exactly-once across webhook+verify)

Physical fulfillment + customer updates (Gelato)
  │
  ├─→ POST /api/stories/[storyId]/complete (after payment, finishes illustrations)
  │     ├─→ Render full book + interior PDFs, build cover spread (pdf-lib)
  │     ├─→ Upload PDFs → Supabase, sign 7-day URLs
  │     ├─→ createPrintOrder() → Gelato; order → 'producing', story → 'ordered'
  │     └─→ email "in_production"
  │
  └─→ POST /api/webhooks/gelato (order_status_updated / order_item_status_updated)
        ├─→ transitionOrder(): update status + tracking; story status synced
        ├─→ Emails ONLY on real status transition (no duplicates on Gelato retries):
        │     producing→in_production · shipped→shipped (w/ tracking) · delivered→delivered
        └─→ cancelled/failed → revert to 'paid' (manual review, no email)
```

## AI Provider Details

| Provider | Model | Auth | Rate limit | Cost |
|----------|-------|------|------------|------|
| Anthropic (prod) | claude-sonnet-4-6 | x-api-key | — | ~$0.05/story |
| Groq (dev) | llama-3.3-70b-versatile | Bearer | 1,000 RPD | Free |
| Cerebras (dev) | llama3.3-70b | Bearer | 14,400 RPD | Free |
| Gemini (dev) | gemini-2.5-flash | API key | 20 RPD | Free |

**Rules:** No AI SDKs. Plain `fetch()` only. Provider selected automatically via env var presence.

## API Cost Per Book (Production)

| Service | Cost | Notes |
|---------|------|-------|
| Claude Sonnet 4 (story text) | ~$0.05 | ~3K input + 2K output tokens |
| FLUX.2 [flex] reference sheets | ~$0.48 | ~6 visual-bible assets × ~$0.08/img |
| FLUX.2 [flex] illustrations | ~$1.68 | ~21 imgs (cover+scenes+secondaries) × ~$0.08/img |
| Gemini 2.5 Flash QA judge | ~$0.02 | vision review + re-judge passes |
| **Total AI cost per book** | **~$2.2** | flex ~$0.08/img (per-megapixel ~$0.06/MP at 1408×960); pro is higher |

> Engine A/B (artifacts/benchmark): FLUX.2 beat Recraft on scene coherence 9.8 vs 4.8.
> FLUX.2 [flex] (~$0.06/megapixel ≈ $0.08/img at 1408×960) + reinforced watercolor prompt chosen as default (look + cost); pro via `FLUX2_MODEL`.

## Infrastructure Cost (Monthly, Estimated)

| Service | Cost |
|---------|------|
| Vercel (Pro) | ~20 EUR/month |
| Supabase (Free → Pro when needed) | 0-25 EUR/month |
| Resend (email) | Free tier (3,000 emails/month) |
| Domain | ~1 EUR/month (12 EUR/year) |
| **Total fixed** | **~21-46 EUR/month** |

## Key Files

```
src/
├── app/[locale]/
│   ├── page.tsx                          — Landing page
│   ├── layout.tsx                        — NextIntlClientProvider + locale metadata
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── update-password/page.tsx
│   │   └── callback/route.ts             — OAuth callback
│   ├── crear/
│   │   ├── page.tsx                      — "El Camino" 3-step flow orchestrator (Character → Path → Dedication, TOTAL_STEPS=3)
│   │   └── [storyId]/
│   │       ├── generar/page.tsx          — Generation animation
│   │       └── preview/page.tsx          — Book preview + checkout
│   ├── dashboard/page.tsx                — User dashboard
│   ├── perfil/page.tsx                   — User profile
│   └── checkout/success/page.tsx         — Post-purchase confirmation
├── app/api/
│   ├── waitlist/route.ts                 — POST: subscribe to waitlist (name + email → Supabase + Resend)
│   ├── newsletter/route.ts               — POST: newsletter subscription endpoint
│   ├── stories/
│   │   ├── route.ts                      — POST: save character + story draft
│   │   └── [storyId]/
│   │       ├── route.ts                  — GET: fetch story with illustrations
│   │       ├── generate/route.ts         — POST: trigger text + image generation
│   │       ├── complete/route.ts         — POST: mark story complete
│   │       ├── title/route.ts            — POST: update story title
│   │       └── pdf/route.ts              — GET: render + cache PDF
│   ├── checkout/route.ts                 — POST: create Stripe session
│   ├── checkout/verify/route.ts          — GET: confirm payment (webhook fallback) + order_confirmed email
│   ├── webhooks/stripe/route.ts          — POST: Stripe webhook → 'paid' + order_confirmed email
│   ├── webhooks/gelato/route.ts          — POST: Gelato webhook → status/tracking + lifecycle emails
│   ├── dashboard/route.ts                — GET: user stories/orders/characters
│   └── profile/route.ts                  — GET/PATCH: user profile
├── components/
│   ├── book-viewer/                      — react-pageflip book viewer
│   ├── crear/                            — Creation-flow components: Step2CharacterCreation, PortraitReveal, PathBuilder, Step5AuthorMessage, CreationHeader, PageFlip
│   ├── landing/                          — Navbar, Footer, etc.
│   ├── waitlist/
│   │   └── WaitlistPage.tsx              — Full-screen waitlist gate (form + subscriber counter)
│   ├── BrandLogo.tsx                     — Meapica logo (SVG Book-M + Fredoka text)
│   └── WritingAnimation.tsx              — Quill pen logo reveal animation
├── lib/
│   ├── ai/
│   │   ├── story-generator.ts            — Multi-provider text generation
│   │   ├── flux2.ts                      — FLUX.2 wrapper (≤8 refs, flex/pro)
│   │   ├── visual-assets.ts              — Visual bible: extract + gen reference sheets
│   │   ├── scene-screenplay.ts           — Per-scene fluxPrompt + asset IDs + watercolor suffix
│   │   ├── style.ts                      — Shared reinforced-watercolor style directives
│   │   ├── qa-judge.ts                   — Gemini 2.5 Flash illustration QA judge
│   │   ├── illustrations.ts              — FLUX.2 multi-ref scene gen (Recraft V3 fallback)
│   │   ├── character-description.ts      — buildCharacterVisualDescription()
│   │   └── mock-story.ts                 — Mock data for dev/testing
│   ├── pdf/
│   │   ├── book-template.tsx             — 32-page book layout
│   │   ├── theme.ts                      — 210×210mm format, 5 themes, typography
│   │   └── decorations.tsx               — SVG ornaments (dividers, borders)
│   ├── supabase/
│   │   ├── client.ts                     — Browser client
│   │   ├── server.ts                     — Server client (RSC/Route Handlers)
│   │   ├── middleware.ts                 — Session refresh + route protection
│   │   └── storage.ts                    — Upload illustrations + PDFs
│   ├── email/
│   │   ├── send.ts                       — Resend REST sender + getSiteUrl() (never throws)
│   │   ├── layout.ts                     — Shared branded HTML email shell + escapeHtml()
│   │   ├── order-emails.ts               — Localized order lifecycle templates (es/ca/en/fr)
│   │   └── notify-order.ts               — Resolve recipient (auth.admin or passed email) + send
│   ├── waitlist-email.ts                 — Resend email template for waitlist confirmation
│   ├── create-store.ts                   — Creation-flow state + path/beat helpers (getTemplateBeats, getRecommendedTemplates)
│   ├── pricing.ts                        — Shared pricing constants
│   ├── stripe.ts                         — Stripe singleton
│   └── database.types.ts                 — Auto-generated Supabase types
├── i18n/
│   ├── routing.ts                        — Locale config (es/ca/en/fr)
│   ├── request.ts                        — Server-side message loading
│   └── navigation.ts                     — Locale-aware Link, useRouter, etc.
└── messages/
    ├── es.json                           — Spanish (~550 keys, default)
    ├── ca.json                           — Catalan
    ├── en.json                           — English
    └── fr.json                           — French
```

## Key Technical Notes

- **Resend email** — Transactional emails via Resend REST API (no SDK). Currently sending from `constrack.pro` domain (temporary); `meapica.com` DNS records need to be configured in Resend for branded emails. Two flows: (1) waitlist confirmation, (2) physical-order lifecycle — `order_confirmed` → `in_production` → `shipped` (with carrier tracking) → `delivered`, all localized (es/ca/en/fr). Order emails fire exactly-once: confirmation from whichever of the Stripe webhook / verify endpoint flips the order to `paid` first; production/shipping/delivery from the Gelato webhook, guarded by a real status transition so retried webhooks never duplicate. Env vars: `RESEND_API_KEY` (required), `EMAIL_FROM` (optional, default `Meapica <hola@constrack.pro>`), `NEXT_PUBLIC_SITE_URL` (optional, default `https://meapica.com` — used for logo + dashboard/tracking links).
- **Waitlist gate** — Controlled by `WAITLIST_MODE` env var (true/false). Secret bypass via `WAITLIST_ACCESS_CODE` env var (query param sets a cookie for team testing).
- **No AI SDKs** — Xavier's preference. Everything uses plain `fetch()`. Provider auto-detected from env vars.
- **Guest flow** — /crear is unprotected. Anonymous Supabase sign-in at checkout if not logged in. State persisted in localStorage.
- **Character consistency** — `buildCharacterVisualDescription()` in `character-description.ts` (extracted to avoid circular deps between story-generator and mock-story).
- **Illustration cache** — `illustration_library` table deduplicates by SHA-256 hash of the full prompt. Avoids regenerating the same scene twice.
- **PDF caching** — `stories.pdf_url` stores the storage path. Cleared on re-generation. `?force=true` forces a new render.
- **Route protection** — Middleware redirects unauthenticated users from `/dashboard`, `/perfil` to `/auth/login`.
- **Locale routing** — URL prefix for all locales: `/es/crear`, `/en/crear`, `/ca/crear`, `/fr/crear`.
