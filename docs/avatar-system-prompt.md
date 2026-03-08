# Prompt: Custom SVG Avatar System for Children's Book App

## Context

I'm building **Meapica**, a personalized children's book platform. Parents create a character by choosing physical traits and interests, then the app generates a custom illustrated story + printed book starring that character.

During the creation wizard (Step 2), users configure their child's avatar with these options:

### Character Options

**Gender** (3):
- `boy`
- `girl`
- `neutral`

**Hair Color** (5):
- `black` → #2a2a2a
- `brown-dark` → #5d4037
- `brown` → #8d6e63
- `blonde` → #e6c07b
- `red` → #d84315

**Skin Tone** (5):
- `light` → #fce4d6
- `medium-light` → #eebb99
- `medium-dark` → #c68642
- `dark` → #8d5524
- `very-dark` → #523218

**Hairstyle** (varies by gender):
- **Boy** (4): `short`, `curly`, `spiky`, `buzz`
- **Girl** (4): `long`, `curly`, `pigtails`, `bob`
- **Neutral** (3): `medium`, `curly`, `short`

**Age** (1–12): Should have a visible impact on the avatar's proportions and face. Group into 4 visual brackets:
- **Toddler (1–3)**: Very round face, chubby cheeks, big eyes relative to face, tiny nose, short/stubby body proportions (big head ratio ~1:3)
- **Young child (4–6)**: Slightly less round face, still big eyes, small nose, body ratio ~1:4
- **Preteen kid (7–9)**: Face starts to slim down, slightly smaller eyes relative to face, body ratio ~1:5
- **Older kid (10–12)**: More defined jawline, proportional eyes, hint of maturity, body ratio ~1:5.5

**Interests** (6, multi-select — affects accessories/details on the avatar):
- `space` → small rocket pin or star badge on shirt
- `animals` → paw print on shirt or small pet companion silhouette
- `sports` → sporty headband or jersey-style shirt
- `castles` → small crown or shield emblem on shirt
- `dinosaurs` → dino silhouette on shirt or tiny dino companion
- `music` → headphones around neck or musical note on shirt

### Total Combinations
- Boy: 5 hair × 5 skin × 4 hairstyle × 4 age groups = 400 base
- Girl: 5 hair × 5 skin × 4 hairstyle × 4 age groups = 400 base
- Neutral: 5 hair × 5 skin × 3 hairstyle × 4 age groups = 300 base
- **Total base avatars: 1,100**
- Interests are applied as overlay layers/accessories (not separate images)

---

## What I Need You to Build

A **programmatic SVG avatar generator** in TypeScript/React that renders a children's book-style character portrait based on the input parameters. This is NOT about pre-generating 1,100 static images — it's about building a **composable SVG system** that assembles the right parts dynamically.

### Architecture

```
getAvatarSvg({ gender, hairColor, skinTone, hairstyle, age, interests }) → SVG string
```

The system should work with **layered SVG components** that stack on top of each other:

1. **Base head shape** — Varies by age bracket (rounder for toddlers, slimmer for older kids)
2. **Face features** — Eyes, nose, mouth, eyebrows. Vary subtly by age (bigger eyes for younger, more defined for older). Cheerful expression always.
3. **Skin layer** — Applied as `fill` color to head, neck, ears, nose
4. **Hair layer** — The hairstyle shape, filled with the hair color. Each hairstyle is a separate SVG path group
5. **Body/shirt** — Simple shoulders + shirt visible at the bottom. Base color changes subtly by gender or is neutral. This is where interest accessories appear
6. **Interest overlays** — Small decorative elements on the shirt or as accessories (pins, headbands, companion silhouettes). These are additive layers, multiple can be active at once
7. **Ears** — Simple ear shapes, skin-colored, positioned behind hair layer

### Visual Style Requirements

- **Children's book illustration feel** — Soft, warm, friendly. NOT corporate/flat icon style. Think Pixar character sheets meets picture book art.
- **Consistent art direction** — Every combination should feel like it belongs in the same book. Same line weight, same color palette warmth, same level of detail.
- **Expressive but simple** — Big warm eyes with a highlight dot, gentle smile, rosy cheeks (subtle blush on all skin tones). The character should feel lovable.
- **Circular framing** — The avatar is displayed inside a circle (200×200px viewport), so compose accordingly. Head + upper shoulders visible.
- **No outlines / lineless style** — Use shape layering and subtle shadows instead of black outlines. Soft, painterly feel.
- **Warm palette** — Even the shadows should be warm (use brown/orange shadows, never grey/blue).
- **Subtle depth** — Use 1-2 levels of soft inner shadows or darker shape overlays to give dimension to the hair and face.

### Age Differentiation (Critical)

This is the most important aspect. A 2-year-old and a 10-year-old should be **immediately distinguishable**:

| Feature | Toddler (1-3) | Young (4-6) | Kid (7-9) | Preteen (10-12) |
|---------|---------------|-------------|-----------|-----------------|
| Head shape | Very round, wide | Round, slightly taller | Oval starting | More oval |
| Eye size | 35% of face width | 30% of face width | 25% of face width | 22% of face width |
| Eye position | Lower on face | Slightly higher | Center | Center-high |
| Nose | Tiny dot/button | Small triangle | Small defined | More defined |
| Mouth | Small wide smile | Medium smile | Wider smile | Subtle smile |
| Cheeks | Very puffy/round | Round | Slight | Defined |
| Head-to-body ratio | Head dominates | Head still large | Balanced | Body more visible |
| Forehead | Large (high hairline) | Large | Normal | Normal |
| Chin | Almost none | Small | Present | Defined |

