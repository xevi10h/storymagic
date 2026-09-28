# Launch Readiness Checklist

> ## 💳 2026-09-28 — commerce block A (Stripe) — status
> Code + test-mode E2E done (see `docs/stack.md` → Payments). **Blocker for real sales:** the new
> Meapica live Stripe account must be activated by the owner; then run the go-live runbook in
> `docs/stack.md`. Until that deploy, prod keeps the OLD checkout on the Constrack account.

> ## 🧭 RESUME HERE — session summary 2026-07-20
> **Full web audit + Sprint 1 fixes shipped.** See **`docs/web-audit-2026-07-20.md`**
> for the complete audit (perf/QA/SEO findings, Sprint 2/3 backlog).
>
> **Shipped 2026-07-20 (commits e6ee54f…ee23c0c, deployed + verified in prod):**
> - Pushed the 13 pending commits from 2026-06-15; two-speed FLUX env config
>   added to prod (BFL/FAL keys + PREVIEW/FINAL provider vars) + redeployed.
> - **11 prod env vars had trailing newlines** (Supabase URL/keys, all Stripe
>   keys, OpenAI/Gemini/Groq/Recraft) — sanitized. This was the root cause of
>   `\n`-poisoned illustration URLs: **497 DB rows cleaned**, storage.ts trims.
> - Domain flip: apex `meapica.com` now primary, www → 308 (SEO signals aligned).
> - Showcase viewer i18n fixed (13 keys ×4 locales); sitemap 228→116 (empty-shell
>   ejemplo pages out + noindex); functions → fra1; portrait endpoint
>   rate-limited (session + 10/h user + 30/h IP); legal identity + footer contact.
>
> **Open / next (priority order):**
> 1. 🔴 **BLOCKER: fal + BFL credits exhausted** (BFL $0.15) — top up before any
>    generation. Prod now runs the FLUX pipeline, so book creation FAILS until
>    top-up.
> 2. **NIF pending** for the Aviso Legal (user to provide; identity published
>    without it).
> 3. **Resend DNS for meapica.com** — 3 records to add in Spaceship (see 2026-06
>    notes below), then verify + set EMAIL_FROM.
> 4. **Sprint 2 (performance)** then **Sprint 3 (conversion/SEO)** —
>    `docs/web-audit-2026-07-20.md`.
> 5. Gelato webhook registration check (dashboard-only, no API) + real e2e order.
>
> ---
>
> ## Previous session — 2026-06-15
> A long working session focused on **AI generation cost, quality, and the two-speed
> architecture**. Full detail: **`docs/generation-pipeline.md`** (read it first).
>
> **Shipped this session (committed):**
> - El Camino UI: serpentine adventure-path builder, clickable header stepper (jump
>   between unlocked steps), mobile = desktop stepper, compact mobile dedication. (`5ebc2f1`)
> - **All 390 path-art card images generated** via fal FLUX.2 dev (~$4.68), uniform,
>   with per-image provenance in `src/lib/story-trees/art-provenance.json`. (`c3f0388`, `02e2e66`)
> - **Fulfilment safety-net cron** `/api/cron/fulfill-orders` so paid orders reach
>   Gelato even if the browser tab closes. (`a0fad04`) + STRIPE_ENVIRONMENT trim fix.
> - **Generation pipeline overhaul:** preview timeout false-error fix, cover anchored
>   to all char refs, protagonist-ref safeguard, QA-skipped surfaced, parallelized
>   screenplay, 3-scene preview, **two-speed model split** (preview=fal dev / final=
>   flux-2-flex), **per-scene character lock** (fixes "boy→girl" drift), **per-stage
>   resolution scale**. (`86ce1d7`, `a51d0a1`, `ea574ef`, `1d7656a`, `a883d60`)
> - Measured all model costs + ran a full real book end-to-end → validated PDF
>   (`artifacts/twospeed/book-final.pdf`).
>
> **Open / next (priority order):**
> 1. 🔴 **BLOCKER: BFL + fal image credits both exhausted** — top up ~$15-20 (fal
>    recommended) before any generation work.
> 2. ⏳ **Preview ≤ 15-20s** — decouple the heavy LLM (light "preview architect" +
>    defer full screenplay/bible to /complete). Images already ~7s on fal dev.
> 3. ⏳ **Validate** the character-lock + high-res fixes with a fresh book (needs credits).
> 4. ⏳ **Background final generation + "book ready" email** (tie into the cron).
> 5. The P0/P1 launch items below (deploy, go-live envs, Resend domain, real order test).
>
> ---
>
> ## Progress update — 2026-06-14
>
> **Resolved in code (commit `a0fad04`):**
> - **P0-1 ✅ Server-side fulfilment** — added `GET /api/cron/fulfill-orders` (`vercel.json`, every 5 min). Sweeps paid-but-uncompleted orders and re-triggers `/complete` server-to-server (idempotent guest path). `CRON_SECRET` already set in Vercel prod. *Active once deployed to prod.*
> - **P0-2 ✅ (code) Draft-gating footgun** — `gelato/orders.ts` now `.trim()`s `STRIPE_ENVIRONMENT`. (Prod value is literally `"test\n"` — the trailing newline is real; the trim prevents a `"live\n"` from silently producing draft-only orders.)
> - **P0-3 ✅ DONE — all 390 path images generated, fully uniform.** All via **fal FLUX.2 [dev]** ($0.012/MP, rich watercolor). 270 missing first (~$3.24), then the original 120 BFL regenerated on fal for full style uniformity (~$1.44) → **390/390 fal, total ≈ $4.68, 0 failures** (2026-06-15). Provenance in `src/lib/story-trees/art-provenance.json`. fal schnell was rejected (flat/white-bg look).
>
> **Prod-config findings (from `vercel env` + Resend) — need YOUR action:**
> - 🔴 **`STRIPE_ENVIRONMENT="test\n"`** → prod is in Stripe TEST mode; no real payments, and Gelato orders are drafts. Flip to `live` (+ live Stripe keys) at go-live.
> - 🔴 **FLUX.2 is NOT active in prod** — `BFL_API_KEY` and `ILLUSTRATION_PROVIDER` are **missing** in prod → the generator falls back to the **Recraft** pipeline (RECRAFT_API_TOKEN is set). To run the FLUX.2 visual-bible pipeline in prod, set `ILLUSTRATION_PROVIDER=flux2` + `BFL_API_KEY` (with credits). Otherwise prod ships Recraft illustrations.
> - 🟠 **`GELATO_FULFILLMENT_MODE="owner"`** — every book ships to the owner's address (phase-1 manual repackaging). Set `direct` to ship to customers.
> - 🔴 **Resend `meapica.com` = verification FAILED** — can't send from meapica.com; emails currently send from `constrack.pro` (verified). Fix the DNS records + re-verify, then set `EMAIL_FROM` to a meapica.com address.
> - ✅ Set: `RESEND_API_KEY`, `GELATO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `RECRAFT_API_TOKEN`, `CRON_SECRET` (added today).
>
> **Cost model (live 2026 prices) — see "Unit costs" section at the bottom.**

---

> Created 2026-06-13. Living document — check items off as they ship.
> Audited against code by three review passes (fulfilment, illustration cost, docs).
> Severity: **P0** = blocks launch · **P1** = must verify before real customers · **P2** = polish.

---

## P0 — Launch blockers

### 1. Order does NOT auto-submit to Gelato (fulfilment can silently fail) ❌
**The single biggest risk.** The Stripe webhook only flips the order to `paid` + sends the confirmation email (`src/app/api/webhooks/stripe/route.ts:134-181`). The actual Gelato print submission lives in `POST /api/stories/[storyId]/complete` (`complete/route.ts:445-448,629`), which is **triggered client-side from the checkout success page** (`checkout/success/page.tsx:72`). Illustration completion can take minutes (`maxDuration=300`).
- **If the customer closes the tab, the book is never sent to print.** Order stays at `paid`, no alert, no retry.
- **Fix:** trigger fulfilment server-side — either fire `/complete` as a background job from the Stripe webhook, or add a cron that sweeps `orders` with `status='paid'` older than N minutes and submits them. Add operator alerting on submission failure (`complete/route.ts:663-667` currently only logs).

### 2. `STRIPE_ENVIRONMENT=live` draft-gating footgun ⚠️→❌
Gelato `orderType` is `"order"` only when `STRIPE_ENVIRONMENT==="live"`, else `"draft"` (`src/lib/gelato/orders.ts:194`). If that env var is unset/misspelled in prod, **every order silently becomes a Gelato draft and is never printed.**
- **Fix:** verify `STRIPE_ENVIRONMENT=live`, `GELATO_PRODUCT_UID_SOFTCOVER/_HARDCOVER`, and `GELATO_FULFILLMENT_MODE` in the prod env before launch. Consider failing loudly if misconfigured.

### 3. Missing path-art for 6 themes + pirates (270 images) ❌
Decorative card art for the adventure path. Done: dinosaurs/forest/space (39 each), pirates (3). **Missing: pirates 36 + candy, castle, chef, inventor, safari, superhero (39 each) = 270.** Without it those themes fall back to plain icon tiles (degraded UX).
- **Cost (current pipeline, BFL FLUX.2 `flux-2-flex`):** ~$0.08/img → **270 ≈ $22** (and BFL credits are empty).
- **Recommended: switch the generator to FLUX.1 [schnell] via fal.ai** — same FLUX aesthetic as the shipped trees, keeps the exact watercolor prompt. **270 ≈ $1, ~3–5 min** at concurrency 8.
  - Only `scripts/generate-path-art.mjs` needs editing (self-contained): swap the BFL call for `POST https://fal.run/fal-ai/flux/schnell` (`{prompt, image_size:{width:1408,height:960}, num_inference_steps:4}`), feed `images[0].url` into the existing `sharp` resize. Keep prompt assembly, worker pool, retry, manifest writer as-is.
  - **External action needed:** a `FAL_KEY` in `.env.local` (or re-fund BFL to keep flex).
  - Before a full run, `console.log` the generated prompts for the 7 pending trees — prompts are regex-built from each tree's `en` title/desc; a malformed `desc` silently skips a card.
