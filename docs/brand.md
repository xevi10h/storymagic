# Meapica brand system

The single reference for how Meapica looks, sounds and moves. It is derived from the
creation flow (`/create` → preview → checkout), the most polished surface of the product.
Every new screen (landing, SEO pages, blog, dashboard) is built from this file; when this
file and an older screen disagree, this file wins.

Code: tokens in `src/app/globals.css`, primitives in `src/components/ui/` (`import { Button, Heading, … } from "@/components/ui"`).

---

## 1. Positioning

**Line:** *Un cuento de verdad, con su nombre, su cara y su aventura. Impreso y en tu casa.*

- **What we sell:** a real printed picture book (20 × 20 cm, tapa dura/blanda) where the child is the
  protagonist: name on the cover, a watercolor portrait that looks like them, and a story whose 3
  chapters the parent chooses.
- **Proof we lead with (in this order):** the live cover with their name (instant), the watercolor
  portrait, the painted pages of *their* preview, the physical book (mockup with real dimensions).
- **Who:** Spanish parents, grandparents, godparents buying a gift for a 2–12-year-old. They buy on
  a phone, often at night, often against a date (cumpleaños, Reyes, fin de curso).
- **Against:** screens and generic toys (the old "menos pantallas" angle is a supporting message,
  not the headline), and competitors that make you wait, sign up or pay before you see anything.
  Our edge: you see your child's book before paying, and it takes minutes.

## 2. Voice & tone

Warm, direct, concrete. We talk to the parent (tú), about the child (su / él / ella / {name}).
Short sentences. Verbs first. Promise only what the product does.

| Do | Don't |
|---|---|
| **¿Cómo se llama?** | Introduce el nombre del protagonista |
| Su nombre irá en la portada y en cada página del cuento. | Personalización avanzada con IA |
| Elige su mundo y decide los tres capítulos. Cada elección cambia la historia. | Descubre infinitas posibilidades mágicas ✨ |
| ¡Listo! La aventura ya está trazada. Ahora, a pintar su libro. | ¡Increíble! ¡Tu obra maestra está en camino! |
| Crear su libro · Lo quiero · Ver su libro | Enviar · Continuar al siguiente paso |
| Llega entre el 9 y el 15 de octubre (fecha estimada) | Envío ultrarrápido garantizado |
| El cuento que te pedirá otra vez. | El regalo más mágico del mundo |
| Rompe el papel, ve su nombre en la portada y levanta la vista para buscarte. | Una experiencia emocional única e inolvidable |
| «Otra vez». Y se lo vuelves a leer, porque la aventura la vive Lucía. | ¡¡Tus hijos lo van a adorar!! |
| Tus palabras abren el libro. Las leerá ahora y volverá a leerlas de mayor. | Un recuerdo para toda la vida ✨ |
| Solo lo usamos para escribir el cuento en femenino, masculino o neutro. | (silence about why we ask) |

Rules:
- **Emotion through specifics, never adjectives.** Name a real moment the product creates (the first look at the cover,
  bedtime "otra vez", the dedication reread years later, the book that outlives the toys) in one short sensory sentence.
  Clarity first: every emotional line sits next to what it is, how it works and the price. Examples are labelled
  as examples ("Dedicatoria de ejemplo"); never quote customers we don't have.
- **Use the child's name** whenever we have it ("¿Qué aventura vivirá Lucía?"). It is the product.
- **CTAs are possessive and concrete:** "Crear su libro", "Pedir el libro de Lucía". Never "Submit".
- **Explain every question in one line** (why we ask, what it changes).
- **Honest numbers only:** real delivery windows, real prices, "fecha estimada". Never invent
  testimonials, review counts, star ratings, "+10.000 familias" or scarcity. Social proof only when real.
- **"IA" is not a selling word.** Say what the parent gets: "ilustrado a acuarela", "escrito para su edad".
- **Prices (B2C) always show VAT next to the number:** `49,90 € IVA incluido`, also in CTAs and
  sticky bars ("desde 34,90 € · IVA incluido · Envío gratis"). Source of truth: `src/lib/pricing.ts`.
