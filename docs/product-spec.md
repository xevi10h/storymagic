# Product Specification

## Book Format

| Attribute | Value |
|-----------|-------|
| Size | 20×20 cm square (Gelato photobook 200×200 mm), 4 mm bleed |
| Pages | Cover + 30 inner pages; the Gelato inside file also carries the 2 pastedowns glued to the boards (32 pages, pageCount 30 — same as Teo's printed book, order 34d619c2) |
| Binding | Softcover or hardcover (Gelato); PDF-only format too |
| Interior | Full colour, 170 g coated paper |
| Print partner | Gelato (print-on-demand; we ship Spain península + Baleares) |

## Book Layout (30 inner pages — implemented, `src/lib/pdf/layout.ts`)

| Page(s) | Content |
|---|---|
| Cover | Front: the child's name + title at the top over the cover art (no logo); spine title (hardcover); back: synopsis + brand |
| 1 | Title + dedication (right page alone). Scales with the book's body type (`planTitlePage`): the parent's dedication prints at the body size, never below 14 pt, when it fits (Júlia 20.25 pt, Leo 14 pt), with the title (up to 36 pt), name and ornaments scaled alongside. Long dedications (max 500 chars, API + editor) step the page down; the worst case, 500 chars in 5 paragraphs plus a long sender, prints at about 11 pt |
| 2–25 | 12 scenes, one spread each: full-bleed illustration (left) ↔ text page (right); panoramas across both pages. The scene title prints ONCE per spread — on the text page; it goes on the art (bottom gradient) only when the facing page has no heading (bridge page, text under a secondary illustration) and never on `full_illustration` pages. The old split layouts (78 % art band + cream strip repeating the title) are retired (2026-09-29): split scenes print full bleed, and new books render them square (`frameForScene`); older books' 2432×1904 split art cover-crops 22 % horizontally (233 dpi, soft-dpi warning only) |
| 26 | "The End" + closing line (`planFinalPage`): closing line at least at the body size (Júlia 23.5 pt, Leo 16 pt), "Fin" as a display word (26–36 pt) |
| 27 | "About the reader" — print-size hero portrait of the child + age, favourite colour, etc. |
| 28–29 | Illustrated adventure map + age-adapted "busca y encuentra" game (2-4: 4 items · 5-6: 6 items + follow the path · 7-12: 8 items + 3 questions, answers upside down). Books made before 2026-09-28: Meapica endpaper spread |
| Pastedowns | First + last page of the Gelato inside file (glued to the boards) and the digital book's endpapers: the Meapica endpaper — theme-tinted light paper with a calm scattered lattice of sparkles, crescent moons, small gold stars and dots (solid inks, no transparency; `EndpaperPage`) |
| 30 | Colophon + QR to meapica.com (left page alone) |

Body type grows with the reader's age band (2-4: 17 pt · 5-6: 15.5 · 7-9: 13 · 10-12: 11.5) and the LLM's word budgets are calibrated to fit at that size (docs/generation-pipeline.md). Young books then GROW their type to fill the page (2-4 up to 24 pt, 5-6 up to 19 pt): one size per book, the largest at which every body block fits (text pages, text under a secondary illustration, panorama text — which must stay on its gradient). Titles, ornaments and bridge text scale along; text blocks sit on the optical centre; centred text is set with balanced lines and no paragraph ends on a lone word. Reference: Júlia (3) prints at 21.5 pt, limited by her 4-line panorama.

## Narrative Structure (Block-Based, Age-Adaptive)

Always 12 content slots × 2 pages = 24 content pages. Slots are either "scene" (full narrative) or "bridge" (atmospheric transition). The mix depends on the child's age.

### Narrative Blocks

| Block | Name | Purpose |
|-------|------|---------|
| 1 | MI MUNDO | Who I am, where I live, what I love — the reader recognizes themselves |
| 2 | LA LLAMADA | Something changes, the adventure world opens |
| 3 | EL CAMINO | The journey — discoveries, friends, wonders |
| 4 | LA PRUEBA | The great challenge + overcoming it |
| 5 | VOLVER A CASA | Return transformed, carrying the lesson |

### Age-Based Adaptation

| Age Range | Scenes | Bridges | Words/Scene | Text Style | Illustration Style |
|-----------|--------|---------|-------------|------------|-------------------|
| 2-4 years | 8 | 4 | 50-80 | Simple sentences, onomatopoeia, repetition, sensory | `child_book` — watercolor, big shapes |
| 5-7 years | 10 | 2 | 100-140 | Playful dialogues, humor, wonder, mild suspense | `child_book` — detailed backgrounds |
| 8-12 years | 12 | 0 | 150-200 | Rich prose, inner monologue, metaphors, complex emotions | `hand_drawn` — editorial, cinematic |

### Bridge Pages

Atmospheric transitions between narrative blocks. One evocative sentence (max 25 words) + mood illustration. Examples:
- "Pero algo estaba a punto de cambiar..."
- "Y entonces, el mundo se llenó de estrellas."
- "Nadie imaginaba lo que vendría después."

For ages 2-4, bridges also serve as parent reading pauses.

## Story Templates (10 templates)

Each template is identified by an English slug and is backed by a branching story-tree in `src/lib/story-trees/` (14 nodes / 39 options / 4 locales each). The template is chosen as the first fork ("world" beat) of the adventure path.

| Slug | Title | Theme |
|------|-------|-------|
| `space` | La Gran Aventura Espacial | Space travel, planets, alien friends |
| `forest` | El Bosque Mágico | Fantastic animals, nature, ancient trees |
| `pirates` | Piratas del Mar de [city] | Pirate adventure, hidden treasure |
| `dinosaurs` | Dinosaurios | Prehistoric world, dino friends |
| `superhero` | Superhéroe por un Día | Save the city, hidden superpowers |
| `chef` | El Chef Más Pequeño del Mundo | Magical kitchen, living ingredients |
| `castle` | Castillo | Medieval castle, knights and quests |
| `safari` | Safari | Wild savanna, animal expedition |
| `inventor` | Inventor | Workshop of fantastical inventions |
| `candy` | Candy | Sweet land of candy and confectionery |

## Personalization Variables (Customer Input)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `child_name` | string | Yes | Child's name, stored in display form (`formatChildName`: "xavi" → "Xavi") |
| `gender` | enum | Yes | "boy" / "girl" / "neutral" |
| `age` | number (1-12) | Yes | Child's age |
| `hair_color` | string | Yes | Hair color/style |
| `skin_tone` | string | Yes | Skin tone |
| `eye_color` | string | Yes | Eye color |
| `interests` | string[] (up to 4) | Yes | Child's interests (space, animals, sports, castles, dinosaurs, music) |
| `city` | string | Yes | City where the child lives |
| `favorite_color` | string | No | Favourite colour (hex of `FAVORITE_COLORS`, asked on screen 2, optional). Leads the whole book palette — accents, titles, ornaments, tinted text pages, endpapers, cover/spine deep tone — in print and web (`src/lib/template-colors.ts`), plus the Character Bible jacket. Null → neutral warm palette. |
| `favorite_companion` | string | No | Best friend / companion |
| `sender_name` | string | No | Gift sender's name (if it's a gift) |
| `custom_dedication` | string | No | Custom dedication message |
| `template_id` | string (slug) | Yes | Selected story template (space / forest / pirates / dinosaurs / superhero / chef / castle / safari / inventor / candy) |
| `photo` | image | No | Child's photo, behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` (off until DPIA + OpenAI DPA). Requires the parent/guardian consent checkbox (`crear.photo.*`). Used ONLY to create the avatar portrait (and early child sheet), then deleted; hourly purge guarantees < 24 h. The book never uses it. |

