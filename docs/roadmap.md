# Roadmap

## Overview

The roadmap is divided into 6 phases, from foundation to scale. Each phase has clear deliverables and a "done when" criteria. We prioritize speed to first real sale over perfection.

---

## Phase 0: Foundation (Current)
> **Status: COMPLETE**

**What we did:**
- [x] Define product vision and positioning ("artesanal digital")
- [x] Define book format, templates, personalization variables
- [x] Define pricing and business model
- [x] Define tech stack (Next.js + Supabase + Vercel + Stripe + Claude + Flux + Gelato)
- [x] Design UI screens in Stitch (landing + 7-step Story Builder flow)
- [x] Create project documentation

**Done when:** All strategy docs are written and design is in Stitch. ✅

---

## Phase 1: Project Setup & Landing Page
> **Status: COMPLETE**

**Deliverables:**
- [x] Initialize Next.js project with TypeScript
- [x] Configure Supabase (database, auth)
- [x] Deploy base project to Vercel
- [ ] Register domain (meapica.com or alternative)
- [x] Implement landing page from Stitch design
- [ ] Set up basic SEO (meta tags, Open Graph, structured data)
- [ ] Email capture form (waitlist)
- [ ] Configure analytics (Vercel Analytics or Plausible)

**Key decisions:**
- Domain name final choice
- Auth strategy (Supabase Auth — email + Google?)
- i18n approach (ES first, CA/EN later)

**Done when:** Landing page is live on a real domain, collecting emails.

---

## Phase 2: Story Builder Flow
> **Status: IN PROGRESS** (frontend complete, backend wiring pending)

**Deliverables:**
- [x] Step 1: Mode selection (solo / together)
- [x] Step 2: Character creation form (with saved profiles)
- [x] Step 3: Adventure/template selection
- [x] Step 4 Solo Mode: Narrative configuration with live preview
- [x] Step 4 Together Mode: Interactive illustrated choices
- [x] Step 5: Dedication message + ending selection
- [ ] Step 6: Generation animation (magic loading screen)
- [ ] Step 7: Book preview (page flipper)
- [x] User authentication (Supabase Auth: email + Google OAuth)
- [x] Save story draft to Supabase (character + story + decisions via API route)
- [x] Supabase schema: profiles, characters, stories, story_illustrations, orders, sagas tables

**Key decisions:**
- Step 4: confirm which variants to implement (recommendation: A + C)
- Step count: standardize to 7
- Design missing screens: Steps 6 and 7

**Done when:** A user can go through the entire flow and see a preview of their generated story (even if illustrations are placeholder).

---

## Phase 3: AI Generation Engine
> **Status: IN PROGRESS** (text generation done, images mocked)

**Deliverables:**
- [x] Gemini 3 Flash integration for story text generation (free tier, plain fetch)
- [x] Prompt engineering: master prompt with template themes and narrative arc
- [x] Story output format: 8 scenes × (title + text + image prompt)
- [x] Generation pipeline: text → mock images → save to Supabase
- [x] Step 6 animated generation page with whimsical messages
- [x] Illustration library table (caches images by description hash)
- [ ] Image generation integration (Flux Schnell ~$0.002/img)
- [ ] Character consistency strategy (reference sheets, seed locking)
- [ ] Style guide enforcement in image prompts
- [ ] Quality review: test 20+ full book generations
- [ ] Error handling: retry logic, fallback images, timeout management

**Key decisions:**
- **DECIDED** — Story AI: Gemini 3 Flash (free tier)
- **DECIDED** — Image AI: Flux Schnell (cheapest at ~$0.002/img, mocked for now)
- Character consistency approach for MVP
- Acceptable generation time (target: < 5 min)

**Done when:** We can generate a complete, visually consistent book (text + 12 illustrations) from character data input. Quality is "good enough to print."

---

## Phase 4: Book Production & Checkout
> **Status: NOT STARTED**

**Deliverables:**
- [ ] PDF layout engine (Python + ReportLab or alternative)
- [ ] Layout templates: cover, dedication, scenes, back cover
- [ ] Bleed, margins, spine calculations for Gelato specs
- [ ] CMYK color conversion
- [ ] Gelato API integration: create order, upload PDF, track status
- [ ] Stripe checkout integration
- [ ] Order management (Supabase: orders table)
- [ ] Confirmation emails (order placed, production started, shipped)
- [ ] Tracking number forwarding from Gelato
- [ ] Print 5 test books — validate quality (colors, margins, text readability)
- [ ] Upsell implementation: Pack Aventura, digital PDF, extra copy

**Key decisions:**
- PDF generation: server-side (Python) vs serverless (Node.js library)
- Gelato product configuration (paper weight, binding, cover finish)
- Shipping zones and pricing display

**Done when:** A test order goes through the full pipeline: checkout → generation → PDF → Gelato → physical book in hand. Quality is acceptable.

---

## Phase 5: Launch
> **Status: IN PROGRESS**

**Deliverables:**
- [x] User dashboard: My Books, My Heroes, Order Tracking (`/dashboard`)
- [x] User profile page (`/perfil`) — name editing, password change
- [x] Password recovery flow (`/auth/reset-password` + `/auth/update-password`)
- [x] Route protection for authenticated pages
- [x] Custom 404 page
- [ ] Final QA on the complete flow (20+ test runs)
- [ ] Professional photography of printed books (for landing page and ads)
- [ ] Instagram account setup + 10 initial posts
- [ ] 10 beta sales to family/friends (discounted, for feedback)
- [ ] Collect and address feedback
- [ ] Launch marketing campaign (organic + first paid ads 50-100 EUR)
- [ ] Contact 10 parenting micro-influencers
- [ ] Post in parenting groups/communities
- [ ] Monitor: conversion rate, generation quality, delivery times

**Done when:** 20+ real paying customers. Product-market fit signals (NPS > 50, repeat interest).

---

## Phase 6: Scale & Expand (Month 3+)
> **Status: FUTURE**

**Deliverables:**
- [ ] New story templates (expand from 5 to 10+)
- [ ] Saga system implementation (linear, episodic, progression)
- [ ] English version (USA/UK market)
- [ ] Catalan version
- [ ] Premium adventure packs with Spanish 3PL (Huboo / 3PL Spain)
- [ ] Affiliate/referral program
- [ ] SEO blog (10+ articles)
- [ ] Retargeting campaigns
- [ ] B2B channel (schools, events)
- [ ] Gift cards
- [ ] Mobile optimization / PWA

---

## Priority Decisions Queue

These decisions need to be made before or during implementation:

| # | Decision | Impact | When Needed | Status |
|---|----------|--------|-------------|--------|
| 1 | Domain name | Branding | Phase 1 | PENDING — decide later, not a blocker |
| 2 | Step 4 variants | Dev scope | Phase 2 | **DECIDED** — Variant A (interactive illustrated choices) for "Juntos" mode + Variant C (narrative config with live preview) for "Solo" mode |
| 3 | Auth method (email + social) | UX flow | Phase 2 | **DECIDED** — Supabase Auth (email + Google OAuth) |
| 4 | Image AI provider | Quality + cost | Phase 3 | **DECIDED** — DALL-E |
| 5 | Character consistency approach | Quality | Phase 3 | PENDING |
| 6 | PDF engine | Architecture | Phase 4 | **DECIDED** — Node.js (keeps full stack in one language) |
| 7 | Gelato product specs | Print quality | Phase 4 | PENDING |
| 8 | i18n strategy | Market reach | Phase 5-6 | PENDING |

---

## Current Focus

**Next action:** Phase 2 — Implement auth, connect creation flow to Supabase, build Steps 6-7.