- Fallback (no new vendor): Recraft V3 is already wired (`src/lib/ai/illustrations.ts`), `child_book` style, **270 × $0.04 = $10.80**.

### 4. Email sender domain not on brand ⚠️
`EMAIL_FROM` defaults to `Meapica <hola@constrack.pro>` (`src/lib/email/send.ts:13`); `meapica.com` DNS not yet verified in Resend (`docs/technical-architecture.md`). Deliverability + branding risk.
- **Fix:** add + verify `meapica.com` domain in Resend, set `EMAIL_FROM` to a meapica.com address.

---

## P1 — Must verify before real customers

### 5. Real end-to-end test of the full flow (user point #3)
Run at least one **real** order per format (softcover + hardcover), all the way through:
`create story → portrait → 12 illustrations → preview → Stripe checkout → Gelato submission → webhook status updates → tracking email → dashboard stepper → delivered`.
- The tracking mechanism itself is **fully built and correct**: dashboard 4-step stepper (`paid→producing→shipped→delivered`, `dashboard/page.tsx:519-674`) fed by `orders.status/tracking_url`; Gelato webhook persists status + tracking and sends localized emails (es/ca/en/fr) on real status transitions, with a duplicate guard (`webhooks/gelato/route.ts`). It only works **if** (a) the order actually submitted to Gelato (see P0-1) and (b) the webhook URL + secret are registered in the Gelato dashboard.
- **Action:** confirm the Gelato webhook is registered in the live Gelato account; place a live test order; watch status flow end-to-end.