### Child photo — privacy promise (2026-09-27)
- Public copy: "la borramos en cuanto creamos su personaje (y siempre en menos de 24 horas)"; OpenAI does not train on it and may keep it up to 30 days for abuse monitoring. Privacy policy section 8 "Fotos de menores" (`legal.privacy.section8*`).
- Consent record per photo (`photo_consents`: user, time, `PHOTO_CONSENT_VERSION`, locale), kept after deletion as proof. Bump `PHOTO_CONSENT_VERSION` whenever the `crear.photo.checkbox` copy changes.
- Withdrawal: `DELETE /api/characters/photo` or email to hola@meapica.com → deleted immediately.
- Pending before enabling: DPIA/EIPD, OpenAI DPA, controller NIF/address in the privacy policy (`[NIF]`, `[DIRECCIÓN]` placeholders).

## Upsells & Add-ons

| Product | Price | Contents |
|---------|-------|----------|
| Pack Aventura Artesanal | +12.90 EUR | Personalized character letter + matte stickers + wooden bookmark |
| Digital PDF (instant) | +5 EUR | Immediate PDF version of the book |
| Second copy (discounted) | +15 EUR | Additional softcover copy |
| Collection discount | 3 books = -20% | Encourage multi-purchase / saga adoption |

Live today: extra copy only (hardcover 29,90 € / softcover 19,90 €, same format, printed at the same time; shown on the paywall as one checkbox line "Otro ejemplar para los abuelos"). The Pack Aventura is off (`ADDON_ENABLED`), no collection discount.

