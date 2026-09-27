# meapica — Documentation Index

> Living documentation for the meapica project.
> Last updated: 2026-09-27
>
> **Latest:** full audit + overhaul 2026-09-27 — see [`audit-2026-09-27.md`](./audit-2026-09-27.md).

> **▶ Resuming work? Read these two first:**
> - [`launch-checklist.md`](./launch-checklist.md) — current state, what's done, what's next, blockers (top section is the live session summary).
> - [`generation-pipeline.md`](./generation-pipeline.md) — the AI generation system: two-speed architecture, model choices + measured costs, consistency, status.

## Documents

| Document | Description |
|----------|-------------|
| [Launch Checklist](./launch-checklist.md) | **Live state tracker** — done / pending / blockers, prioritized for launch |
| [Generation Pipeline](./generation-pipeline.md) | **AI book generation** — two-speed architecture, models, costs, consistency, status |
| [Product Vision](./product-vision.md) | What we're building, who it's for, positioning and value proposition |
| [Product Spec](./product-spec.md) | Book format, templates, personalization variables, story structure |
| [User Experience](./user-experience.md) | Complete user flow, screen-by-screen spec, Stitch design references |
| [Technical Architecture](./technical-architecture.md) | Stack, infrastructure, APIs, data model, automation flow |
| [Business Model](./business-model.md) | Pricing, costs, margins, upsells, revenue projections |
| [Marketing Strategy](./marketing-strategy.md) | Channels, copy, calendar, audience segmentation |
| [Influencer Shortlist](./influencer-shortlist.md) | Potential creator partners, outreach tiers, and partner evaluation criteria |
| [Influencer Outreach Messages](./influencer-outreach-messages.md) | Ready-to-send email and Instagram DM templates for shortlisted creators |
| [Roadmap](./roadmap.md) | Phased execution plan with milestones and priorities |

## Quick Context

**meapica** is a platform where parents create personalized, illustrated children's books with AI + print-on-demand. The child becomes the protagonist of their own adventure. Positioned as "artesanal digital" — handcrafted feel, not AI-generated aesthetic.

**Stack:** Next.js 16 + Supabase + Vercel + Stripe + OpenAI only: gpt-5.5 Book Plan (story) + gpt-image-2.5 (flare preview / sunburst final, print res) + gpt-5.4-mini QA judge + Gelato API

**Status:** Phases 0–3 complete. **Creation flow v2 (2026-09-27)**: 6 screens — Nombre (live cover) → Protagonista (avatar / photo) → Aventura (world + 3 branching chapters) → Dedicatoria while the preview is painted → Su libro (checklist) → Formato + pago; see [`creation-flow-v2.md`](./creation-flow-v2.md). **10 branching story templates**, the **FLUX.2 illustration migration** (visual-bible engine + watercolor portrait identity), and **programmatic SEO + editorial blog** live. Phase 4 (checkout/Gelato) in progress. Phase 5 (launch) unstarted.

**Current focus (2026-06-15):** generation cost/quality + the **two-speed pipeline** (fast cheap preview, premium final book generated in the background) — all 390 path-art images done, fulfilment safety-net cron added, per-scene character-consistency lock + per-stage resolution implemented. **Next:** preview ≤15-20s, validate the consistency fix, background-gen + email. **Blocker:** image credits exhausted (BFL + fal) — top up to continue. See `generation-pipeline.md` + `launch-checklist.md`.
