# Roadmap

## Overview

The roadmap is divided into 6 phases, from foundation to scale. Each phase has clear deliverables and a "done when" criteria. We prioritize speed to first real sale over perfection.

---

## Phase 0: Foundation
> **Status: COMPLETE ✅**

**What we did:**
- [x] Define product vision and positioning ("artesanal digital")
- [x] Define book format, templates, personalization variables
- [x] Define pricing and business model
- [x] Define tech stack (Next.js + Supabase + Vercel + Stripe + Claude + Recraft + Gelato)
- [x] Design UI screens in Stitch (landing + 7-step Story Builder flow)
- [x] Create project documentation

---

## Phase 1: Project Setup & Landing Page
> **Status: COMPLETE ✅** (SEO, email capture, analytics pending for post-launch)

**Deliverables:**
- [x] Initialize Next.js 16 project with TypeScript + Tailwind v4
- [x] Configure Supabase (database, auth, storage, RLS)
- [x] Deploy to Vercel (CI/CD on push)
- [x] Implement landing page with Meapica branding
- [x] i18n: 4 locales (ES default, CA, EN, FR) via next-intl
- [x] Meapica brand identity: BrandLogo + WritingAnimation components
- [ ] Domain registration (meapica.com)
- [ ] SEO: meta tags, Open Graph, structured data
- [ ] Email capture / waitlist
- [ ] Analytics (Vercel Analytics)

---

## Phase 2: Story Builder Flow
> **Status: COMPLETE ✅**

**Deliverables:**
- [x] Step 1: Mode selection (solo / together)
- [x] Step 2: Character creation — name, city, age, hair, skin, gender, interests + live avatar preview
- [x] Step 3: Template selection (5 templates, sorted by age/interest relevance, "Recomendado" badge)
- [x] Step 4 Solo Mode: 3 tabs (Compañero/Atmósfera/El Giro), template-driven decisions + open text
- [x] Step 4 Together Mode: 3 sequential visual decision pages (encounter/companion/challenge)
- [x] Step 5: Dedication message + 3 dynamic endings per template + back cover preview
- [x] Step 6: Generation animation with whimsical progress messages
- [x] Step 7: Interactive book viewer (page-flip animation + sound) + checkout UI
- [x] User authentication (Supabase Auth: email + Google OAuth + anonymous guest sign-in)
- [x] Guest flow: /crear is unprotected; GuestGate modal at finish offers login or anonymous continuation
- [x] State persistence in localStorage for guests (usePersistedState hook)
- [x] All wizard state: create-store.ts with decision tree architecture for all 5 templates
- [x] Supabase schema: profiles, characters, stories, story_illustrations, orders, sagas, illustration_library tables with RLS
- [x] All 29 UI components use useTranslations() — zero hardcoded strings

---

## Phase 3: AI Generation Engine
> **Status: COMPLETE ✅**

**Deliverables:**
- [x] Multi-provider story text generation: Anthropic Claude Sonnet 4 → Groq (Llama 3.3 70B) → Cerebras → Gemini 2.5 Flash
- [x] Prompt engineering: 12-beat narrative arc (opening → spark → threshold → encounter → ally → explore → test → bonds → challenge → darkest → breakthrough → homecoming)
- [x] Story output: 12 scenes × (title + text + image prompt)
- [x] Recraft V3 illustration generation (child_book style, 1024×1024, $0.04/img)
- [x] Character consistency: identical `buildCharacterVisualDescription()` prepended to every image prompt
- [x] Style consistency via Recraft custom style_id seeded from DiceBear avatar
- [x] Illustration library table caches images by description hash (avoids regeneration)
- [x] Generation pipeline: text → 12 illustrations → save to Supabase Storage
- [x] PDF book generation: 32-pages, 4 layout types (full_bleed, text_page, classic, vignette), @react-pdf/renderer
- [x] PDF cached in Supabase Storage (private bucket, user-scoped), served via signed URL
- [x] `?force=true` param forces PDF regeneration
- [x] Error handling and mock fallback for illustration generation

**Key decisions:**
- Story AI: Claude Sonnet 4 (prod, ~$0.05/story). Auto-detects provider from env vars — no SDK, plain fetch.
- Image AI: Recraft V3 child_book (~$0.48/book = 12 × $0.04). DiceBear avatar used to seed style_id for consistency.
- PDF engine: @react-pdf/renderer (Node.js, keeps full stack in one language)

---

## Phase 4: Book Production & Checkout
> **Status: IN PROGRESS 🔄**

**Deliverables:**
- [x] Stripe checkout code (session creation, webhook handler)
- [x] Order management: orders table in Supabase
- [x] Post-purchase confirmation page (`/checkout/success`)
- [x] PDF layout engine complete (32-pages, print-ready)
- [ ] **Stripe API keys configured** (code exists, not activated)
- [ ] Gelato API integration: create order, upload PDF, track status
- [ ] Gelato product configuration (paper weight, binding, cover finish, bleed)
- [ ] Test print run: 3-5 physical books to validate quality
- [ ] Confirmation emails (order placed, printing started, shipped)
- [ ] Tracking number forwarding from Gelato
- [ ] Upsell implementation in checkout: Pack Aventura, digital PDF, extra copy