### 6b. Real end-to-end generation test (done 2026-06-15)
Generated a full book ("Mariona y el cohete curioso", space) with MOCK off:
- **Algorithm works**: character identity consistent across all 12 scenes; QA judge caught + regenerated a weak scene (8.3→9.0); narrative coherent; 0 console errors.
- **Measured cost**: preview **$1.45 FLUX + ~$0.14 LLM** (the non-buyer burn); complete **$2.20 FLUX**; **full book ≈ $3.9** (higher than estimated — FLUX.2 bills INPUT reference images, so multi-ref scenes ≈ $0.20 each).
- **Latency**: preview 244s + complete 237s ≈ **8 min/book**. Bottlenecks: screenplay LLM 87s, QA judge 124s (2 passes), asset extraction 22s.
- **Fixed (commit 86ce1d7)**: ① preview-timeout false-error (UI showed "Algo no ha ido bien" though the book was fine — STUCK timeout 180s < 244s gen; raised to 480s); ② cover now anchors all character refs (was 2); ③ protagonist-ref failure now aborts instead of shipping an inconsistent book.
- **All 11 next steps now resolved** (decisions made, not deferred):
  - ✅ Implemented: timeout false-error, cover all-refs, protagonist-ref safeguard, QA-skipped surfaced (commits 86ce1d7 + qa fix).
  - ✅ Decided NO-CHANGE (quality-first on a €34.90 product): cap refs-per-scene (refs ARE the consistency the product sells); lower scene resolution (1024px is already at/below 300 dpi print needs — reducing hurts PRINT); cap MAX_ASSETS (it's a ceiling the LLM already stays under — 7/10 in the test); defer refs until payment (architectural — refs are needed for the preview scenes too).
  - ✅ Resolved as non-issue: "duplicate" portrait is actually the 3:4 book-portrait page (kept).
  - 🔧 Scoped follow-up (perf only, non-blocking — timeout bug already fixed): the 87s screenplay LLM call could start in parallel with ref-image generation (saves ~20s); a deeper win needs profiling that gpt-4o-mini call. Latency, not quality.

### 6. Story-generation quality pass (user point #2)
- Run the existing e2e specs: `e2e/qa-walkthrough.spec.ts`, `e2e/all-trees.spec.ts`, `e2e/flux2-fullbook.spec.ts`, `e2e/branching.spec.ts`, `e2e/depth.spec.ts`.
- Manually review a full 12-scene book for **each of the 10 themes**: protagonist/companion/location/prop consistency (the QA-judge regen loop should hold them), text quality, no leftover placeholders, cover spread correct.
- Verify the per-book illustration economics: at FLUX.2 flex ~$0.08/img the per-book AI cost (~$2.2) **exceeds the €1.50 target** noted elsewhere in the docs — reconcile (cheaper model for some scenes, or adjust the target/price).

### 7. Branching-tree integrity (all 10)
Verify every tree has valid `c1→c2→c3 + ending`, no dangling `option.next`, and prompts parse for art generation. `e2e/all-trees.spec.ts` covers walking them; confirm it passes for all 10.

---

## P2 — Polish

- **8. Docs** — major inconsistencies fixed 2026-06-13 (user-experience flow, roadmap false "SVG avatar done", technical-architecture fictional avatar block + data model, template count 5→10, character fields). Keep in sync going forward.
- **9. e2e TS typing** — 6 `implicitly any` errors on `page` params in e2e specs (test-only, don't affect the Next build). Type them with `import { ..., Page } from "@playwright/test"`.
- **10. Waitlist** — decide launch-open vs gated. Prior decision: drop the waitlist + guest gate and launch open. Not yet applied (still active in prod).
- **11. Idempotency on Gelato submit** — `submitToGelato` re-renders + re-submits on each `/complete` call, relying on story-status gating + Gelato's `orderReferenceId=meapica-${order.id}` rather than an explicit "already submitted" check. Add a guard on `orders.gelato_order_id`.
- **12. `delivered` reliability** — Gelato only emits `delivered` if the carrier reports it; the delivered email/step may not always fire. Acceptable, but note it.

---

## Quick status summary

| Area | State |
|---|---|
| Creation flow (El Camino, 3 steps) | ✅ Built + polished (desktop + mobile) |
| Branching story-trees (10 themes) | ✅ Content present; integrity test pending (P1-7) |
| Path card-art | ⚠️ 120/390 done; 270 missing (P0-3) |
| Story generation (FLUX.2 + QA judge) | ✅ Built; quality pass pending (P1-6) |
| Stripe checkout | ✅ Built |
| Gelato submission | ⚠️ Built but **client-triggered, no server fallback** (P0-1) + draft-gating footgun (P0-2) |
| Order tracking UI | ✅ Built (dashboard stepper) |
| Lifecycle/tracking emails | ✅ Built (es/ca/en/fr), wired to Gelato events; sender domain pending (P0-4) |
| Docs | ✅ Reconciled 2026-06-13 |

---

## Unit costs

> ### ✅ MEASURED — BFL FLUX.2 flex (2026-06-15, from the live API `cost` field + balance)
> **1 BFL credit = $0.01 · $10 top-up = 1000 credits.** Endpoint `GET https://api.bfl.ai/v1/credits` returns the balance.
>
> | Resolution | MP | Cost | $ |
> |---|---|---|---|
> | 1408×960 (current generator setting) | 1.35 | **10 cr** | **$0.10** |
> | 1024×704 | 0.72 | 5 cr | $0.05 |
> | 768×512 | 0.39 | 5 cr | $0.05 |
>
> - Bills **per megapixel**, with a **5-credit ($0.05) floor**. Lowering `steps` does NOT reduce cost.
> - The final path-art asset is downscaled to **720×480** regardless → generating at **768×512 (5 cr / $0.05)** instead of 1408×960 (10 cr / $0.10) **halves the cost with no visible loss** at thumbnail size.
> - **270 path images:** 1408×960 = **$27** · 768×512 = **$13.50**.
> - **Per delivered book** (~24 FLUX.2 images, mixed sizes, mostly ≥0.72 MP ≈ 8–10 cr each): **≈ $2.0–2.4**. Per preview (~12 images): **≈ $1.0–1.2**.
> - These MEASURED numbers supersede the estimates below (which were ~2× low).

> ⚠️ (Original estimate, kept for reference — superseded by measured values above.) The code comment in `flux2.ts` claiming flex = "$0.01/img" was **stale by ~10×**.

### 1. Populating the 270 missing path-art images (1408×960 ≈ 1.35 MP each)
| Provider | Total |
|---|---|
| **BFL FLUX.2 flex** (current) | **$21.87** |
| **fal.ai FLUX.1 schnell** (recommended, ready in the script) | **≈ $1.09** (~$1.62 worst case w/ MP round-up), ~3–5 min |

Schnell is ~13–20× cheaper and visually indistinguishable at thumbnail size → use it.

### 2. Cost per PREVIEW (incurred on EVERY creation attempt, buyer or not)
The preview (`/api/stories/[id]/generate`) generates: ~7–10 reference sheets + 4 preview scenes + 1 cover (FLUX.2) + the LLM story work (gpt-5.4-mini ×~14 + gpt-4o-mini).
- **LLM:** ≈ $0.14 · **FLUX.2 images:** ≈ $0.85 → **≈ $0.99 per preview** (worst case ≈ $1.42).
- This is the **sunk cost of a non-buyer**: every abandoned creation burns ~$0.99 (mostly ref sheets + cover generated *before* payment). Biggest lever to cut burn: defer/trim ref-sheet generation until purchase intent, or drop preview scene count.

### 3. Cost per FULL BOOK delivered (the digital assets behind the PDF / print)
= preview + portrait (1) + remaining 8 scenes + QA-judge Gemini (2–3 calls) + ~2 regen images.
- **≈ $1.82 per book** typical (worst case ≈ $2.99 with a full regen pass).
- **The PDF rendering itself is ≈ free** — `renderBookPdf` + `buildCoverSpreadFromBook` (@react-pdf/renderer + pdf-lib) is pure CPU on a Vercel function (~$0.001–0.003). The "PDF version" adds no image-API cost; it reuses the already-generated illustrations.

### Summary
| Metric | Cost |
|---|---|
| 270 path images — flex / schnell | **$21.87 / ~$1.09** |
| Per preview (typical) | **~$0.99** (non-buyer sunk cost) |
| Per full book delivered (digital assets) | **~$1.82** (PDF render ≈ $0) |
| Marginal buyer-vs-non-buyer | non-buyer $0.99 sunk; buyer adds ~$0.83 → $1.82 total |

> Note: these figures assume the **FLUX.2** pipeline. Prod currently runs **Recraft** (FLUX.2 not enabled in prod — see config findings). Recraft is $0.04/img → a 24-image book ≈ $0.96; recompute if you keep Recraft for prod.
