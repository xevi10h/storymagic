# Roadmap

## Overview

The roadmap is divided into 6 phases, from foundation to scale. Each phase has clear deliverables and a "done when" criteria. We prioritize speed to first real sale over perfection.

---

## 🔥 Active priorities (2026-06-15) — generation pipeline & launch

See **`docs/generation-pipeline.md`** and **`docs/launch-checklist.md`** for full detail.

**Blocked on:** BFL + fal image credits exhausted → top up ~$15-20 (fal) before any generation work.

- [ ] **Preview ≤ 20-30s to first cover** — streaming preview + early child sheet shipped
      (2026-09-27, docs/generation-pipeline.md "Streaming preview"): measured scene 1 at 35 s,
      cover at 40 s (was 85–125 s). Remaining critical path = cast (8 s) + companion sheet (12 s)
      + cover render (15–19 s). Next levers, biggest first:
      1. Template-level companions: pre-render (and cache per template × companion) the
         companion sheet so it is ready before the plan → cover at ~28–31 s.
      2. Deterministic templated cover shot (child + main companion in the template's world,
         not from the LLM) rendered during the dedication screen → cover visible at ~0–15 s.
      3. ✅ UI shows the first finished image (scene 1 usually beats the cover by ~5 s).
      4. Deploy with the migration runbook in `docs/stack.md` ("Deploy order — creation flow v2").
- [ ] **Creation flow v2 — after the integration (branch `feat/creation-flow-v2`, 2026-09-28):**
      1. ✅ Avatar matrix rendered + wired (950 bases, 2 age bands, eye/freckles/glasses overlays, $24.22).
         Next: deploy the assets before relying on them as face anchors (fetched from NEXT_PUBLIC_SITE_URL).
      2. Photo mode: the Bible still describes the default traits (skin/hair) next to the photo →
         derive the look from the photo (vision call) or ask skin/hair in photo mode, before the flag goes on.
      3. `character_preps` orphans: child sheets of preps never used by a story stay in
         `illustrations/character-preps/` → add a daily cleanup (> 7 days, no referencing story).
      4. Local Supabase round-trip (Docker engine was unresponsive on 2026-09-28): `supabase start`,
         apply the 6 migrations, run prepare → stories → generate with `MOCK_MODE` against it.
      5. `send-preview`: add a per-IP window next to the per-user limit.
- [ ] **Validate** the per-scene character lock + high-res (`FINAL_IMAGE_SCALE`) with a fresh book.
- [ ] **Background final generation + "book ready" email** — run `/complete` async post-purchase
      (tie into the fulfilment cron) and email the customer when the book is finished.
- [ ] Consistency hardening: multi-pose protagonist turnaround sheet generated with the premium
      model; enforce gender from the `gender` field over the name in prose; unify the descriptor
      across architect/screenplay.
- [ ] Launch P0/P1 (from launch-checklist): deploy to prod (activates the cron), go-live envs
      (`STRIPE_ENVIRONMENT=live`, live Stripe keys, `GELATO_FULFILLMENT_MODE=direct`,
      `ILLUSTRATION_PROVIDER`/image-model envs), verify `meapica.com` in Resend, real order test.

**Done this session:** all 390 path-art images (fal dev, ~$4.68); fulfilment safety-net cron;
preview-timeout fix; cover ref anchoring; QA-skipped flag; two-speed model split; per-scene
character lock; per-stage resolution. (commits 5ebc2f1 → a883d60)

---