- Catalan/French/English follow the same tone; French elides "de" before vowels ("L'aventure
  d'Émile"); Catalan uses the personal article ("L'aventura de la Noa", "d'en Pau", "de l'Àlex"),
  handled in `src/lib/name-grammar.ts` (`LiveCover`, `deName`).
- Spanish typography: `¿…?`, `¡…!`, thin separators with `·`, numbers `1.500`, `49,90 €`.

## 3. Logo

- **Wordmark:** `BrandLogo` (inline SVG, `currentColor`). Default colour `text-brand-deep` (#5D4037).
  On photos/dark art: `text-white/90`. Watermark on a cover: `text-ink-soft/55`.
- **Sizes:** header `h-5` (creation) to `h-7` (marketing nav); never below `h-4`.
- **Mark:** `BrandIcon` (open-book "M", CSS mask, `currentColor`) for favicons, avatars, tight spaces.
  `LogoIcon` is the older quill mark, do not use in new work.
- Clear space ≥ the height of the "M" on every side. Never recolour to orange, never add effects,
  never place on busy art without a scrim.

## 4. Colour

Semantic tokens (Tailwind utilities in parentheses). **Use only these in new work.**

| Token | Hex | Role |
|---|---|---|
| `--brand` (`bg-brand`, `border-brand`) | `#E86C3A` | Fills: primary CTA, progress, icon-only check badges. Text on it only at ≥ 19 px bold (see Accessibility) |
| `--brand-text` (`text-brand-text`) | `#b94f1f` | Orange **text** at any size: kickers, links, prices-in-orange, selected-chip labels (4.75:1 on paper) |
| `--brand-tint` (`bg-brand-tint`) | brand 8 % on white (opaque) | Background for small orange-text states: selected chips/tabs, step numbers, badges, small CTAs (`brand-text` on it 4.58:1) |
| `--brand-hover` | `#d15a2b` | Hover/pressed of brand |
| `--brand-deep` (`text-brand-deep`) | `#5D4037` | Wordmark, prices, purchase headings, dark bands/footer |
| `--brand-deep-hover` | `#4E342E` | Hover of brand-deep |
| `--gold` | `#d4af37` | Rare highlight (star pattern, reveal). Never for text |
| `--ink` (`text-ink`) | `#1b120e` | Headings, the child's name, key values |
| `--ink-soft` (`text-ink-soft`) | `#4a3b32` | Default UI text, labels, list items |
| `--ink-body` (`text-ink-body`) | `#6b5850` | Long-form paragraphs (FAQ answers, articles) |
| `--ink-muted` (`text-ink-muted`) | `#7a6963` | Subtitles, hints, meta, captions (4.95:1 on paper) |
| `--paper` (`bg-paper`) | `#FFF8F0` | Page background (flat, set on `<body>`; no texture), sticky header/footer |
| `--surface` (`bg-surface`) | `#FFFFFF` | Cards, inputs, chips, sheets |
| `--line` (`border-line`, `bg-line`) | `#f3ebe7` | Default borders, unselected chips, tracks, neutral fills |
| `--line-warm` (`border-line-warm`) | `#E6C9A8` | Warm hairline on paper (secondary outlines in preview) |
| `--scrim` (`bg-scrim`) | `rgba(44,24,16,.45)` | Sheet/modal backdrop |
| `--success` (`text-success`) | `#2E7D32` | "Envío gratis", saved ✓ |
| `--error` | `#C62828` | Error text. Error boxes: `bg-red-50 text-red-700 border-red-200` |

Tints: use opacity modifiers of brand, never new hexes. `brand/5` hover wash, `brand/[0.04]`
selected card, `brand/10` sticky borders (`border-brand/10`) and icon discs, `brand/15` focus halo,
`brand/20` secondary outline, `brand/30` CTA shadow, `brand/40` hover border. Behind orange **text**
use the opaque `bg-brand-tint` instead: `brand-text` on a translucent `brand/10` is only 4.3:1 on paper.

Proportions: ~80 % paper + white, ~15 % ink, ≤ 5 % orange. Orange means "act here" or "chosen";
if everything is orange nothing is. One primary CTA per viewport.

Accessibility (measured on `--paper`; all pass WCAG AA 4.5:1 for body text unless noted):
- `ink` 17.5:1, `ink-soft` 10.2:1, `ink-body` 6.4:1, `brand-deep` 8.9:1, `ink-muted` 4.95:1
  (5.2:1 on white, 4.4:1 on `--line`: avoid muted text on `bg-line` fills): any size.
- Orange text: always `text-brand-text` (#b94f1f, 4.75:1 on paper, 5.0:1 on white). `text-brand`
  (#E86C3A) is only 3.0:1: allowed for icons/decoration or bold ≥ 24 px display type
  (e.g. the orange hero line), never for small labels, kickers, links or prices.
- **Rule (owner decision, 2026-09-30): white text on the `brand` fill is 3.2:1 = AA large text only.**
  Every white/light label on `bg-brand` (or its hover) is **19 px bold** (`text-[19px] font-bold`,
  ≥ 18.66 px = 14 pt bold); `Button` md/lg do this for you. Hover `--brand-hover` gives 4.0:1. Keep
  the fill; do not darken the CTA.
- Where 19 px is too big (navbar pill, `sm` buttons, chips, selected tabs, step numbers, badges,
  avatar initials, CTAs inside the book page), use the AA-safe treatment instead: `bg-brand-tint`
  + `text-brand-text` + a brand border/ring (`brandBadge` in `ui/cx.ts`, `Button size="sm"`,
  `ChoiceChip` selected). Icon-only elements on orange (check badges, done steps) are fine: non-text 3:1.
- `::selection` is a 30 % brand wash with `ink` text (not white on orange).
- Audit: a Playwright script that asserts every visible text node on a brand-orange background is
  ≥ 18.66 px and ≥ 700 weight (last run 2026-09-30: 0 violations on /es, /es/themes,
  /es/christmas-delivery, /es/create 1–3 at 360/390/1440).
- `ink-muted` with opacity (e.g. placeholder `/45`) is decorative only; never convey required info.

Legacy names (`primary`, `secondary`, `cream`, `text-main`, `text-muted`, `border-light`,
`create-*`, `footer-*`, `pack-*`…) still work as aliases. `primary` now resolves to `--brand`.
Do not use them in new code; `text-muted` (#A1887F, 3.1:1) and `cream` (#F9F5F0) in particular
are off-brand values kept only so older screens don't shift.

**Banned:** purple/blue gradients, neon/glow, glassmorphism, dark mode UI, colour-per-section
rainbows. Colour in illustrations comes from the art (and the child's favourite colour), not the UI.

## 5. Typography

- **Display: Fredoka** (`font-display`, 500–700). Headings, the child's name, book titles, option titles, prices in cards.
- **Text: Plus Jakarta Sans** (`font-sans`, default on `body`). Everything else.
- Both load `latin` + `latin-ext` (names like Ștefan, Łucja, Ŀlúcia). `h1–h4` default to Fredoka globally.
- Numbers in chips and prices: `tabular-nums`.

| Role | Classes | Where |
|---|---|---|
| Display (landing hero) | `font-display font-bold text-[34px] leading-[1.08] sm:text-5xl lg:text-[64px]` | `Heading size="display"` |
| Page title (H1) | `font-display font-bold text-[26px] leading-tight sm:text-4xl text-ink` | `Heading size="page"` (screens 1–3) |
| Section title (H2) | `font-display font-bold text-lg sm:text-xl leading-snug text-ink` | `Heading size="section"` |
| Card/option title | `font-display font-semibold text-[15px] leading-tight` | option cards, formats (`text-base font-bold`) |
| Subtitle | `text-sm sm:text-base font-medium text-ink-muted`, `mt-1.5` | under H1 |
| Body | `text-base leading-relaxed text-ink-body` (articles `text-lg leading-[1.8]`) | long copy |
| UI text | `text-sm text-ink-soft` (13 px `text-[13px]` in dense panels) | lists, rows |
| Eyebrow / label | `text-xs font-bold uppercase tracking-wide` + `text-ink-soft` (label) / `text-brand-text` (kicker) / `text-ink-muted` (group) | `Eyebrow` |
| Hint / meta | `text-xs text-ink-muted` | under fields |

Max line length for body copy: ~65 characters (`max-w-prose`). Never all-caps beyond eyebrows.
Headings wrap with `text-balance`; names never break inside a word.

## 6. Layout & spacing

- Base unit 4 px (Tailwind scale). Rhythm inside a screen: `gap-6` between blocks, `gap-2`/`gap-2.5`
  inside a group, `gap-8` between sections of a long screen, `mb-3` heading → content.
- **Gutters:** `px-4` (16 px) on phones, `sm:px-6`, desktop content max-width `1120–1200px`
  (`max-w-[1120px]` form screens, `max-w-[1200px]` wide screens, header `max-w-[1440px]`).
- Two-column pattern (desktop): art/cover on the left (`lg:w-[340–440px]`, sticky under the header),
  controls on the right. Mobile: art first, compact, then controls.
- Marketing sections: `py-16 sm:py-24`, one idea per section, one CTA per section at most.
  Backgrounds alternate `bg-paper` / `bg-surface border-y border-line` (never two of the same in a row);
  one full-bleed `bg-brand-deep` band per page is allowed for the emotional moment (text `text-paper`, kicker `text-line-warm`,
  art on `bg-paper` cards);
  every section heading is `Heading size="page"` with a brand `eyebrow` (the closing name CTA is the one
  exception). Anchored sections use `scroll-mt-[var(--landing-nav-h,64px)]`.
- Marketing header (`landing/Navbar`): fixed, publishes `--landing-nav-h`; full links from `xl` (1280),
  below that a menu sheet, with the primary "Crear su libro" kept in the bar from `lg`. The phone sticky
  CTA (`MobileStickyCta`, `< lg`) shows after the hero CTA scrolls out and hides over `#final-cta` and the footer.
- Header: sticky, `h-14`, `bg-paper`, `border-b border-brand/10`; exposes `--creation-header-h`
  for things that stick under it.

## 7. Radius & elevation

Project radius scale (**one step larger than Tailwind defaults**):
`rounded-lg` 12 px · `rounded-xl` 16 px · `rounded-2xl` 24 px · `rounded-3xl` 24 px · `rounded-full`.

| Element | Radius |
|---|---|
| Buttons (page CTAs), pills, badges, toggles | `rounded-full` |
| Checkout CTA (full width) | `rounded-2xl` |
| Chips, secondary rectangular buttons, small tiles | `rounded-xl` |
| Inputs, cards, option cards, panels | `rounded-2xl` |
| Sheets/dialogs, elevated panels | `rounded-3xl` (top-only on mobile sheets) |
| Book covers | `rounded-[4px_14px_14px_4px]` (spine left) |
| Portraits | `rounded-full ring-4 ring-white` |

Elevation is warm (brown-tinted), soft, rare. Flat by default: most cards are border-only.

| Token | Use |
|---|---|
| none + `border-2 border-line` | default card / input / chip |
| `shadow-soft` | small white boxes on paper (progress box) |
| `shadow-card` + `ring-1 ring-line` | main elevated panel (purchase panel) |
| `shadow-lg shadow-brand/30` → hover `shadow-xl shadow-brand/40` | primary CTA only |
| `shadow-book` | book covers and mockups |
| `shadow-portrait` | watercolor portrait disc |
| `shadow-2xl` | sheets/dialogs |

Never stack shadow + thick border + tint on the same card. No coloured glows.

## 8. Components

All in `src/components/ui/`, class strings extracted from the creation flow.

**Buttons** — `Button` / `buttonClass()` (use `buttonClass` on `<Link>`):
- `primary` (default): orange pill, **white 19 px bold label** (AA large text), brand shadow,
  `active:scale-95`, arrow icon nudges right on hover (`trailingIcon="arrow_forward"`). One per viewport.
  At `size="sm"` it renders the AA-safe tinted pill instead (`border-2 border-brand bg-brand-tint
  text-brand-text`, hover `bg-surface`): navbar "Crear su libro", sheet/inline actions.
  Do not override the label size of a filled button below 19 px (`text-sm!`, `text-[15px]!`…).
- `secondary`: white pill, `border-2 border-brand/20`, `text-brand-text` label; hover full orange border + `brand/5` wash. "Atrás", secondary paths.
- `quiet`: text-only, `ink-muted` → `ink-soft` with `bg-line` hover. Header actions ("Salir").
- Sizes: `sm` (44 px min, 14 px, sheet actions), `md` (48 px min, 19 px, page CTA, default), `lg` (56 px, 19 px, `rounded-2xl`, checkout, use with `block`).
  Tight rows at 360 px: the creation footer's "Atrás" goes icon-only under 390 px (label kept as the accessible name) so the 19 px next label fits in every locale.
- Disabled: `opacity-40`, explain why (tooltip on desktop, hint line above the sticky bar on mobile).
  Loading: `Spinner` + verb in gerund ("Guardando…"), keep width (see §10 › Loader).

**Links:** inline links `font-semibold underline decoration-{color}/30 underline-offset-2 hover:text-brand-text`.
Quiet meta links `text-ink-muted underline decoration-ink-muted/40`.

**Chips** — `ChoiceChip` (role radio, inside `role="radiogroup"` with a label): `rounded-xl border-2`,
min 44 px. Selected = `border-brand bg-brand-tint text-brand-text` (one style for ages and words; no orange
fill, since chip labels are 14 px and white on orange fails AA below 19 px bold).
Unselected `border-line bg-surface text-ink-soft hover:border-brand/40`.
Colour swatches: 40 px circles, selected = orange ring + white check, name of the colour printed under the row.

**Cards** — `Card`:
- `outline`: `rounded-2xl border-2 border-line bg-surface`; selected `border-brand bg-brand/[0.04]`; `interactive` adds hover border.
- Option card with art: image on top (square or 3:2, `bg-line` placeholder), title in Fredoka,
  1–2 line description in `ink-muted`, check badge `h-6 w-6 rounded-full bg-brand` top-right when selected,
  unchosen siblings drop to `opacity-70` once a choice exists.
- `elevated`: `rounded-3xl shadow-card ring-1 ring-line`, padding `p-5 sm:p-6` (one per screen).
- `plain`: white on paper, no border (status notes).
- **Card that is a link** (catalog worlds, lists of many items): the whole card is one `<Link>` via a
  stretched `after:absolute after:inset-0` on the title link (focus ring drawn on the `::after`); any second
  action inside ("Ver por dentro") sits above it with `z-10`, never nested. The per-card CTA is a quiet
  `text-brand-text` "Crear su libro →" label (decorative, `aria-hidden`), never ten orange pills.

**Inputs:** `h-12` (hero field `h-16 font-display text-2xl`), `rounded-2xl border-2 border-line bg-surface px-4`,
focus `border-brand`, placeholder `text-ink-muted/45`, label = `Eyebrow` above, counter right-aligned (`42/500`).
The landing name fields (hero + closing CTA) share one value (`HeroNameStore`) and use the question itself as
the label, in Fredoka (`font-display text-lg font-semibold`): "¿Cómo se llama?".

**Badges:** `rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-brand-text shadow-sm` ("Para su edad"),
dark variant `bg-brand-deep text-white` ("Tapa dura").

**Progress:** stepper dots `h-6 w-6` (active orange + `ring-4 ring-brand/15`, done orange + ✓, todo white + `border-line`);
mobile = "Paso 2 de 6 · Protagonista" + 6 segments `h-1.5`.

**Sheets:** bottom sheet on mobile / centred dialog ≥ 640 px (`src/components/create/Sheet.tsx`), `bg-scrim` backdrop,
Esc/backdrop close, focus trapped and restored. Edit in place, never navigate away to edit.

**Focus:** every interactive element shows `focus-visible:outline-2 outline-offset-2 outline-brand`
(`focusRing` export). Never remove focus without a replacement.
The global `:focus-visible` ring lives in `@layer base` (globals.css), so `outline-none` on a component
wins: inputs use `outline-none focus:border-brand` as their single ring (no double ring).

**Icons:** Material Symbols Outlined (`<span class="material-symbols-outlined">`), 18–20 px inline,
always `aria-hidden` with a text label. Allowed metaphors: arrows, check, edit, local_shipping,
event_available, download, close. The font is a self-hosted subset (`src/fonts/material-symbols-outlined.woff2`,
~90 KB, only the icons the code uses, next/font/local in `RootDocument`): **after adding a new icon name run
`node scripts/material-symbols-subset.mjs`** (a missing glyph renders as its ligature text; `--check` verifies offline).
It loads with `display: block` and globals.css locks every icon to a 1em box, so ligature names never flash or
shift layout (CLS). Known gap: the unlayered `.material-symbols-outlined { font-size: 24px }` in globals.css (kept
from Google's stylesheet so nothing changed visually) beats Tailwind `text-*` on the icon span, so every icon
renders at 24 px today; use `!text-lg` (or inline style) when a smaller icon is really needed.
**Banned:** `auto_awesome`/sparkles, bolts, magic wands, robots, rockets-as-"growth".

## 9. Imagery

- **Only real product art:** template covers (`/images/templates/*`), path art (`/images/path/**`),
  the child's watercolor portraits (`WatercolorAvatar` / `ProtagonistAvatar`, pre-rendered matrix
  `/images/avatar/**`), real painted books and the book mockups (`src/components/book-mockup`:
  `BookMockup`, `Book3D`, `OpenBook`, `DeviceMockup`). The live cover (`LiveCover`) is the hero asset.
- Show the **book as an object** (3D mockup with real 20 × 20 cm dimensions, open spreads,
  hands/table context only if it's a real photo of our book).
- Watercolor = the illustration language: soft edges, paper texture, warm light. UI stays flat and quiet around it.
- **Banned:** stock photos of children/families, AI-generic "magic" imagery, sparkles, lightning,
  purple-blue gradients, emoji as illustration, mock UIs with fake data, hotlinked images or
  textures (the old `.texture-overlay` was removed; the page is flat `--paper`).
- Children's generated images are always plain `<img>` (signed URLs), never `next/image`.
  Static art uses `next/image` with correct `sizes`. Always `alt=""` for decorative art, descriptive alt for the book.

## 10. Motion

Calm, paper-like, fast. Everything respects `prefers-reduced-motion` (animations off).

| Motion | Spec | Class |
|---|---|---|
| Screen enter | 320 ms, fade + 10 px rise, `cubic-bezier(.2,.9,.3,1)` | `.step-in` |
| Section reveal | 380 ms, same curve | `.chapter-in` |
| Art swap | 350 ms cross-fade | `.cover-art-in` |
| Sheet | 280 ms slide-up (mobile), 220 ms fade-rise (desktop) | `.sheet-panel` |
| Hover | `transition-colors` / `transition-all` 150 ms; arrow icon `translate-x-1` | |
| Press | `active:scale-95` (pill) / `active:scale-[0.98]` (block CTA) | |
| Reveal (the wow) | cover scale-in 900 ms + title 700 ms | `.book-reveal-*` |

No parallax, no scroll-jacking, no looping decorative animation near a CTA. Live updates
(name → cover) must feel instant (< 100 ms).

### Loader

One loader family, built from the logo (`src/components/ui/BrandLoader.tsx`, `Spinner.tsx`,
styles in `BrandLoader.module.css`; `import { BrandLoader, PageLoader, Spinner } from "@/components/ui"`).

- **`BrandLoader`**: the open-book mark (the "M" of the wordmark, no letters) redrawn as strokes
  in an 832-unit viewBox traced over `/images/m-icon.png`: left page, spine swash (a filled shape
  revealed by a masked stroke so it keeps the logo's swell), right page, two loose leaves.
  2.4 s loop: the pen draws the left page (bottom-left, up, across), the spine, the right page,
  the leaves flick out and lift 5°, the right page takes a 12 % tint, then every stroke retracts
  in drawing order and there is a short empty beat (seamless seam). `currentColor`, default
  `text-brand-deep`; never orange (logo rule). Sizes `sm` 28 px, `md` 56 px (sections), `lg` 96 px (pages).
  `role="status"`; visible `caption` ("Cargando tu cuento…") or an sr-only `label`, default
  `common.loading` ("Cargando…"). All instances are phase-locked to the document timeline, so a
  route `loading.tsx` handing over to the page's own loader continues the same stroke.
- **`PageLoader`**: full-viewport centred `BrandLoader size="lg"`. Used by the route `loading.tsx`
  of `dashboard`, `profile`, `checkout/success`, `create/[storyId]`, `examples/[storyId]`.
- **`Spinner`**: buttons and tiny inline waits (1em arc on a 22 % track, `currentColor`, 0.9 s).
  The drawn mark is legible down to ~24 px when static, but at 18–20 px a 2.4 s draw reads as a
  scribble and is slower than most button waits, so buttons keep a quiet spinner. `Button loading`
  uses it; pair it with a gerund label ("Guardando…").
- **Skeletons** stay where the content shape is known (catalog cards, book viewer, dedication
  editor): `bg-line` / `border-line bg-surface`, `animate-pulse`.
- Reduced motion: static mark / arc with a soft opacity pulse (feedback without movement).
- Never use Material `progress_activity` + `animate-spin`, `border-t-*` CSS rings, or a
  pulsing icon as a loader.

## 11. Mobile rules (most traffic)

- Design at **390 × 844 first**; 16 px side gutters (`px-4`); no horizontal page scroll
  (horizontal carousels bleed with `-mx-4 px-4 snap-x`).
- **Tap targets ≥ 44 px** (`min-h-11`); gaps ≥ 8 px between targets.
- **Sticky bottom CTA** on any screen with a decision: `sticky bottom-0 bg-paper/90 backdrop-blur-md border-t border-brand/10`,
  primary on the right, back/summary on the left, `pb-[env(safe-area-inset-bottom)]`. Marketing pages: a
  sticky "Crear su libro" bar appears after the hero scrolls out.
- Respect safe areas (`env(safe-area-inset-*)`) on sticky bars and sheets; use `100dvh`, not `100vh`.
- Inputs `text-base` (16 px) minimum so iOS doesn't zoom; correct `autoComplete`, `enterKeyHint`, `inputMode`.
- Hero art is compact on phones (cover ≈ 56 vw, max 230 px) so the first action is above the fold.
- Performance budget: LCP < 2.5 s on 4G. Preload only the hero image; lazy-load the rest; avoid new web fonts.

## 12. Checklist for a new screen

1. Only semantic tokens (`brand`, `ink*`, `paper`, `surface`, `line*`), no raw hex, no legacy names.
2. Fredoka headings, Jakarta text, sizes from §5.
3. One primary CTA per viewport, possessive copy, price with "IVA incluido".
4. Real art only; no sparkles/bolts/gradients; no invented proof.
5. 390 px: 16 px gutters, ≥ 44 px targets, sticky CTA, safe area, no horizontal scroll.
6. Focus ring visible, reduced motion respected, contrast per §4.
