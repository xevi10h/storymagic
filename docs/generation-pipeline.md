# AI Book Generation Pipeline — architecture, models, costs, status

> Authoritative doc for how Meapica generates books. Last major work: 2026-06-15.
> Read this first when resuming work on generation, illustrations, cost, or quality.

## The two-speed architecture (the core decision)

Preview and final book have **opposite incentives**, so they use **different models**:

| | PREVIEW (pre-purchase) | FINAL BOOK (post-purchase) |
|---|---|---|
| Goal | Convert (don't lose the user) | Perfection |
| Optimise for | Speed + low cost | Max quality / consistency |
| Who pays | You, for **everyone** (most don't buy) | The customer |
| Model | **fal FLUX.2 [dev]** (fast, cheap, "wow" taster) | **flux-2-flex** (premium, via fal `/edit` or BFL) |
| Generated | architect + protagonist ref + 3 scenes + cover | full visual bible + screenplay + **all 12 scenes** + QA loop |
| When | synchronously, user waiting | background, then **email when ready** |

**Economic rationale:** at ~10% conversion, a $1.45 preview = ~$14.5 CAC/sale; a $0.24 preview = ~$2.4. The expensive model must only touch paying customers. In two-speed mode `/complete` **regenerates ALL 12 scenes** at premium quality (the preview scenes were a cheap taster) so the delivered book is uniform.

### Implementation (DONE, commits `ea574ef`, `1d7656a`, `a883d60`)
- `generateFlux2(prompt, opts)` accepts per-call `{ provider, falModel, scale }` (defaults to env).
- `generateReferenceImages` / `generateIllustrationsWithFlux` thread an `imageModel`.
- `/generate` (preview) reads `PREVIEW_IMAGE_PROVIDER` / `PREVIEW_FAL_MODEL`.
- `/complete` (final) reads `FINAL_IMAGE_PROVIDER` / `FINAL_FAL_MODEL` / `FINAL_IMAGE_SCALE`; regenerates all 12 when `PREVIEW_IMAGE_PROVIDER` is set (two-speed active).
- `flux2.ts` routes `fal-ai/flux-2-flex` to the `/edit` endpoint when reference images are passed (pro/dev accept refs on the base endpoint).
- Defaults unchanged when the per-stage env vars are unset (safe).

### Env config for two-speed (set in .env.local / prod)
```
ILLUSTRATION_PROVIDER=flux        # use the FLUX path (not Recraft)
PREVIEW_IMAGE_PROVIDER=fal
PREVIEW_FAL_MODEL=fal-ai/flux-2   # dev — fast/cheap preview
FINAL_IMAGE_PROVIDER=fal          # or bfl
FINAL_FAL_MODEL=fal-ai/flux-2-flex
FINAL_IMAGE_SCALE=1.75            # higher print resolution for the final
```

## Models — MEASURED (2026-06-15)

Per-image, 1024², with reference conditioning. Speed = wall-clock per image.

| Model (provider) | $/img | speed | consistency | style | notes |
|---|---|---|---|---|---|
| **BFL flux-2-flex** | **$0.10–0.188** (measured, w/ refs) | 35s | ✅ best | premium watercolor | the original; expensive + slow |
| **fal flux-2-flex** (`/edit`) | ~$0.05/MP | 31s | ✅ best (same model) | identical to BFL | same model, cheaper, slight speed gain |
| **fal flux-2-pro** | ~$0.06 | 14s | ✅ very good | dreamy watercolor | 3× cheaper, 2.5× faster than BFL |
| **fal flux-2 (dev)** | ~$0.024 | **3.3s** | good (w/ good ref) | slightly flatter | 8× cheaper, 10× faster — preview engine |
| **nano-banana** (fal) | $0.039 | 14s | ✅ best face-lock | polished/less-watercolor | strong but off-brand style |
| fal Seedream4 / FLUX.1 Kontext | $0.03 / $0.04 | — | good | varies | also tested |

**Key learnings:**
- BFL flux-2-flex and fal flux-2-flex are the **SAME model** — fal is just cheaper/faster. pro/dev are *different* models (different look).
- FLUX.2 **bills input reference images too** → multi-ref scenes cost ~2× a no-ref image (BFL $0.10 → $0.188 with 3 refs).
- Path-art (decorative thumbnails, no character) all use **fal flux-2 dev $0.012/MP** (see `reference_image_gen_costs` memory). 390/390 done, ~$4.68 total.
- `flux2.ts` comment "$0.01/img" was stale ~10×; corrected to measured values.
- 1 BFL credit = $0.01. fal billing has no public API (check fal.ai/dashboard/usage).

## Measured end-to-end cost & time (real app run, 2026-06-15)

| Stage | Model | Time | Cost | Result |
|---|---|---|---|---|
| Preview | fal dev | **184s** ⚠️ | ~$0.24 | works, but LLM-bound (not 15-20s yet) |
| Final book | fal flux-2-flex | 875s (background) | ~$2 | **12/12 premium, consistent, beautiful PDF** |

PDF render itself ≈ free (pdf-lib/@react-pdf, CPU). The validated PDF: `artifacts/twospeed/book-final.pdf`.

## Pipeline stages & timing (preview, FLUX path)
`/generate`: architect (~24s) → asset extraction (~22s) → **[refs ∥ expansion ∥ screenplay] parallel** (~50-87s, screenplay is the bottleneck) → 3 preview scenes → cover → save.
**The LLM (architect + asset-extraction + screenplay ≈ 100-130s) is the preview bottleneck, NOT the images.** Switching the image model makes it cheaper but not faster.

## Consistency (the "boy in some scenes, girl in others" bug)

**Root cause (diagnosed):** the immutable character descriptor (`buildCharacterReference`: gender + hair + skin + eyes + outfit) was only *suggested* to gpt-4o-mini in the screenplay prompt, which paraphrased it, dropped traits, and flipped gender per scene. The single front-pose reference image (from a face-only avatar) was the only hard anchor — too weak across 12 varied compositions.

**Fix DONE (commit `a883d60`):** `finalizeFluxPrompt` now **force-prepends the byte-identical characterRef + an explicit "SAME child, never change gender, identical face/hair/outfit" lock** to EVERY protagonist scene + cover, reserving its length before truncation. Deterministic, not LLM-trusted. ⚠️ **NOT yet visually validated** (credits ran out) — validate with an A/B (lock on/off) when credits return.

**Still recommended (from the diagnosis, NOT yet done):**
- Generate the protagonist reference as a **multi-pose turnaround** with the **premium** model (it anchors every scene).
- Enforce gender from the `gender` field over the name in story prose (a "Sofía"+boy mismatch leaked feminine pronouns into the text → image drift).
- Unify the descriptor used by the architect (`buildCharacterVisualDescription` is thinner than `buildCharacterReference`).

## Resolution
`FINAL_IMAGE_SCALE` multiplies scene dims (snapped /32, clamped 512–2048) so the final renders at print resolution (~1792-2048px). Preview stays low-res for speed/cost. ⚠️ Not yet validated at scale (credits).

## Status summary
- ✅ Two-speed model split — implemented + wired in the app.
- ✅ Final book quality — validated (beautiful, consistent PDF) before the consistency lock; lock should make it even tighter.
- ✅ Consistency lock + resolution scale — implemented, **pending visual validation**.
- ⏳ **Preview ≤ 15-20s — NOT done.** Needs decoupling the heavy LLM from the preview: a LIGHT "preview architect" (title + 3 hero prompts only) + defer the full screenplay/visual-bible to `/complete`. Images already proven at ~7s (fal dev). This is the next build.
- ⏳ **Background generation + "book ready" email** — designed, not built. The final should run async post-purchase (tie into the fulfillment cron) and email the customer on completion.
- 🔴 **BLOCKER: both BFL and fal image credits are exhausted.** Top up ~$15-20 (fal recommended) to validate + finish.
