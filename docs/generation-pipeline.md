# AI Book Generation Pipeline — architecture, models, costs, status

> Authoritative doc for how Meapica generates books. Last major work: 2026-09-27 (OpenAI image engine).
> Read this first when resuming work on generation, illustrations, cost, or quality.

## Image engine: OpenAI gpt-image-2.5 only (2026-09-27)

Owner decision after the 2026-09 bake-off (`artifacts/model-bakeoff-2026-09/`): **OpenAI only**. FLUX (BFL / fal), Recraft and the Gemini QA judge were removed (`flux2.ts`, `flux-kontext.ts`, `illustrations.ts` deleted).

| Stage | Model · quality | Sizes (multiples of 16) | Who pays |
|---|---|---|---|
| **Avatar portrait** (character creation) | `gpt-image-2.5-flare` · medium | 1024² | everyone |
| **Preview** (pre-purchase) | `gpt-image-2.5-flare` · medium | sheet 1536×1024 · square 1024² · split 1296×1008 · panorama 2048×1024 · cover 1248×1360 | everyone |
| **Final book** (post-purchase) | `gpt-image-2.5-sunburst` · high | sheet 2400×1600 · square **2432²** (297 dpi) · split **2432×1904** (297 dpi, same 1.28:1 as the print band) · panorama **3840×1920** (~234 dpi, soft-dpi warning only) · cover **2672×2912** (300 dpi on the hardcover front art box 226×246 mm incl. wrap; ~334 dpi softcover) | the customer |

API facts (official docs + live calls): `/v1/images/edits` multipart with up to 16 `image[]` refs, `/v1/images/generations` without refs; sizes ≤ 3840/edge, 655,360–8,294,400 px, aspect 1:3–3:1; always base64 output; `input_fidelity` is rejected on 2.x (never sent); `output_format=jpeg`, `output_compression=95` (higher = better). Pricing both models: $5 / 1M text in, $8 / 1M image in, $30 / 1M out — cost is logged per call from `usage`. The account is **tier 3** (50 images/min, 800k TPM; the images endpoint sends no `x-ratelimit-*` headers, tier read from the chat endpoint): the client caps in-flight calls per process (`OPENAI_IMAGE_CONCURRENCY`=14, a book is ~14 calls), per-attempt timeout 240 s, retries 429/5xx/timeouts with backoff honouring `Retry-After`.