All prices above (and the base book prices) are final VAT-inclusive consumer prices (B2C). Stripe Prices use `tax_behavior: inclusive`; the UI always shows "IVA incluido" next to the amount.

## Illustration Style Guide

**Visual style (consistent across all 12 illustrations):**
- Children's book illustration, soft watercolor textures
- Warm pastel color palette
- Whimsical and dreamy atmosphere
- Rounded shapes, gentle lighting
- Inspired by Oliver Jeffers and Beatrice Alemagna
- High quality print resolution (300 DPI minimum)
- Square format, 21x21cm, full bleed
- NO text in illustrations (text is overlaid separately in layout)
- Leave space for text overlay (position varies by scene)

**Character consistency:**
- Same proportions across all scenes (cartoon style, big expressive eyes)
- Clothing changes only when narratively justified
- Emotional expressions must match scene context
- Character must be recognizable by physical attributes across all pages

## Christmas / Reyes delivery deadlines (block D, 2026-09-29)

- **Page** `/[locale]/christmas-delivery` ("¿Llega a tiempo para Reyes?", es/ca/en/fr, copy in `christmasDelivery` messages): live countdown to the nearest printed cut-off, last order date per format (tapa dura, tapa blanda, PDF) for Nochebuena (24 Dec) and Reyes (5 Jan), península + Baleares (Canarias/Ceuta/Melilla not served, stated), how dates are calculated (honest "estimates" copy), PDF fallback, FAQ (FAQPage JSON-LD), breadcrumb JSON-LD, OG image, sitemap entry. ISR hourly; countdown re-evaluated client-side every minute (Spain time).
- **Date logic** in `src/lib/shipping.ts` (`giftSeason`, `formatDeadlines`, `nextPhysicalCutoff`, `seasonBanner`, `spainToday`): cut-off = deliver-by − max delivery days − `PEAK_BUFFER_DAYS` (today 10 Dec for Nochebuena, 22 Dec for Reyes). A season runs 6 Jan → 5 Jan (rolls over on 6 Jan). Check: `node --experimental-strip-types src/lib/shipping.check.mjs`.
- **Site-wide banner** (`src/components/seasonal/SeasonalBanner.tsx`, rendered by the marketing `Navbar`): visible 1 Nov – 5 Jan, shows the nearest open cut-off, then promotes the PDF once no printed book arrives; hidden on the page itself; dismissible per message (localStorage `meapica.seasonBanner.dismissed`, try/catch + in-memory fallback).
- **Dev preview**: append `?now=YYYY-MM-DD` to any page (ignored in production).
- Linked from the footer and the `gifts/christmas` + `gifts/three-kings` SEO pages.
- **Paywall delivery line** (2026-09-30): `deliveryWindow(today, format)` in `src/lib/shipping.ts` = the customer promise (`PROMISED_BUSINESS_DAYS`, 7–10 business days, not the measured Gelato days) counted from the day after the order, skipping weekends and Spanish national holidays (1/1, 6/1, Good Friday, 1/5, 15/8, 12/10, 1/11, 6/12, 8/12, 25/12). Shown per format next to the CTA as "Llega entre el X y el Y (fecha estimada)"; from 1 Nov the paywall also shows the season cut-off linking to this page.

