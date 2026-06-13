# User Experience

## Stitch Project

All UI designs live in Stitch:
**Project ID:** `13399121936555227014`
**URL:** https://stitch.withgoogle.com/projects/13399121936555227014

Design theme: Light mode, custom color `#e96b3a` (warm orange), Plus Jakarta Sans font, fully rounded corners, high saturation.

## Complete User Flow — "El Camino" (3 steps)

The creation flow was redesigned into a single choose-your-own-adventure **path**. There is no longer a mode (solo/together) selection, a separate template-selection screen, or three decision knobs. `TOTAL_STEPS = 3`.

```
Landing Page
  → Step 1: Character Creation (name, age, appearance, interests) + FLUX.2 watercolor portrait reveal
  → Step 2: Adventure Path (serpentine gamebook):
              pick a theme/world (1st fork) → branching chapter choices (illustrated cards)
  → Step 3: Dedication + ending choice (per-template endings) → "Crear mi cuento"
  → Magic Generation (animation while book is created)  [/crear/[storyId]/generar]
  → Preview & Checkout                                   [/crear/[storyId]/preview]
```

## Screen-by-Screen Specification

---

### Landing Page

**Stitch screen:** `5325a3cce1324a368453343affe3ef20`
**Purpose:** Convert visitors into story creators.

**Sections:**
1. **Nav bar** — Logo, Manifiesto, Colección, Artesanal, Familias, CTA "Crear mi cuento"
2. **Hero** — "Menos pantallas, más historias para tocar" + dual CTA (Personalizar libro / Ver calidad del papel) + trust badges (FSC paper, artisanal shipping)
3. **3-step process** — (1) Choose a story, (2) Manual personalization with watercolor illustrations, (3) Receive the physical treasure
4. **Book library** — 3 featured books with softcover/hardcover pricing (34.90/44.90 EUR)
5. **Quality showcase** — Traditional binding details, Munken 170g paper
6. **Pack Aventura Artesanal** — Upsell section (+12.90 EUR)
7. **Testimonials** — 5-star reviews from real parents
8. **Collection offer** — 3 books = 20% discount
9. **Footer** — Workshop info, support, reading club signup, legal

---

### Step 1: Character Creation

**Component:** `Step2CharacterCreation`
**Purpose:** Build the protagonist and reveal their portrait.

**Form fields:**
- Child's name (text input, 50-char cap)
- City / "Lives in" (text input with location pin)
- Age (slider 1-12)
- Hair color (color selection)
- Skin tone (color selection)
- Gender: Niño / Niña / Neutro (3 options)
- Interests: selectable tags (Espacio, Animales, Deportes, Castillos, Dinosaurios, Música)
- Favorite color (book theme accent) + favorite companion (best friend/companion)

**Portrait reveal:** On confirmation, a FLUX.2 watercolor portrait of the child is generated once via `/api/characters/portrait` (stored in the Supabase `portraits/` bucket as `character.portraitUrl`) and shown with rotating "painting your hero" status messages (`PortraitReveal`). This portrait becomes the identity anchor for every illustration in the book — there is no SVG/DiceBear avatar.

---

### Step 2: Adventure Path ("El Camino")

**Component:** `PathBuilder`
**Purpose:** Build the story as a vertical, gamebook-style path of chained choices — identical on mobile and desktop.

- **First fork = the world.** Instead of a separate template screen, the path opens by asking the child to pick a theme/world (ranked by `getRecommendedTemplates` based on age + interests). This selects the story template (10 available, each backed by a branching story-tree in `src/lib/story-trees/`).
- **Branching chapter choices.** After the world, the path presents one beat at a time (encounter → companion → challenge → time → setting, or the template's own tree), each with illustrated option cards (real FLUX.2 watercolor art when available, gradient + icon fallback otherwise). Resolved milestones stack above as a trail.
- **Clickable header stepper.** The `CreationHeader` stepper lets the user jump back to any already-unlocked step.
- **Editable trail.** Any resolved milestone in the path is tappable to re-open and change that choice.
- **Completion state.** Reaching the end of the path shows a celebration recap (chosen-path chips) and the CTA to continue to the dedication.

---

### Step 3: Dedication

**Component:** `Step5AuthorMessage`
**Purpose:** Dedication message + ending selection, then trigger generation.

**Elements:**
- Dedication text area (personal message from parent/sender)
- Story ending choice — **per-template endings** (each story template defines its own set of dynamic endings; e.g. a festive celebration vs. a calm, reflective close)
- Back-cover preview
- CTA: "Crear mi cuento" → saves the draft and redirects to `/crear/[storyId]/generar`

---

### Magic Generation ✅ IMPLEMENTED

**Route:** `/crear/[storyId]/generar`
**Purpose:** Entertaining wait screen while AI generates the book.

**Implementation:**
- Animated WritingAnimation quill + Meapica logo reveal
- Cycling whimsical progress messages per step ("Writing your story...", "Painting the illustrations...", etc.)
- Polls generation status, auto-redirects to the preview when ready
- Fully i18n'd in ES/CA/EN/FR

---

### Preview & Checkout ✅ IMPLEMENTED

**Route:** `/crear/[storyId]/preview`
**Purpose:** Review the generated book and purchase.

**Implementation:**
- Interactive book viewer with page-flip animation + sound (react-pageflip)
- Mobile portrait mode optimized, fullscreen viewer
- Format selection (softcover 34.90 EUR / hardcover 49.90 EUR)
- Stripe Checkout session creation
- Post-purchase: `/checkout/success` confirmation page

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
