# User Experience

## Stitch Project

All UI designs live in Stitch:
**Project ID:** `13399121936555227014`
**URL:** https://stitch.withgoogle.com/projects/13399121936555227014

Design theme: Light mode, custom color `#e96b3a` (warm orange), Plus Jakarta Sans font, fully rounded corners, high saturation.

## Complete User Flow

```
Landing Page
  → Step 1: Mode Selection (solo / together)
  → Step 2: Character Creation (name, age, appearance, interests)
  → Step 3: Adventure Selection (5 templates)
  → Step 4: Story Decisions (varies by mode)
  → Step 5: Personal Touches (dedication, ending choice)
  → Step 6: Magic Generation (animation while book is created)
  → Step 7: Preview & Checkout
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

### Step 1: Mode Selection

**Stitch screen:** `c44a65fbea2f4803a7aa24f981f36dc4`
**Purpose:** Choose creation mode.

**Two options:**
| Mode | Name | Description | UX Implication |
|------|------|-------------|----------------|
| Solo | "Creo yo solo/a" (Sorpresa Mágica) | Parent designs secretly as a surprise gift. Full control. | Step 4 shows narrative configuration (detailed controls) |
| Together | "Creamos juntos" (Aventura Compartida) | Interactive family experience. Choose together. | Step 4 shows illustrated choice cards (kid-friendly) |

---

### Step 2: Character Creation

**Stitch screen:** `51ae994b49d34e8da9416981d83cbe9e`
**Purpose:** Build the protagonist.

**Form fields:**
- Child's name (text input)
- City / "Lives in" (text input with location pin)
- Age (slider 1-12)
- Hair color (color selection)
- Skin tone (color selection)
- Gender: Niño / Niña / Neutro (3 options)
- Interests: selectable tags (Espacio, Animales, Deportes, Castillos, Dinosaurios, Música)

**Preview:** Watercolor illustration + confirmation text: "¡Hola, [name]! Tu héroe está listo para vivir aventuras entre [interests]."

---

### Step 3: Adventure Selection

**Stitch screen:** `5ffbcaefcf924df98b7ecca810cc78ff`
**Purpose:** Pick the story template.

5 illustrated cards, each showing:
- Title
- Age range badge
- 1-line description
- Thematic illustration

Selected card gets a highlighted border.

---

### Step 4: Story Decisions

This step varies by mode. Four variants exist in Stitch — **we need to decide the definitive approach.**

#### Variant A: Interactive Decisions (Together Mode) — RECOMMENDED for "Juntos"
**Stitch screen:** `316e8192eef2430c95d03ebe0d481d55`

Choose-your-own-adventure style. Story presents a moment ("¿Qué encuentra el héroe en el bosque?") and the child picks from 3 illustrated options (Dragón Dormido, Cofre Mágico, Puerta Secreta). Kid-friendly, visual, engaging. Includes audio button for read-aloud.

#### Variant B: World Builder — ALTERNATIVE (could merge into Variant A)
**Stitch screen:** `dafedd6e01c34332abe8160fffa83273`

Customize weather (Soleado/Nublado/Tormenta), outfit (Explorador/Mago/Caballero), destination (Bosque/Castillo/Montaña Espacial). More of a configuration panel than interactive storytelling.

#### Variant C: Narrative Configuration — RECOMMENDED for "Solo"
**Stitch screen:** `5aac75aeec574bb3ad15f66f178fdbf9`

Detailed controls for atmosphere (day/sunset/night), magic weather toggles, category tabs (Protagonist/Atmosphere/Plot Twist). Real-time text preview. Parent-oriented, sophisticated.

#### Variant D: Modular Story Progression — ALTERNATIVE
**Stitch screen:** `dae4703e99d445fc8b598082eeb518c2`

Chapter-by-chapter builder: choose companion (Robot/Alien/Pet), magical tool (Map/Compass/Flashlight), challenge type. Real-time narrative preview. Shows premium user ("Plan Premium").

**Decision needed:** Which variants to implement for MVP. Recommendation:
- **Together mode → Variant A** (interactive illustrated choices)
- **Solo mode → Variant C** (narrative configuration with live preview)
- Variants B and D → defer to post-MVP or merge useful elements into A/C

---

### Step 5: Personal Touches

**Stitch screen:** `2f2d905c2e6c47728ebbfccf3662f7eb`
**Purpose:** Dedication message + ending selection.

**Elements:**
- Dedication text area (personal message from parent/sender)
- Story ending choice (2 options with descriptions):
  - "Un Banquete de Celebración" — festive, all characters celebrate together
  - "Descanso bajo las Estrellas" — calm, reflective, stargazing ending
- CTA: "Continuar al Resumen"

---

### Step 6: Magic Generation ✅ IMPLEMENTED

**Route:** `/crear/[storyId]/generar`
**Purpose:** Entertaining wait screen while AI generates the book.

**Implementation:**
- Animated WritingAnimation quill + Meapica logo reveal
- Cycling whimsical progress messages per step ("Writing your story...", "Painting the illustrations...", etc.)
- Polls generation status, auto-redirects to Step 7 when ready
- Fully i18n'd in ES/CA/EN/FR

---

### Step 7: Preview & Checkout ✅ IMPLEMENTED

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
| Step 4 variants | Implemented: Variant A (Juntos) + Variant C (Solo) |
| Step count | Standardized to 7 steps |
| Missing screens | Steps 6, 7, Dashboard, Auth — all implemented |
| Language toggle | LocaleSwitcher component in nav (ES/CA/EN/FR) |
| Interest tags | 6 interests (space/animals/sports/castles/dinosaurs/music), max 4 selectable |