## Home landing (`/[locale]`, brand refresh 2026-09-30)

Built on `docs/brand.md` + `src/components/ui/*`; components in `src/components/landing/`. Section order
(conversion order: promise → how → pick a story → proof it is theirs → the physical book → objections → close with their name):

| # | Section (component, anchor) | Background | What it does |
|---|---|---|---|
| 1 | `Hero` | paper | H1 + "¿Cómo se llama?" field; the real `LiveCover` (LCP image, `priority`) updates on every keystroke; CTA "Crear el libro de {name}" → `/crear?name=…` (works without JS: GET form). Price "Desde 34,90 € · IVA incluido · Envío gratis" + client-side delivery window. |
| 2 | `HowItWorks` (`#manifesto`) | surface | The five real creation steps illustrated with one example child (Sam, a real showcase book, `HowItWorksExample.ts`); step 1 is an illustration, not an input. Desktop-only CTA. |
| 3 | `BookCollection` (`#catalog`) | paper | 10 worlds, real showcase covers first; age filter chips (radiogroup, arrow keys); carousel < xl, 5-col grid ≥ xl. Each card is one link → `/crear?template={id}&from=catalog` (world preselected); "Ver por dentro" → `/ejemplo/{id}` when a real book exists. |
| 4 | `UniqueEdition` (`#unique-edition`) | surface | "No es una plantilla con su cara pegada": 4 real pages of Sam's book + 4 points; link to Sam's book. |
| 5 | `QualitySection` (`#artisanal`) | paper | Open `BookMockup` + specs table (20 × 20 cm, 170 g, covers, shipping, PDF) + both prices with VAT. |
| 6 | `AdventurePack` | — | Only when `ADDON_ENABLED.adventure_pack` (off). |
| 7 | `FaqSection` (`#faq`) | surface | 7 questions in native `<details>`; answers built from `pricing.ts` / `shipping.ts` (season cut-offs); single `FAQPage` JSON-LD from the same list. |
| 8 | `FinalCta` (`#final-cta`) | paper | Closing line + the same name field as the hero (shared `HeroNameStore`) + live cover → `/crear?name=…`. |
| — | `Footer`, `MobileStickyCta` | brand-deep / — | Sticky "Crear su libro" bar on phones/tablets (< lg): appears after the hero CTA scrolls out, hides over `#final-cta` and the footer; on pages without the hero it appears after 60 % of the first screen. |

Navbar links: Cómo funciona (`/#manifesto`), Cuentos (`/#catalog`), Ver un ejemplo (`/ejemplo`), Preguntas (`/#faq`).
`/crear` reads `?name=` (step 1 prefilled; same name as the saved draft → resume it) and `?template=`.

## Waitlist (Pre-Launch Gate)

The entire site is gated behind a pre-launch waiting list when `WAITLIST_MODE=true`. This allows building an audience and collecting leads before the product is publicly available.

**How it works:**
- A full-screen waitlist page replaces the normal site content for all visitors
- Users submit their **name + email** to join the waiting list
- On submission, a **confirmation email** is sent via **Resend** (currently sending from `constrack.pro` domain; `meapica.com` DNS records pending configuration)
- Subscriber data is stored in the **`newsletter_subscribers`** table in Supabase
- A **live subscriber counter** is displayed on the waitlist page to create social proof
- Available in all **4 languages** (ES, CA, EN, FR) via next-intl

**Team access bypass:**
- A secret access code can be passed as a query parameter to bypass the waitlist gate
- The code is set via the `WAITLIST_ACCESS_CODE` env var
- Once entered, a cookie is set so the team member can navigate freely without re-entering the code

**Disabling the waitlist:**
- Set `WAITLIST_MODE=false` (or remove the env var) to open the site to all visitors

---

## Saga System (Post-MVP)

Three saga types for returning customers:

| Type | Description | Example |
|------|-------------|---------|
| Linear | Continuous story across multiple books | "The Space Chronicles" parts 1, 2, 3 |
| Episodic | Same character, independent adventures | Different templates with the same hero |
| Progression | Character grows/evolves across books | Hero gains skills, companions, achievements |