### Consistency recipe (ported 1:1 from the bake-off)
1. **Immutable Character Bible** (`src/lib/ai/character-description.ts`): the UI fields → ONE canonical English string, e.g. *"a 5-year-old girl with warm golden olive-tan skin, shoulder-length springy dark-brown curls, warm chestnut-brown eyes, round rosy cheeks and a sprinkle of freckles across her nose; wearing a plain mustard-yellow hooded jacket worn open over a white-and-navy striped t-shirt, navy trousers and white canvas sneakers"*. Gender only from the `gender` field; the name is never a visual cue (prompts say THE CHILD); one outfit for avatar + sheet + scenes (jacket colour = the child's favourite colour, no pink/blue-by-gender); no ethnicity-by-country strings. The same bytes feed the story LLM (`buildCharacterVisualDescription`). Glasses/freckles are supported (`extraTraits`) but the UI does not collect them yet.
2. **Character sheet(s)** per stage (`renderSheets`): top row front / ¾ / profile / back, bottom row 3 expressions + front/side of the 2 most recurring companions; off-white paper, no labels. Recurring characters 3–5 get an extra sheet. Refs for the sheet: the approved avatar (face anchor) only. The child's photo never reaches the preview/final sheets (see "Child photo" below). The preview sheet uses the preview model; the final run renders its own sheet with the final model (preview refs are never reused).
3. **Deterministic prompts** (`src/lib/ai/image-prompts.ts`), no length cap: reference-role preamble → identity lock ("same N-year-old girl, never change gender") → "do not copy the sheet layout" → negative cast ("PIP is NOT in this scene"; "each exactly once") → SCENE (camera, action, setting, light; scale sentence for wide shots; fold rule for panoramas: faces out of the middle fifth) → descriptions of present characters only → style (`src/lib/ai/style.ts`, incl. "slightly desaturated"). Shots are structured fields from the Book Plan (`book-plan.ts` → `planToShotList`); no LLM writes an image prompt.
4. **Final run re-renders the cover** at print size.
5. **All scenes in parallel**, each conditioned only on the sheet(s) — no chaining, never the photo.
6. **QA** (`src/lib/ai/qa-judge.ts`, OpenAI vision `QA_JUDGE_MODEL`=gpt-5.4-mini, same key): one call per scene with the sheet + image + page text + who must/must not be in frame; hard fails (text in image, duplicated/wrong character, sheet layout copied) or score < 7 / consistency < 8 → **repair by editing** (`repairShot`: refs = failing image + sheet, one fix instruction), max 2 passes, only repaired scenes re-judged.

### Flow
- **Portrait** `POST /api/characters/portrait` → `renderPortrait(bible, photo?)` → `portraits/{uuid}/portrait-{v}.jpg` (outage breaker → 503 `provider_unavailable`). Optional `photoPath` (private `child-photos` bucket) → deleted right after (see "Child photo").
- **Preview** `POST /api/stories/[id]/generate` → `generateArchitect` (Book Plan, one LLM call) → `generatePreviewBook` (`src/lib/ai/preview-book.ts`): preview sheet → scenes 1–3 + cover in parallel → saves `generated_text.imagePlan` (frozen Bible + cast + world + shots + avatar URL) and `generated_text.imageAssets.preview`. A failed single scene stays `pending`; an outage → 503.
- **Final** `POST /api/stories/[id]/complete` → `advanceStoryFulfilment` → `advanceFinalImages` (see below). Stories previewed by the removed engines (no `imagePlan`) fail fulfilment with a clear error and must be re-previewed.

### Env (all optional — defaults shown)
```
PREVIEW_IMAGE_MODEL=gpt-image-2.5-flare     PREVIEW_IMAGE_QUALITY=medium
FINAL_IMAGE_MODEL=gpt-image-2.5-sunburst    FINAL_IMAGE_QUALITY=high
PORTRAIT_IMAGE_MODEL=gpt-image-2.5-flare    PORTRAIT_IMAGE_QUALITY=medium
PREVIEW_IMAGE_PROVIDER / FINAL_IMAGE_PROVIDER = openai (any other value logs a warning and uses openai)
OPENAI_IMAGE_CONCURRENCY=14  OPENAI_IMAGE_TIMEOUT_MS=240000  OPENAI_IMAGE_MAX_ATTEMPTS=3
QA_JUDGE_MODEL=gpt-5.4-mini
```
**Vercel production:** remove `BFL_API_KEY`, `FAL_KEY`, `RECRAFT_API_TOKEN`, `RECRAFT_PORTRAIT_STYLE_ID`, `ILLUSTRATION_PROVIDER`, `PREVIEW_FAL_MODEL`, `FINAL_FAL_MODEL`, `GEMINI_API_KEY` (unused now), and remove or set to `openai` `PREVIEW_IMAGE_PROVIDER` / `FINAL_IMAGE_PROVIDER` (currently `fal`). Keep `OPENAI_API_KEY`. Nothing new is required.

### Measured (2026-09-27, `scripts/generate-test-book.mts`, 2 books)
| | Martina (girl 5, curls, freckles, fox + dragon, es) | Leo (boy 8, glasses, robot, ca) |
|---|---|---|
| Portrait | $0.014 · 12 s | $0.014 · 12 s |
| Preview images (sheet + extra sheet + 3 scenes + cover) | $0.178 · 33 s (+ Book Plan LLM 86 s, $0.056) | $0.131 · 40 s (+ Book Plan 85 s, $0.225) |
| Final images (2 sheets / 1 sheet + 12 scenes + cover) | **$1.89 · ~105 s** | **$1.78 · 100 s** |
| QA judge (12 scenes) | 7 s, 8.8/10, 0 repairs | 8 s, 8.7/10, 0 repairs |
| Print gate | hard + soft: 0 errors (warnings: panoramas 234 dpi, back cover 251 dpi) | same |

Per final image: square 2432² $0.15–0.16 / 55–65 s · split 2432×1904 $0.11–0.12 / 50 s · panorama 3840×1920 $0.10–0.11 / 44 s · cover $0.17 / 59 s · sheet $0.07–0.08 / 30–36 s · repair edit $0.16 / 56 s. Validation outputs (PDFs, contact sheets, QA verdicts): `artifacts/engine-validation/{martina,leo}/`.

Known gaps: the panorama's 234 dpi is the model's width limit (3840) → a light upscale would reach 300; watercolor still reads slightly digital; minor detail drift (curl density, jacket texture); the QA judge sees only the main sheet (extra-sheet characters are judged from text).

## Child photo (behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED`, default off) — 2026-09-27

Owner decision: the photo is used ONLY for the avatar portrait and the early child character sheet, then deleted. Preview and final book are built only from the avatar + generated sheets. Enable the flag only after the DPIA (EIPD) and the OpenAI DPA are signed.

- **Upload** `POST /api/characters/photo` (multipart: `photo`, `consent=true`, `consentVersion=PHOTO_CONSENT_VERSION`, `locale`) → consent checked first → sharp re-encode (auto-orient, ≤1536 px, JPEG q90, ALL metadata stripped incl. EXIF/GPS/ICC; JPEG/PNG/WebP only, HEIC is not decodable by sharp's prebuilt libvips) → private bucket `child-photos/{userId}/{uuid}.jpg` + `photo_consents` row → `{ photoPath }`. Max 4 MB (Vercel's 4.5 MB body limit: the UI must downscale client-side). Rate limit `upload_photo` 10/h/user + 30/h/IP.
- **Portrait** `POST /api/characters/portrait` accepts `photoPath` (+ optional `keepPhotoForSheet`). The route checks ownership + an open consent row, downloads the BYTES with the service role (no URL, signed or public, is ever created) and passes them to OpenAI as the `photo` reference. After the portrait is stored it calls `deleteChildPhoto` unless `keepPhotoForSheet=true` (then the early child sheet step must call it). A failed generation keeps the photo for a retry (the purge still applies). 410 `photo_unavailable` = already deleted → re-upload.
- **Engine contract:** `CharacterBible` has no photo field (it is persisted in `generated_text.imagePlan`); `SheetRefs` has no photo, so scenes/cover/repairs never see it; `renderSheets(plan, stage, { avatar, photo? })` accepts a photo only for the early child sheet — `preview-book.ts` and `final-book.ts` never pass one. `renderPortrait(bible, photo, opts)` unchanged.
- **Deletion:** `deleteChildPhoto(photoPath, userId, admin?) → Promise<{ ok }>` in `src/lib/privacy/child-photo.ts` — idempotent, never throws, ownership-checked, sets `photo_consents.deleted_at`. `DELETE /api/characters/photo { photoPath }` = consent withdrawal (works even with the flag off).
- **Purge:** `GET /api/cron/purge-photos` hourly (`17 * * * *`, `CRON_SECRET`): every `child-photos` object older than 24 h (via RPC `list_expired_child_photos`, orphans included) + every open consent row older than 24 h → removed, `deleted_at` set. Logs counts/ids only.
- **Logging rule:** photo bytes, URLs and request bodies are never logged or emailed (the portrait route logs only `error.message`). No Sentry/analytics in the project.
- Check: `node --experimental-strip-types src/lib/privacy/child-photo.check.mjs`. DB: `supabase/migrations/20260927140000_child_photos.sql`.

## Final-book execution — resumable pipeline (2026-09-27)

`/complete` measured 875 s against a 300 s function limit; the cron then re-ran it from scratch and two-speed mode regenerated all 12 premium scenes every time ($50–90/order, never delivered). Replaced by `src/lib/fulfilment/pipeline.ts` (`advanceStoryFulfilment`), called by `POST /api/stories/[id]/complete`:

- **One run = ≤ ~270 s of work**, then it returns (200 ready / 202 processing). The cron (`/api/cron/fulfill-orders`, every 5 min) invokes `/complete` for each unfinished paid story in parallel (one function per story) until done. Typical book: 2–4 runs.
- **Lease:** conditional UPDATE on `stories.completion_lease_until` (330 s > maxDuration). No two runs on one story. A killed run can't release it; the lease expires and the next run resumes.
- **Images:** `advanceFinalImages` (`src/lib/ai/final-book.ts`) through a checkpoint store: final sheet(s) saved in `generated_text.imageAssets.final` → 12 scenes + print cover in parallel, each saved as soon as it is stored (`story_illustrations.render_stage = 'final:openai:<model>'`, cover in `stories.cover_image_url` + `imageAssets.finalCover`). Scenes with a final render_stage are never re-rendered; preview rows have NULL. No sheet starts with < 150 s left, no scene with < 130 s. A failed scene never stops the others (one in-run retry, then the next run).
- **QA:** judge + repair passes are checkpointed (`stories.final_qa_pass`, `final_qa_done_at`), then `status='ready'` + `final_generated_at` + "book ready" email. A skipped QA alerts the operator (`qa-skipped:<storyId>`). (The old final "portrait" step was removed: print passes `portraitUrl: null`.)
- **Measured:** a whole book (sheet + 12 scenes + cover + QA) fits in ONE 270 s run: ~100–110 s wall.
- **Print + Gelato are separate idempotent steps per order:** source gate → `renderPrintFiles()` (with `validatePrintableBook`) → per-order print files → Gelato claim/search/create/record (no duplicate Gelato orders) → retries with backoff, operator alerts.
- **Provider errors:** the OpenAI client throws `ProviderUnavailableError` (`src/lib/fulfilment/provider-errors.ts`) on 401/403 (auth), 402 / `insufficient_quota` / `billing_hard_limit_reached` (out of credits), missing `OPENAI_API_KEY` (misconfigured): the run stops before new paid calls, retries in 15 min, operator alerted max once/hour (`OPS_ALERT_EMAIL`, fallback `GELATO_OWNER_EMAIL`). There is no silent mock fallback anywhere: mock images exist only with `MOCK_MODE=true` (local dev).
- **Versioned storage paths:** every image is uploaded to a NEW path (`{storyId}/{preview|final}/{name}-{version}.jpg`, `upsert: false`), so the CDN can never serve a stale image. Provider output is always base64 → our storage; no provider URL is ever stored.
- DB: migration `supabase/migrations/20260927120000_resumable_fulfilment.sql`.

## History (pre-2026-09-27, FLUX / Recraft — removed)

The June 2026 FLUX.2 two-speed setup (fal dev preview, flux-2-flex final, visual-bible refs, 1000-char prompt cap), its measured costs and the "boy in some scenes, girl in others" diagnosis are kept in git history (this file before 2026-09-27). Root causes of the gender/identity drift — LLM paraphrasing the descriptor, gender inferred from the name, avatar outfit ≠ scene outfit, single front ref, truncated prompts — are all addressed structurally by the recipe above.

## Story text — Book Plan (2026-09-27)
- `src/lib/ai/book-plan.ts`: ONE strict-`json_schema` call writes the whole manuscript in the target locale + cast/world + a structured shot per scene + cover shot. Text and images come from the same object (`planToShotList`, `planToVisualCast`, `planToGeneratedStory`).
- Model: `OPENAI_BOOK_PLAN_MODEL` (default `gpt-5.5`, `OPENAI_BOOK_PLAN_REASONING=low`); repair model defaults to the same. Chosen over gpt-6-astra (slower, pricier) and gpt-6-sol (meaning slips in Catalan). Claude Sonnet 5 recommended if an Anthropic key is ever added.
- Plan mode by age: `refrain` (2–4, verbatim read-aloud line ≥5 slots) · `picture` (5–6) · `chapter` (7–9) · `literary` (10–12).
- Deterministic checks → targeted repair call (≤2 rounds): words/paragraphs per slot, real print fit via `planInteriorPages`, sentence length for young ages, gender agreement vs the `gender` field (es/ca/fr/en), Catalan personal article, refrain present.
- Word bands: 2–4: 20–50 · 5–6: 50–90 · 7–9: 100–150 · 10–12: 150–220 (panoramas 70–110).
- Dedication: the parent's text is never sent to the LLM; copied byte-for-byte.
- Measured: 35–90 s, $0.10–0.22/book; cover + scene-1 shots available after ~11–18 s via streaming `onProgress` (teaser hook for the future <20 s preview).
- The old architect/expansion/editorial-review calls are gone (the review was a no-op: object vs `Array.isArray`).