### Hairstyle Details

Each hairstyle should be a distinct SVG path group that sits on top of the head shape:

**Boy hairstyles:**
- `short` — Close-cropped hair following the head shape, slightly textured top
- `curly` — Voluminous curly hair, rounded silhouette extending beyond head shape
- `spiky` — Upward-pointing tufts on top, short on sides
- `buzz` — Very close to head, almost following the skull shape, subtle texture

**Girl hairstyles:**
- `long` — Hair flowing down past shoulders on both sides, with gentle waves
- `curly` — Big voluminous curls framing the face, bouncy silhouette
- `pigtails` — Two bunches on the sides, tied with small hair ties (use hair color for ties)
- `bob` — Chin-length straight cut, clean edges, slight inward curve at ends

**Neutral hairstyles:**
- `medium` — Chin to shoulder length, loose and natural
- `curly` — Medium-length curls, between boy-curly and girl-curly in volume
- `short` — Similar to boy-short but slightly softer edges

### Interest Accessories

These are small SVG elements added as the final layer. When multiple interests are selected, show up to 3 (prioritize the first selected):

- `space` — Small star/rocket pin on the shirt collar area, yellow color
- `animals` — Tiny paw print on the shirt chest area, warm brown
- `sports` — Thin sporty headband on forehead (above hair), in a bright color
- `castles` — Small shield/crest emblem on shirt, golden yellow
- `dinosaurs` — Tiny cute dino silhouette peeking from behind the shoulder, green
- `music` — Small headphones resting on neck/shoulders, matching shirt color but darker

### Technical Requirements

1. **Pure SVG** — No external images, no base64, no raster. Everything is `<path>`, `<circle>`, `<ellipse>`, `<rect>`, `<g>` elements
2. **Parameterized colors** — Skin tone and hair color are passed as hex values and applied via `fill` attributes
3. **Composable layers** — Each part (head, hair, eyes, etc.) is a separate function that returns an SVG group
4. **Viewbox: `0 0 200 200`** — Circular crop applied by the parent component
5. **React component** — Export a React component `<CharacterAvatar gender={} hairColor={} skinTone={} hairstyle={} age={} interests={[]} size={200} />`
6. **Also export a plain function** `getAvatarSvgString(props)` that returns the raw SVG string (for server-side use in PDF generation)
7. **Smooth transitions** — When props change, the avatar should feel alive. Use CSS transitions on fill colors and transforms where possible
8. **File structure:**
   ```
   src/components/avatar/
   ├── CharacterAvatar.tsx       ← Main React component
   ├── svg-builder.ts            ← getAvatarSvgString() for server use
   ├── parts/
   │   ├── heads.ts              ← Head shapes by age bracket
   │   ├── faces.ts              ← Eyes, nose, mouth, eyebrows by age
   │   ├── hair-boy.ts           ← Boy hairstyle paths
   │   ├── hair-girl.ts          ← Girl hairstyle paths
   │   ├── hair-neutral.ts       ← Neutral hairstyle paths
   │   ├── bodies.ts             ← Shoulder/shirt shapes by age
   │   ├── ears.ts               ← Ear shapes by age
   │   └── accessories.ts        ← Interest-based overlays
   └── utils.ts                  ← Color helpers (darken, lighten, shadow color from skin)
   ```

### Color Utilities Needed

```typescript
// Generate shadow color from base (for hair shadows, skin shadows)
darkenColor(hex: string, amount: number): string

// Generate highlight color
lightenColor(hex: string, amount: number): string

// Generate blush color from skin tone (rosy cheeks)
getBlushColor(skinTone: string): string

// Generate shirt color (should complement skin tone, not clash)
getShirtColor(gender: string, skinTone: string): string
```

### Example Usage

```tsx
<CharacterAvatar
  gender="girl"
  hairColor="#e6c07b"
  skinTone="#c68642"
  hairstyle="pigtails"
  age={4}
  interests={["dinosaurs", "music"]}
  size={200}
/>
```

Should render a young girl (4yo bracket) with medium-brown skin, blonde pigtails, a cute dino peeking behind her shoulder, and small headphones on her neck. Round face, big bright eyes, warm smile, rosy cheeks.

### What NOT to Do

- Don't make it look like a corporate icon set (Notion/Slack avatar style)
- Don't use black outlines — this should feel painterly/illustrative
- Don't make all ages look the same with just different heights
- Don't use generic/flat colors — add depth with 2-3 shades per color area
- Don't make the interests overwhelming — they should be subtle details, not the focus
- Don't forget ears (they peek out from behind hair on most styles)

### Current Tech Stack (for reference)

- Next.js 15 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- The avatar is displayed in a circular frame with a gradient border ring
- Currently using DiceBear `big-smile` (we're replacing this)
- The avatar also appears in the PDF book (via @react-pdf/renderer, which needs raw SVG string)
