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
| Image AI | Recraft V3 (`child_book` style) | Illustration generation |
| Book Layout | @react-pdf/renderer | PDF composition (32-page book) |
| Printing | Gelato API | Print-on-demand, global fulfillment |
| i18n | next-intl | 4 locales: ES (default), CA, EN, FR |
| Email | Resend | Transactional emails (waitlist confirmation) |
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
├── special_trait (open text — "what makes them special")
├── favorite_companion (open text — "best friend/companion")
├── avatar_url (DiceBear big-smile URL, being phased out)
├── created_at
└── updated_at

stories
├── id (uuid, PK)
├── user_id (FK → profiles)
├── character_id (FK → characters)
├── title (nullable — auto-generated post-creation)
├── template_id (1-5)
├── creation_mode (solo / together)
├── story_decisions (jsonb — choices made during Step 4)
├── special_moment (text — open text from Step 4 Solo)
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
```

## Storage Buckets

| Bucket | Access | Path pattern | Content |
|--------|--------|-------------|---------|
| `illustrations` | Public | `{storyId}/{sceneNumber}.png` | Recraft-generated scene illustrations |
| `book-pdfs` | Private | `{userId}/{storyId}.pdf` | Generated PDF books, served via signed URL |

## Generation Pipeline

```
User completes Step 5 (dedication + ending)
  │
  └─→ POST /api/stories (save character + draft)
        │
        └─→ Redirect to /crear/[storyId]/generar (Step 6 animation)
              │
              └─→ POST /api/stories/[storyId]/generate
                    │
                    ├─→ 1. Story text generation
                    │      Provider auto-detection: ANTHROPIC_API_KEY → GROQ → CEREBRAS → GEMINI
                    │      Claude Sonnet 4 (prod): plain fetch, x-api-key auth
                    │      Output: 12 scenes (title + text + image_prompt each)
                    │      12-beat narrative arc
                    │
                    ├─→ 2. Illustration generation × 12 (parallel)
                    │      Recraft V3 child_book, 1024×1024
                    │      Character description prepended to every prompt (consistency)
                    │      illustration_library cache checked first (avoids regeneration)
                    │      Images stored in Supabase Storage (illustrations bucket)
                    │
                    ├─→ 3. Save to Supabase
                    │      stories.generated_text = all 12 scenes
                    │      story_illustrations rows created/updated
                    │      stories.status = 'ready'
                    │
                    └─→ Redirect to /crear/[storyId]/preview (Step 7)

User clicks "Buy" in Step 7
  │
  └─→ POST /api/checkout
        └─→ Stripe Checkout Session created
              └─→ On success: POST /api/webhooks/stripe
                    ├─→ Order saved to DB
                    └─→ GET /api/stories/[storyId]/pdf (triggered or on-demand)
                          ├─→ Check Supabase Storage cache
                          ├─→ If missing: render PDF with @react-pdf/renderer
                          └─→ Upload to book-pdfs bucket, return signed URL
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
| Recraft V3 (12 illustrations) | ~$0.48 | $0.04/img × 12 |
| **Total AI cost per book** | **~$0.53** | |

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
│   │   ├── page.tsx                      — Wizard Steps 1-5
│   │   └── [storyId]/
│   │       ├── generar/page.tsx          — Step 6 generation animation
│   │       └── preview/page.tsx          — Step 7 book preview + checkout
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
│   ├── webhooks/stripe/route.ts          — POST: Stripe webhook handler
│   ├── dashboard/route.ts                — GET: user stories/orders/characters
│   └── profile/route.ts                  — GET/PATCH: user profile
├── components/
│   ├── avatar/
│   │   ├── CharacterAvatar.tsx           — React component (SVG avatar)
│   │   ├── svg-builder.ts                — getAvatarSvgString() for PDF
│   │   ├── mappings.ts                   — Gender/hairstyle/interest mappings
│   │   ├── overlays.ts                   — Interest accessory overlays
│   │   └── types.ts                      — Avatar prop types
│   ├── book-viewer/                      — react-pageflip book viewer
│   ├── crear/                            — All wizard step components
│   ├── landing/                          — Navbar, Footer, etc.
│   ├── waitlist/
│   │   └── WaitlistPage.tsx              — Full-screen waitlist gate (form + subscriber counter)
│   ├── BrandLogo.tsx                     — Meapica logo (SVG Book-M + Fredoka text)
│   └── WritingAnimation.tsx              — Quill pen logo reveal animation
├── lib/
│   ├── ai/
│   │   ├── story-generator.ts            — Multi-provider text generation
│   │   ├── illustrations.ts              — Recraft V3 image generation
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
│   ├── waitlist-email.ts                 — Resend email template for waitlist confirmation
│   ├── create-store.ts                   — Wizard state + decision tree constants
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

- **Resend email** — Transactional emails via Resend API. Currently sending from `constrack.pro` domain (temporary). `meapica.com` DNS records need to be configured in Resend for branded emails. API key env var: `RESEND_API_KEY`.
- **Waitlist gate** — Controlled by `WAITLIST_MODE` env var (true/false). Secret bypass via `WAITLIST_ACCESS_CODE` env var (query param sets a cookie for team testing).
- **No AI SDKs** — Xavier's preference. Everything uses plain `fetch()`. Provider auto-detected from env vars.
- **Guest flow** — /crear is unprotected. Anonymous Supabase sign-in at checkout if not logged in. State persisted in localStorage.
- **Character consistency** — `buildCharacterVisualDescription()` in `character-description.ts` (extracted to avoid circular deps between story-generator and mock-story).
- **Illustration cache** — `illustration_library` table deduplicates by SHA-256 hash of the full prompt. Avoids regenerating the same scene twice.
- **PDF caching** — `stories.pdf_url` stores the storage path. Cleared on re-generation. `?force=true` forces a new render.
- **Route protection** — Middleware redirects unauthenticated users from `/dashboard`, `/perfil` to `/auth/login`.
- **Locale routing** — URL prefix for all locales: `/es/crear`, `/en/crear`, `/ca/crear`, `/fr/crear`.