**Done when:** A test order goes through the full pipeline: checkout → PDF → Gelato → physical book in hand.

---

## Phase 5: Launch
> **Status: NOT STARTED 🔜**

**Pre-launch (before first sale):**
- [ ] Activate Stripe (configure API keys, test end-to-end payment)
- [ ] Complete Gelato integration + test print
- [ ] Unreasonable Hospitality implementation (see below)
- [ ] Final QA on complete flow (20+ test runs)
- [ ] SEO basics: meta tags, Open Graph, structured data
- [ ] Domain registration (meapica.com)
- [ ] Analytics setup (Vercel Analytics)

**Launch:**
- [ ] Professional photos of printed books (for landing + ads)
- [ ] Instagram account setup + 10 initial posts
- [ ] 10 beta sales to family/friends (discounted, for feedback)
- [ ] Collect and address feedback
- [ ] Launch marketing campaign (organic + first paid ads 50-100 EUR)
- [ ] Contact 10 parenting micro-influencers

**Done when:** 20+ real paying customers. NPS > 50, repeat interest signals.

---

## Phase 6: Scale & Expand (Month 3+)
> **Status: PARTIAL 🔄** (avatar done, rest pending)

**Deliverables:**
- [x] **Custom SVG avatar system** — DiceBear replaced with composable SVG avatar (CharacterAvatar + svg-builder). Flat file structure: `CharacterAvatar.tsx`, `svg-builder.ts`, `mappings.ts`, `overlays.ts`, `types.ts`.
- [ ] New story templates (expand from 5 to 10+)
- [ ] Saga system implementation (linear, episodic, progression)
- [ ] English version (USA/UK market)
- [ ] Premium adventure packs with Spanish 3PL
- [ ] Affiliate/referral program
- [ ] SEO blog (10+ articles)
- [ ] Retargeting campaigns
- [ ] B2B channel (schools, events, birthdays)
- [ ] Gift cards
- [ ] Mobile PWA optimization
- [ ] QR → AI-narrated audio reading (ElevenLabs)

---

## Unreasonable Hospitality Plan
> **Target: Before first sale**

Inspired by Will Guidara's "Unreasonable Hospitality": the product isn't the book — it's the story the parent tells about the moment their child opened the package. Design for that story.

### Pre-delivery
- [ ] Email from the book's protagonist character to the child after purchase ("Hola Maya, me han dicho que pronto tendrás mi historia...")
- [ ] "Your book is being printed" update email with a preview illustration (Day +2)
- [ ] "It arrives tomorrow" email the day before delivery

### The package
- [ ] Tissue paper with Meapica pattern
- [ ] Wax seal or sticker with the template symbol (rocket, forest, etc.) — the child breaks it themselves
- [ ] Sealed envelope addressed to THE CHILD (not the parent) with a "certificate of uniqueness"
- [ ] Bookmark with a quote from the book + child's name
- [ ] Themed activity sheet (coloring/maze) — print cost ~€0.05
- [ ] "The First Reading Ritual" card: dim the lights, let the child open the envelope alone, read aloud, ask what they'd do as the protagonist

### Inside the book (PDF additions)
- [ ] Child's birthday hidden as an easter egg in one illustration (calendar on wall, shop sign, etc.)
- [ ] Final blank page: "Write the next chapter here" with lines
- [ ] QR code on back cover → AI-narrated audio reading with themed music (post-MVP, ~€20/month ElevenLabs)

### Post-delivery
- [ ] Email Day +5: "Did [name] read it yet? Tell us their reaction." (genuine curiosity, not marketing)
- [ ] Card in package: "Take a photo + tag @meapica" — not asking for a review, asking to be part of the family memory
- [ ] First month: personally message each parent about something beautiful in their child's story (doesn't scale, gets talked about)

**Estimated extra cost per order: ~€0.70. Word-of-mouth value: incalculable.**

---

## Decision Log

| # | Decision | Status | Resolution |
|---|----------|--------|------------|
| 1 | Domain name | PENDING | meapica.com (not yet registered) |
| 2 | Step 4 variants | DONE | Variant A (Juntos) + Variant C (Solo) |
| 3 | Auth method | DONE | Supabase Auth (email + Google OAuth + anonymous) |
| 4 | Story AI provider | DONE | Claude Sonnet 4 (prod), Groq/Cerebras/Gemini (dev) |
| 5 | Image AI provider | DONE | Recraft V3 child_book ($0.04/img) |
| 6 | Character consistency | DONE | Identical character description in every prompt + Recraft style_id |
| 7 | PDF engine | DONE | @react-pdf/renderer (Node.js) |
| 8 | Gelato product specs | PENDING | Paper weight, binding, finish TBD |
| 9 | i18n strategy | DONE | next-intl, 4 locales (ES/CA/EN/FR) from day 1 |

---

## Current Focus

**Next action:** Phase 4 — Activate Stripe + Gelato integration. First physical test book.
