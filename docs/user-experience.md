# User Experience

## Stitch Project

All UI designs live in Stitch:
**Project ID:** `13399121936555227014`
**URL:** https://stitch.withgoogle.com/projects/13399121936555227014

Design theme: Light mode, custom color `#e96b3a` (warm orange), Plus Jakarta Sans font, fully rounded corners, high saturation.

## Complete User Flow — Creation flow v2 (6 screens, 2026-09-27)

One progress indicator for all six screens (`CreationHeader`, `TOTAL_CREATION_STEPS = 6`): labelled stepper on desktop, "Paso 2 de 6 · Protagonista" + 6-segment bar on mobile. Every Back keeps state (draft in `localStorage` key `meapica_create_state`, schema v2, older drafts migrated by `migrateCreateState`). No gates before the wow: the anonymous session is created silently the first time an API needs a user (`ensureGuestSession`). Full rationale and benchmark: [`creation-flow-v2.md`](./creation-flow-v2.md).

```
Landing Page
  → 1 Nombre          name + age + gender, LIVE COVER updates on every keystroke   [/crear]
  → 2 Protagonista    "Créalo tú" trait grid + sticky portrait (instant, offline)   [/crear]
                      "Sube una foto" tab (flag NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED)
                      → on Seguir: POST /api/characters/prepare (background)
  → 3 Aventura        world + the 3 chapters of its branching tree, one screen    [/crear]
                      → "Crear su libro": POST /api/stories (pre-filled dedication)
  → 4 Dedicatoria     real preview progress (cover → scenes) while the parent      [/crear/{id}/generar]
                      writes the dedication, live on a page mock (autosaved)
  → 5 Su libro        flipbook + checklist chips that edit in place (sheets)       [/crear/{id}/preview]
  → 6 Pedido          format + payment (hardcover preselected, IVA incluido),      [/crear/{id}/preview#checkout-section]
                      optional "Envíame la preview" email after the wow
```

## Screen-by-Screen Specification

---

### Landing Page

**Stitch screen:** `5325a3cce1324a368453343affe3ef20`
**Purpose:** Convert visitors into story creators. Entry links: `/crear`, `/crear?template={id}&from=catalog|seo` (world pre-chosen on screen 3), `/crear?characterId={id}` (dashboard: reuse a saved character).

---

### 1 · Nombre ✅

**Component:** `StepName` + `LiveCover`
- Big name field (any Unicode letters, accents, ñ, l·l, apostrophes, compound names; 50-char cap; never rejected). Age as 1–12 chips (radiogroup). "Es…": Una niña / Un niño / Prefiero no decirlo (only drives feminine/masculine/neutral wording).
- `LiveCover`: square book cover = template art + "La aventura de" + the name, re-rendered client-side on every keystroke (measured < 100 ms in e2e). Name size scales with length (`coverNameFontSize`), never breaks inside a word. Catalan/French elide "de" before vowels (`L'aventura d'Àlex`). Fonts load `latin` + `latin-ext` subsets.

### 2 · Protagonista ✅

**Components:** `StepProtagonist`, `PhotoUploadPanel`, `ProtagonistAvatar` (pre-rendered `WatercolorAvatar`, vector `AvatarSketch` fallback for combinations not rendered yet)
- **Créalo tú** (default): skin, hair colour, hairstyle (mini-avatar thumbnails), eyes, glasses (none/round/square + dark/red frame), freckles. Portrait swaps instantly with zero network; sticky under the header on mobile, sticky column on desktop.
- **Sube una foto** (only when `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED=true`): unchecked parental-consent checkbox gates the picker; the photo is re-encoded client-side to JPEG ≤ 1536 px (drops EXIF, handles HEIC/large phone photos) and posted to `POST /api/characters/photo` (`photo`, `consent`, `consentVersion`, `locale` → `{ photoPath }`). "Quitar la foto" calls `DELETE /api/characters/photo` and resets consent. Server error codes map to `crear.photo.errors.*`.
- On "Siguiente": `POST /api/characters/prepare` fire-and-forget (traits + optional `photoPath`) → `characterPrepId` stored in the draft and sent with the story. Re-sent only when the look changes. A `410 photo_unavailable` clears the photo and asks for a re-upload.
- The old AI portrait screen (`PortraitReveal`) is gone from the flow.

### 3 · Aventura ✅