## Next steps from commerce block A (2026-09-28)
- **Reorder / buy the printed book after the PDF**: a `ready`/`ordered` story shows no paywall, so a digital buyer can't upgrade to a hardcover (checkout API already accepts `ready`). Upsell "¿Lo quieres en papel?" in the ready view + book_ready email.
- **VeriFactu-compliant invoicing** before the 2027 obligation (Stripe invoices aren't); OSS registration when EU digital sales pass 10 000 €.
- **Refund customer email** (today refunds only change state + alert ops) and a "find my order" magic link for guests (download token already works cross-device).
- **Harden stories RLS**: owners can UPDATE any column (status, generated_text, pdf_url); money paths no longer trust them, but restrict to title/dedication.
- **Title edits after purchase** re-render nothing: block edits once paid or rebuild the PDF.
- Bizum/PayPal (payment_method_types is card-only).

## Next steps from brand system phase 1 (2026-09-30)
Brand spec in `docs/brand.md`; semantic tokens in `globals.css`; primitives in `src/components/ui/`.
- [x] Rebuild the home landing on the brand system (2026-09-30; structure in `docs/product-spec.md` › Home landing). SEO pages / blog in progress.
- [ ] Drop legacy tokens (`cream`, `text-muted`, `footer-*`, `pack-*`, `.texture-overlay`) once no screen uses them.
- [x] Contrast: `--ink-muted: #7a6963` (4.95:1) and `--brand-text: #b94f1f` for orange text; `Eyebrow` kicker, `ChoiceChip` and `Button` secondary use it. Done 2026-09-30: every white label on `bg-brand` is 19 px bold (AA large text); small ones (navbar pill, `sm` buttons, chips, step numbers, badges) use `bg-brand-tint` + `text-brand-text` (docs/brand.md › Colour).
- [x] Global `:focus-visible` rule moved into `@layer base`.
- [ ] Migrate creation components to `src/components/ui` primitives (same classes, less duplication).

## Next steps from landing QA pass (2026-09-30)
- [x] Seasonal banner CLS — DONE 2026-09-30: `Navbar` is now a server wrapper that renders the banner from `spainToday()` into the static/ISR HTML (`[locale]/layout.tsx` revalidates hourly so no marketing page serves a stale season); an inline script after the header publishes `--landing-nav-h` before paint; a dismissed message is hidden before paint via a `<head>` script (localStorage → `html[data-season-dismissed]`) + the banner's own `<style>`, no cookies read (pages stay static). Dev `?now=` reaches the server through middleware (`x-season-now`). CLS with `?now=2026-11-15`: 0.0725 → 0.0049 at 390, 0.0378 → 0.0046 at 1440 (remaining = hero web-font swap, same as off-season).
- [ ] `LiveCover` sizes its title with JS after measuring (tiny in-cover text shift, ~0.002 CLS): switch to container-query units (`cqw`).
- [ ] `BookMockup` serves raw `<img>` (the example's cover + 1600 px spread at ~95–430 css px on desktop): use `next/image` or pass right-sized sources.
- [ ] Catalog filter overlap by design (a 5–8 world shows under "8–12"); consider exclusive buckets by `ageMin` if parents find it confusing.
- [ ] "Envío gratis" (hero) vs "Envío incluido" (closing CTA, FAQ): pick one wording across locales.

## Next steps from favourite-colour palette + name display form (2026-09-30)
- [ ] Data backfill (owner decision): every character created by flow v2 has `favorite_color = '#E53935'` (old silent default, never asked) → those books now print as deliberate red; `UPDATE characters SET favorite_color = NULL WHERE favorite_color = '#E53935'` would give them the neutral palette. Same for lower-case stored names (`formatChildName` backfill).
- [ ] Show the chosen colour live on screen 2 (portrait ring / mini endpaper swatch) so parents see what it does.

## Next steps from brand loader (2026-09-30)
- [x] `BrandLoader` (self-drawing book mark) + `PageLoader` + `Spinner` replace every Material `progress_activity` / CSS-ring spinner; route `loading.tsx` on dashboard, perfil, checkout/success, crear/[storyId], ejemplo/[storyId]. See docs/brand.md › Loader.
- [ ] Replace the raster `BrandIcon` mask (`/images/m-icon-mask.png`) and favicons with a static vector of the same stroke mark (crisper at 16–32 px, one source of truth).
- [ ] Use the drawn mark as the brand moment of the /crear "mientras se pinta" screen (draw once, then hand over to the real progress bar) and in the order-confirmation email header (animated SVG/GIF).
- [ ] /crear hydration hold (`!hydrated || !prefillReady`) renders an empty screen; consider `PageLoader` after ~300 ms if it is ever slow on real devices.

## Next steps from commerce block B — Gelato (2026-09-28)
- **Real paid print** of one hardcover to validate paper, colour and binding (drafts don't print; ~21 € incl. VAT).
- **Canarias/Ceuta/Melilla** are excluded (decision 2026-09-28) but only enforced after payment (ops alert). Block it before paying: ask the postcode on the paywall, or move to Checkout `ui_mode: custom` with server-side shipping-address validation.
- ~~Reyes page (block D)~~ DONE 2026-09-29 (`/[locale]/christmas-delivery` + site-wide `SeasonalBanner`). Still to do: re-quote Gelato and check its peak-season cut-offs in November, then adjust `DELIVERY_DAYS` / `PEAK_BUFFER_DAYS` (page, banner, FAQ and JSON-LD update automatically).
- **Block D follow-ups (Christmas campaign)**: the Reyes cut-off (22 Dec) leaves ~8 business days to 5 Jan while the written promise is "7-10 días laborables": decide whether to keep 6 buffer days or move to 20 Dec; PDF upgrade-to-print path so late PDF buyers can still get the paper book after Reyes; a Christmas/Reyes story world; Catalan-specific Tió / Nadal angle.
- **Paid express option** for December (Gelato express 5,40-5,76 € península, 4 days to Barcelona).
- Re-send the "shipped" email if the tracking code arrives after the status (today only the dashboard gets it).

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
- [x] Email capture / waitlist (Resend confirmation emails, newsletter_subscribers table, secret access code bypass)
- [ ] Analytics (Vercel Analytics)

---

## Phase 2: Story Builder Flow
> **Status: COMPLETE ✅** (multi-step wizard later **SUPERSEDED by the "El Camino" 3-step flow** — see Creation Flow v2 below)

**Deliverables:**
- [~] Step 1: Mode selection (solo / together) — **SUPERSEDED**: mode removed; flow no longer branches solo/together
- [x] Step 2: Character creation — name, city, age, hair, skin, gender, interests, favorite color + companion + FLUX.2 portrait reveal
- [~] Step 3: Template selection (originally 5, now **10** templates) — **SUPERSEDED**: template is now the path's first fork ("world" beat), not a separate screen
- [~] Step 4 Solo Mode: 3 tabs (Compañero/Atmósfera/El Giro) — **SUPERSEDED** by the branching path (PathBuilder)
- [~] Step 4 Together Mode: 3 sequential visual decision pages — **SUPERSEDED** by the branching path (PathBuilder)
- [x] Dedication message + dynamic per-template endings + back cover preview (now Step 3 of El Camino)
- [x] Generation animation with whimsical progress messages
- [x] Interactive book viewer (page-flip animation + sound) + checkout UI
- [x] User authentication (Supabase Auth: email + Google OAuth + anonymous guest sign-in)
- [x] Guest flow: /crear is unprotected; on finish, non-logged users continue seamlessly as guest (anonymous sign-in, no modal). See Phase 2 — Conversion (GuestGate removed for zero-friction creation)
- [x] State persistence in localStorage for guests (usePersistedState hook)
- [x] Creation-flow state: create-store.ts — branching story-tree architecture for all 10 templates
- [x] Supabase schema: profiles, characters, stories, story_illustrations, orders, sagas, illustration_library tables with RLS
- [x] All UI components use useTranslations() — zero hardcoded strings

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
- [x] Children's illustrations private (2026-09-27): `illustrations` bucket private, DB stores object paths, path-based ownership + signed URLs, public `showcase` mirror for marketing (docs/stack.md). **Pending ops:** apply the 3 migrations + run `scripts/publish-showcase.mts` in the documented order
- [ ] Relocate legacy portraits (`portraits/{uuid}/…`) into `portraits/{userId}/…` and drop the legacy-portrait allowance
- [ ] Preview page: re-fetch signed URLs on image error / tab focus after ~50 min (1 h TTL)
- [ ] Admin action "publish/unpublish showcase" that copies/removes the `showcase` mirror (today: manual script)
- [x] `?force=true` param forces PDF regeneration
- [x] Error handling and mock fallback for illustration generation

**Key decisions:**
- Story AI: Claude Sonnet 4 (prod, ~$0.05/story). Auto-detects provider from env vars — no SDK, plain fetch.
- Image AI: **superseded by Phase 3 v2 below** (was Recraft V3 child_book). Recraft kept only as fallback.
- PDF engine: @react-pdf/renderer (Node.js, keeps full stack in one language)

---

## Phase 3 v2: Illustration Engine — FLUX.2 "Visual Bible"
> **Status: COMPLETE ✅ — validated end-to-end in the real app (2026-06)**

Replaced Recraft V3 with **FLUX.2 [flex]** + a whole-world consistency system. Decided by a real benchmark (`artifacts/benchmark`): FLUX.2 beat Recraft on scene coherence **9.8 vs 4.8** and is cheaper ($0.03 vs $0.04/img; flex $0.01). flex chosen over pro after a watercolor A/B — same brand look, holds identity, 3× cheaper, latency negligible.

**What we built:**
- [x] `src/lib/ai/flux2.ts` — FLUX.2 wrapper (flex/pro via `FLUX2_MODEL`), up to **8 reference images/scene**, width/height, async polling. Provider flag `ILLUSTRATION_PROVIDER=flux2`.
- [x] **Visual bible** (`visual-assets.ts`): extraction now covers protagonist + secondary characters + **recurring LOCATIONS + WARDROBE + PROPS** (≤10 frozen reference sheets), not just the protagonist.
- [x] **Avatar = identity base** (`/api/characters/portrait` migrated to FLUX.2): the child's watercolor portrait is generated once, uploaded to Supabase (`portraits/`), saved as `character.avatar_url`, and **anchors the protagonist reference sheet → which anchors every scene**.
- [x] Per-scene multi-ref assembly (`illustrations.ts`): focal char + others + location + props, up to 8 refs (removed the old 2-ref Kontext cap).
- [x] **Reinforced watercolor style** shared suffix (`style.ts`), validated in A/B.
- [x] **QA judge migrated to Gemini 2.5 Flash** (`qa-judge.ts`, ~10× cheaper than gpt-4o), consistency threshold 8.
- [x] **Closed QA loop** (`complete/route.ts`): judge → regenerate failing scenes (with the judge's suggestion folded in) → **re-judge**, cap 2 passes.
- [x] **Parallelism**: concurrency 8 (BFL allows 24). Safe because each scene anchors to frozen sheets, never to another scene — order doesn't affect coherence.
- [x] **Verified end-to-end in the running app**: full 12-scene book + avatar + cover; protagonist, the alien companion, the spaceship-garden location and props all stayed consistent across the whole book.

**Cost/book (flex):** ~$0.34 AI total (was ~$0.53), well under the €1.50 target. Engine swappable to pro via `FLUX2_MODEL`.

**Open follow-ups:**
- [ ] Tighten style uniformity: a couple of scenes lean slightly more "digital" than the painterly ones — push the watercolor suffix weight or add a style-reference sheet.
- [ ] Consider raising the regen cap from 2 → 3 for stubborn scenes (one scene shipped at threshold).
- [ ] Optionally retire Recraft entirely (now only a fallback; no longer on the critical path).
- [ ] Protagonist sheet as a turnaround (front/side + expressions) for even stronger pose consistency.

**Test tooling added:** `scripts/benchmark-illustrations.mjs`, `scripts/test-visual-bible.mjs`, `scripts/complete-test-book.mjs`, `e2e/flux2-fullbook.spec.ts`.

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
- [ ] Low-CAC GTM sprint: 20-50 beta families, reaction content, referral codes, local partner outreach, and first SEO gift pages
- [ ] Build a post-purchase referral loop with rewards for both buyer and referred family
- [ ] Pilot one local community launch with nurseries, bookshops, parent associations, or children's event venues
- [ ] Test school/nursery fundraising codes as a low-CAC group acquisition channel
- [ ] Create AI-assisted sample preview content for common names, interests, and gift occasions
- [ ] Remote-only engagement sprint: hire/test a visible social face on a 30-day base + performance trial, launch comment-to-preview content, and qualify micro-influencers with digital previews before sending physical books
- [ ] Evaluate one influencer partner candidate through a 60-90 day earn-in trial before considering equity or advisor upside

**Done when:** 20+ real paying customers. NPS > 50, repeat interest signals.

---

## Phase 6: Scale & Expand (Month 3+)
> **Status: PARTIAL 🔄** (identity + templates done, rest pending)

**Deliverables:**
- [x] **Character identity = FLUX.2 watercolor portrait** — generated once via `/api/characters/portrait`, stored in Supabase `portraits/` bucket, anchors the protagonist reference sheet and every scene. (Note: the previously-planned "custom SVG avatar system" was NEVER built; DiceBear was NOT replaced by SVG avatars — it remains only a legacy URL helper, superseded by the FLUX.2 portrait.)
- [x] New story templates — **expanded from 5 to 10** (space, forest, pirates, dinosaurs, superhero, chef, castle, safari, inventor, candy), each with a branching story-tree
- [ ] Saga system implementation (linear, episodic, progression)
- [ ] English version (USA/UK market)
- [ ] Premium adventure packs with Spanish 3PL
- [ ] Affiliate/referral program
- [ ] SEO blog (10+ articles)
- [ ] Seasonal and template-specific SEO landing pages for high-intent gift searches
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

## SEO, Performance & Conversion Optimization

Initiative to improve organic ranking and landing conversion. Audited 2026-06-02 (technical SEO + CRO + Core Web Vitals).

### Phase 1 — Quick wins
> **Status: COMPLETE ✅**
- [x] `FAQPage` structured data wired on `/legal` (component existed but was never rendered) → enables FAQ rich results
- [x] `next/image` migration for BookCollection covers/templates (was raw `<img>`) → automatic WebP/AVIF + zero CLS via `aspect-3/4` containers
- [x] `images.formats: ["image/avif","image/webp"]` in `next.config.ts`
- [x] Hero price anchor ("Desde 34,90 €" + "libro impreso + versión digital incluida"), locale-aware via `Intl.NumberFormat`
- [x] Primary CTA unified to "Crear mi cuento" across hero + navbar (was "Personalizar libro físico")
- [x] `<link rel="preconnect">` for Google Fonts (reduces Material Symbols render-blocking)
- [x] `ProductJsonLd` extended with optional `reviews` param (AggregateRating + Review) — **infra ready, intentionally NOT populated** (see Decision #11)

### Phase 2 — Conversion
- [x] **Remove GuestGate entirely** — no signup wall ever. Non-logged users continue seamlessly as guest (anonymous session) on finish; account becomes optional, to be offered post-purchase. (`crear/page.tsx` `handleFinish`; `GuestGate.tsx` now orphaned, kept for possible post-purchase reuse)
- [x] FAQ accordion on landing (`FaqSection`, native `<details>`, reuses `legal.faq` copy) — between Testimonials and final offer
- [x] Mobile sticky CTA (`MobileStickyCta`, `md:hidden` pinned pill) — global on landing + SEO pages
- [ ] Social proof with scale ("+X familias · 4,8★") once real reviews exist
- [x] Seasonal banner (1 Nov – 5 Jan, dismissible) + `/christmas-delivery` "¿Llega a tiempo para Reyes?" page — block D, 2026-09-29; cut-offs from `src/lib/shipping.ts`
- [ ] Post-purchase account offer (claim/save anonymous order → permanent account via `supabase.auth.updateUser`)

**Launch access (decided, NOT yet applied to prod):** open from day one — `WAITLIST_MODE=false` in Vercel prod + remove gate. Already off in local `.env.local`. Prod flip pending user go-live signal.

### Phase 3 — Programmatic SEO
> **Status: COMPLETE ✅** (v2: 19 landing pages × 4 locales = 76 indexable URLs + 3 hubs + blog)

English slugs (global URL convention). Config-driven registry `src/lib/seo-landing.ts` → one shared `SeoLandingPage` component → 3 thin routes. Unique localized copy per page in `seo` message namespace (es/ca/en/fr), written to avoid duplicate content. No fabricated stats/reviews.

- [x] **Gift occasion pages** `/gifts/[occasion]`: three-kings, sant-jordi, birthday, communion, christmas, **baptism, end-of-school, name-day, graduation, first-birthday** (10 total)
- [x] **Age pages** `/personalized-books/[age]`: 2-4, 5-7, 8-12 (featured templates auto-filtered by age overlap)
- [x] **Theme pages** `/themes/[theme]`: dinosaurs, space, pirates, superheroes, magic-forest, safari (CTA prefills `/crear?template=…&from=seo`; featured = main template + tag-related)
- [x] Per-page metadata: `absolute` title, description, canonical, hreflang alternates (4 locales + x-default), OpenGraph
- [x] Structured data: `BreadcrumbJsonLd` + `ProductJsonLd` per page
- [x] Internal linking: related-pages cross-links on every SEO page + global footer block (gift occasions + age ranges)
- [x] **Hub/index pages** `/gifts`, `/themes`, `/personalized-books` (`HubPage` component): head-term targeting, card grid to all sub-pages, `ItemList` + breadcrumb schema. Footer headings link to hubs. Fixes prior 404 on base paths.
- [x] 3-level breadcrumbs on sub-pages (Home → Hub → Page) + sub→hub internal links
- [x] Sitemap: 56 sub-page URLs + 3 hubs × 4 locales, with alternates
- [x] Unique copy ×4 locales (generated via 4 parallel subagents, brand voice consistent, reviewed)
- [x] **Per-page dynamic OG images** (`next/og`): shared `seoOgImage` renderer + 6 `opengraph-image.tsx` (3 sub-page types + 3 hubs). Eyebrow (occasion/theme/age label) + H1 headline + brand, localized ×4. Overrides the home OG per segment.

### Phase 3b — Editorial blog (Supabase CMS)
> **Status: COMPLETE ✅** (v1: 6 articles × es/ca = 12 posts)

Quality-first editorial, NOT mass auto-generation (avoids Google scaled-content-abuse penalty).

- [x] `blog_posts` table in Supabase (RLS: public read `published` only; writes service-role only). Additive migration `create_blog_posts`.
- [x] `src/lib/blog.ts` — untyped client read helpers (`getPublishedPosts`, `getPost`, `getLocalesForSlug`, `getAllPublishedPostRefs`)
- [x] `/blog` index + `/blog/[slug]` post (markdown via `marked`, `.prose-article` styles in globals.css). `Article` + `BreadcrumbList` schema, reading time, author.
- [x] 6 articles es+ca (English shared slugs), AI-drafted + reviewed, genuinely useful; each funnels to its related SEO page + `/crear`.
- [x] Sitemap (index + posts, alternates per published locale) + footer Blog link.
- [x] **Cover images** — 6 on-brand watercolor illustrations (Recraft V3 `digital_illustration`, 1536×1024), generated + self-hosted in Supabase Storage `illustrations/blog/{slug}.png`, one per slug (shared es/ca). Shown on index cards + post hero + used in OG.
- [ ] Future: admin editor UI (`/admin/blog`), per-post OG images, en/fr translations, more articles. (Note: regenerate Sant Jordi cover — minor AI text artifact.)

### Phase 3 — remaining
- [x] **Showcase/examples index `/ejemplo`** (`src/lib/showcase.ts` + page): lists real showcase books (locale-filtered, cover from first illustration), `CollectionPage` + `ItemList` + breadcrumb schema, in sitemap + footer link. Reuses `bookCollection` card i18n.
- [ ] Future: expand themes to all 10 templates, ISR/static optimization

---

## Creation Flow v2 — "El Camino" (choose-your-own-adventure path)
> **Status: v1 BUILT ✅** (path UX + flow rewire; full create→generate E2E pending user walkthrough)

Replaced the old "mode → template → 3 decision knobs" with a single vertical **path builder**: same on mobile & desktop, decisions chained step by step like a gamebook.

- [x] Flow reduced 5 → 3 steps: **1 Character · 2 Path · 3 Dedication**. Mode (solo/juntos) removed (`INITIAL_STATE.mode` defaults `"solo"` to keep payload valid).
- [x] `PathBuilder.tsx` — vertical trail of resolved milestones (tappable to edit) + active beat with illustrated options. Beats: **world** (1st fork = template choice, ranked by `getRecommendedTemplates`) → encounter → companion → challenge → time → setting.
- [x] `getTemplateBeats` / `beatDecisionField` helpers in `create-store`. Reuses existing decision/atmosphere data + i18n (`data.templates.{id}.*`). **Generation backend untouched** (payload = same `selectedTemplate` + `decisions`).
- [x] Downward chapter transition (`beat-animate-in` slide-up + `scrollIntoView`) replacing horizontal book-flip within the path.
- [x] Orchestrator rewired (`crear/page.tsx`): step remap, portrait → path, catalog/SEO prefill land on character (world pre-answered if template passed).
- [x] Verified: PathBuilder walk (world → ch1 → ch2) mobile + desktop, `tsc` clean, titles/questions/options localized.
- [x] **Full E2E walk (mock mode):** `e2e/qa-walkthrough.spec.ts` — character → portrait → path → dedication → preview, desktop (1440×900) + mobile (390×844), screenshots per phase, zero console errors. Run on every flow change.
- [x] **Quality pass (2026-06-10):** picsum placeholder option images replaced with themed gradient+icon cards (`OptionVisual` in PathBuilder; `icon` field added to `TreeOption` + 39 space-tree options); end-of-path celebration state (recap chips + `crear.path.complete*` i18n ×4 locales); rotating portrait-generation status messages (`crear.portraitReveal.step1-4` ×4); mobile preview flipbook fixed (forced portrait sizing measured from container + 3D tilt/spine disabled <768px); landing showcase 400s fixed (4 mock-tainted stories unflagged in DB + `/api/showcase` filters `/illustrations/mock/` URLs).
- [~] **Illustrated option art:** real FLUX.2 watercolor art per space-tree option (39 imgs, character-neutral scenes) → `public/images/path/space/{imageSeed}.webp` + `art-manifest.ts`; PathBuilder falls back to gradient+icon when art missing. Legacy (non-tree) templates still icon-only.
- [x] **Cleanup debt:** orphaned `Step1ModeSelection`, `Step3AdventureSelection`, `Step4Decisions/Solo/Juntos` deleted + i18n `crear.step1/step3/step4` removed (×4 locales). `GuestGate` intentionally kept for post-purchase account-claim reuse.
- [ ] **BLOCKED (BFL credits):** remaining 17/39 space path-art images — top up at dashboard.bfl.ai, then `node scripts/generate-path-art.mjs` (resumable; rewrites `art-manifest.ts`).
- [x] **Space tree EN/FR translations** (2026-06-11): all 13 questions + 39×3 option texts now es/ca/en/fr (EN/FR users previously saw Spanish fallbacks in tree mode). Verified in-browser on /en/crear.
- [x] **Forest story tree** (2026-06-11): `src/lib/story-trees/forest.ts` — 14 nodes / 39 options / 4 locales / icons, registered in `STORY_TREES`. Branches: dragon (Brasa's lost flame), chest (flower-key hunt), door (Whisper Garden colors). `validateTree` clean, browser-verified ES. Art prompts ready in `generate-path-art.mjs` (39 forest entries, `--manifest-only` flag added; manifest now rescans disk, idempotent).
- [x] **e2e specs updated** to the new completion CTA ("Escribir la dedicatoria"); full mock-safe suite (fullflow, branching, dedication, path2, recommend, qa-walkthrough) 10/10 green serial.
- [x] **`e2e/all-trees.spec.ts`** (2026-06-12): walks all 10 template paths to completion, asserts celebration CTA + zero console errors. 10/10 green.
- [x] **Locale sweep** (2026-06-12): ca/forest, en/pirates, fr/candy walked in-browser — paths complete, no raw i18n keys or `{name}` placeholders leaked, 0 console errors. Tree mode verified in all 4 locales.
- [x] **Edge-case QA, character step** (2026-06-12): 50-char name cap aligned client/server, XSS rendered escaped (React), blank-name Next disabled, emojis deliberately allowed. No defects.
- [x] **Tree chunk failure fallback** (2026-06-12): if a tree chunk fails to load (offline/deploy skew), PathBuilder logs and falls back to the legacy flat-decision flow instead of spinning forever — legacy code retained as the resilience path.
- [x] **WebKit (Safari) sweep** (2026-06-12): full creation flow on WebKit mobile 390px — character → portrait → space path with art → celebration → dedication → preview, 0 console errors, flipbook cover centered. Safari engine verified.
- [x] **"Book is born" reveal** (2026-06-12): one-shot full-screen moment on first preview load after generation — cover scales in with glow + gold sparkles + "¡El cuento de {name} está listo!" (`BookRevealOverlay`, sessionStorage flag set by /generar, tap-to-skip, auto-dismiss ~3.4s, no replay on reload, prefers-reduced-motion respected, 4 locales). Verified e2e.
- [x] **PDF deliverable verified** (2026-06-12, mock): full flow → dev unlock → `/api/stories/{id}/pdf` returns valid 32-page 1.9MB PDF — branded cover, themed endpapers, dedication title page, chapter spreads. Print-layout sound; real watercolor art lands automatically once credits allow real generation.
- [x] **Dinosaurs + pirates story trees** (2026-06-12): same shape as forest (14 nodes / 39 options / 4 locales / icons each), `validateTree` clean, registered, browser-verified, suite 10/10.
- [x] **Superhero + chef + castle story trees** (2026-06-12): same shape/quality bar, descs child-free for auto art prompts. Registered, browser spot-checked (3/3 complete, 0 console errors), suite 10/10. **7 of 10 templates now branch; safari/inventor/candy in progress.**
- [x] **Real-mode pipeline verified** (2026-06-12, MOCK_MODE=false locally): story TEXT generates via OpenAI; tree narratives reach the real story (visual-asset refs built for "Brasa", "Enchanted Forest", "Girona Street"); visual-ref failures non-fatal; scene-illustration billing errors fail loud by design (whole generation aborts at ~85% with error screen).
- [x] **All 10 story trees authored + registered** (2026-06-12): space, forest, dinosaurs, pirates, superhero, chef, castle, safari, inventor, candy — each 14 nodes / 39 options / 4 locales / icons, `validateTree` clean, 390 unique seeds, browser spot-checked, suite 10/10. **Every template now has true branching.**
- [~] **Path-art coverage 120/390** (real cost ≈ $0.10/img at flux-2-flex 1408×960, not the $0.03 first estimated): space 39/39, forest 39/39, dinosaurs 39/39, pirates 3/39, other 6 templates 0/39. Manifest idempotent; uncovered options use the gradient+icon fallback. Remaining 270 images ≈ $27 — rerun `node scripts/generate-path-art.mjs` after next top-up (resumable).
- [x] **Tree data lazy-loaded** (2026-06-12): `story-trees/loaders.ts` — PathBuilder dynamically imports only the selected template's tree as its own chunk (~600KB source kept out of the /crear client bundle); quiet hold state while the chunk lands; mid-path draft restore replays `treePath` once the tree arrives. Server generator keeps the static `index.ts`. Verified: 21/21 e2e green incl. mid-path reload restore.
- [ ] Future: per-world atmosphere framing, option art for legacy decision/atmosphere beats (legacy flow now dead in practice — all 10 templates branch; consider removing legacy beats code after a deprecation pass).

**Tooling note:** `@playwright/test` added as devDependency for E2E verification (per global CLAUDE.md convention).

---

## Decision Log

| # | Decision | Status | Resolution |
|---|----------|--------|------------|
| 1 | Domain name | PENDING | meapica.com (not yet registered) |
| 2 | Step 4 variants | DONE | Variant A (Juntos) + Variant C (Solo) |
| 3 | Auth method | DONE | Supabase Auth (email + Google OAuth + anonymous) |
| 4 | Story AI provider | DONE | Claude Sonnet 4 (prod), Groq/Cerebras/Gemini (dev) |
| 5 | Image AI provider | DONE | **FLUX.2 [flex]** ($0.01/img) via `ILLUSTRATION_PROVIDER=flux2`; Recraft V3 = fallback. Decided by benchmark (coherence 9.8 vs 4.8). See Phase 3 v2. |
| 6 | Character + world consistency | DONE | **Visual bible**: frozen FLUX.2 reference sheets for protagonist + secondary chars + locations + wardrobe + props, fed (≤8) per scene; avatar anchors the protagonist sheet. Recraft style_id retired from the FLUX path. |
| 12 | Illustration QA judge | DONE | Gemini 2.5 Flash (vision), closed loop with re-judge + cap-2 regen; replaced gpt-4o |
| 7 | PDF engine | DONE | @react-pdf/renderer (Node.js) |
| 8 | Gelato product specs | PENDING | Paper weight, binding, finish TBD |
| 9 | i18n strategy | DONE | next-intl, 4 locales (ES/CA/EN/FR) from day 1 |
| 10 | Pre-launch waitlist | DONE | Resend emails + Supabase newsletter_subscribers + secret access code bypass |
| 11 | Review/AggregateRating schema | BLOCKED | Infra ready in `ProductJsonLd`, but NOT populated: emitting markup with placeholder testimonials violates Google policy + EU/Spanish fake-review law. Activate only with real, verifiable reviews post-launch. |

---

## Current Focus

**Next actions:**
- **Commit + deploy the FLUX.2 visual-bible illustration engine (Phase 3 v2)** — validated end-to-end; set prod env `ILLUSTRATION_PROVIDER=flux2`, `FLUX2_MODEL=flux-2-flex`, `GOOGLE_API_KEY` (QA judge), `BFL_API_KEY`.
- Configure `meapica.com` DNS records in Resend for branded waitlist confirmation emails (currently using `constrack.pro` as temporary sender domain)
- Add Vercel production env vars: `WAITLIST_MODE`, `WAITLIST_ACCESS_CODE`, `RESEND_API_KEY`
- Analytics/tracking for waitlist conversions (signup funnel, email open rates)
- Social sharing from waitlist (refer-a-friend mechanism to boost organic signups)
- Prepare the first low-CAC GTM sprint: beta families, reaction capture, manual referral codes, local partner list, and high-intent SEO pages
- Prepare a remote-only creator/content system so the founder can generate engagement from the computer without handling physical logistics
- Disable waitlist mode when ready to launch (set `WAITLIST_MODE=false`)
- Phase 4 — Activate Stripe + Gelato integration. First physical test book.

## Next (from 2026-09-27 overhaul)
- [x] **Phase 2 — creation flow UI (6 screens), 2026-09-27:** Nombre + live cover → Protagonista (trait grid + sticky portrait, photo tab behind flag, background character prep) → Aventura (world + 3 tree chapters on one screen) → Dedicatoria while the preview is painted (real `preview_progress`) → Su libro (checklist chips, in-place sheets) → Formato + pago (VAT next to prices, optional "Envíame la preview"). See `creation-flow-v2.md`.
- Integrated 2026-09-28 (`feat/creation-flow-v2`): real `WatercolorAvatar` (vector fallback until the matrix is rendered), `glasses`/`freckles`/`characterPrepId`/`avatarAssetPath` persisted by `POST /api/stories`, signed `preview_progress`, first image shown as soon as it lands. Pending: see "Creation flow v2 — after the integration" above.
- "Envíame la preview" works on the same browser only (anonymous session per device): convert the guest to an email identity (magic link) so the link opens anywhere.
- Arrow-key navigation inside the trait/world/chapter radiogroups (today: Tab + Enter/Space).
- Print QA follow-ups (full-book review 2026-09-28): ~~back-cover synopsis runs over the child's face~~ (done 2026-09-29: paper back cover with arch vignette); scene titles printed twice on 8/12 spreads (art + text page); keepsake colophon (title, child, date, "Impreso en Europa"); paragraph spacing inconsistent (blank line vs single break from the LLM); PDF declared 1.3 while using transparency; legibility of long white text over bright panorama art (age 10-12).
- Print polish: "about the reader" page design, panorama upscale to 300 dpi. (Illustrated adventure map + search-and-find game on pp. 28–29 shipped 2026-09-28.)
- Adventure map follow-ups: fold compliance of the map (the model tends to centre the largest landmark on the gutter — try a narrower panel for ages 2–6 or a two-half layout brief); picture thumbnails next to each item for 2–4 pre-readers (crop from the map via the QA figure locator); show the map in the web viewer / preview as a teaser.
- **Phase 3 — sales:** analytics (GA4 + Meta pixel + funnel events); guarantee; −20% on 2+ books; Reyes positioning (cutoff ~29 Dec) + gift card; "Pedir a los abuelos" WhatsApp payment link; AMPA/school class orders; 3 real orders for photos.