**Component:** `StepAdventure`
- World picker (10 templates, horizontal scroller on mobile, grid on desktop; "Para su edad" badge from `getRecommendedTemplates`), then chapter 1 → 2 → 3 of the template's branching tree (`story-trees/loaders.ts`, art from `art-manifest.ts`) on the same screen. Each chapter appears after the previous choice and scrolls into view; changing an earlier chapter drops only the choices that no longer follow.
- The cover (sticky on desktop, mini on mobile) switches to the chosen world's art. "Crear su libro" enables once world + 3 chapters are set.
- Creating the story sends the pre-filled dedication (`crear.dedication.default` with the name) so the parent's text is always the verbatim dedication. Back → Create with an unchanged draft reuses the same story (no duplicate book).
- The per-template ending picker was dropped (the LLM closes the story from the chosen path).

### 4 · Dedicatoria (while the preview is painted) ✅

**Route:** `/crear/[storyId]/generar` · **Components:** `LiveCover`, `DedicationEditor`, `useDedicationAutosave`
- Real progress only: polls `GET /api/stories/{id}?light=true` every 3 s and reads the signed `preview_progress { coverUrl?, coverKey?, scenes[{index,url,key}], total }` (images kept while their `key` is unchanged, so polls never swap them). The first image to land dresses the hero: usually scene 1 (with a "painting the cover" badge), then the painted cover the moment `coverUrl` exists; scene thumbnails fill their scene slot as they arrive; the bar is determinate only when `total` is known (indeterminate otherwise), plus an honest elapsed timer. No fake curve.
- Dedication: pre-filled, rendered live on a page mock, 500-char counter, "De parte de"; autosaved (debounced) to `PATCH /api/stories/{id}/dedication`, stored verbatim; mirrored into the draft.
- When ready: "Ver su libro" (no auto-redirect while the parent is typing). Failure state with retry; Back returns to screen 3 with everything kept.

### 5 · Su libro ✅

**Route:** `/crear/[storyId]/preview` · **Component:** `BookChecklist` (+ `Sheet`)
- Flipbook (existing viewer) + Wonderbly-style chips: ✓ Protagonista (look + "Cambiar su aspecto" → back to screen 2, warns the book is repainted), ✓ Dedicatoria (editor sheet, autosave, book updates in place), ○/✓ Portada (title sheet with suggestions; ✓ once reviewed). Sheets = bottom sheet on mobile, dialog on desktop, Esc/backdrop close.
- "Lo quiero" (desktop) / sticky bar (mobile, first tap scrolls to the formats) lead to screen 6.

### 6 · Formato + pago ✅

- Existing paywall: hardcover preselected with the "Ideal para regalar" badge (no popularity claims without sales data), every price with "IVA incluido" next to it, CTA "Pedir el libro de Lucía · 49,90 € IVA incl.". Stripe Checkout; the creation draft is cleared when checkout starts.
- **Envíame la preview** (`SendPreviewEmail` → `POST /api/stories/{id}/send-preview`): optional, after the wow, rate-limited (3/h), address not stored. The link opens the preview on the same browser (anonymous sessions are per-device).

---

### Dashboard ✅ IMPLEMENTED

**Route:** `/dashboard`
**Purpose:** Manage books, orders, and characters.

**Implementation:**
- My Books: list of created/purchased stories with status badges
- My Heroes: saved character profiles
- Authenticated route (redirects to /auth/login if not logged in)

---

### Profile ✅ IMPLEMENTED

**Route:** `/perfil`
**Implementation:** Edit name, change password, account info. Full password reset flow (`/auth/reset-password` + `/auth/update-password`).

---

## Design Decisions — Resolved

| Decision | Resolution |
|----------|------------|
| Creation flow | "El Camino" — 3 steps (Character → Path → Dedication); mode/template/decision-knob screens removed |
| Step count | `TOTAL_STEPS = 3` |
| Adventure UX | Single serpentine gamebook path (`PathBuilder`); template chosen as the path's first fork ("world" beat) |
| Templates | 10 (space/forest/pirates/dinosaurs/superhero/chef/castle/safari/inventor/candy), each with a branching story-tree |
| Character identity | FLUX.2 watercolor portrait (`portraitUrl`, `portraits/` bucket) — no SVG/DiceBear avatar |
| Generation + Preview | `/generar` animation + `/preview` viewer/checkout — all implemented |
| Language toggle | LocaleSwitcher component in nav (ES/CA/EN/FR) |
| Interest tags | 6 interests (space/animals/sports/castles/dinosaurs/music), max 4 selectable |
