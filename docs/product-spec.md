# Product Specification

## Book Format

| Attribute | Value |
|-----------|-------|
| Size | 20×20 cm square (Gelato photobook 200×200 mm), 4 mm bleed |
| Pages | Cover + 30 inner pages; the Gelato inside file also carries the 2 pastedowns glued to the boards (32 pages, pageCount 30 — same as Teo's printed book, order 34d619c2) |
| Binding | Softcover or hardcover (Gelato); PDF-only format too |
| Interior | Full colour, 170 g coated paper |
| Print partner | Gelato (print-on-demand; we ship Spain península + Baleares)
| Print location claim | "Impreso en Europa" / "imprès a Europa" / "printed in Europe" / "imprimé en Europe" everywhere (decision 2026-09-30: Gelato prints >85 % of orders in the destination country but may route to other hubs, some outside the EU — never "en la UE" nor "en España"). "Hecho en Barcelona" stays. Shipping destination is still Spain only |
| Returns / defects | Personalised goods: no right of withdrawal (art. 103 c TRLGDCU), no returns. Free reprint of any book that arrives with a printing/manufacturing defect or damaged in transit (customer writes in with a photo). Shown in the paywall right under the pay button for printed formats (`trustReprint`, `SHOW_REPRINT_GUARANTEE = true`, 2026-10-03), landing FAQ `landingFaq.returnsA`, purchase FAQ, terms section 5, shipping page (2026-09-30) |

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
| 30 | Colophon + QR to meapica.shop (left page alone) |

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
| `interests` | string[] (up to 4) | No | Legacy field: the current create flow does not ask for it (always `[]`). Public copy must not claim the story uses interests, dreams, pets or favourite food (claims sweep 2026-10-02). |
| `city` | string | No | Legacy field: not asked by the current create flow. |
| `favorite_color` | string | No | Favourite colour (hex of `FAVORITE_COLORS`, asked on screen 2, optional). Leads the whole book palette — accents, titles, ornaments, tinted text pages, endpapers, cover/spine deep tone — in print and web (`src/lib/template-colors.ts`), plus the Character Bible jacket. Null → neutral warm palette. |
| `favorite_companion` | string | No | Legacy field: not asked by the current create flow (`future_dream` likewise). |
| `sender_name` | string | No | Gift sender's name (if it's a gift) |
| `custom_dedication` | string | No | Custom dedication message |
| `template_id` | string (slug) | Yes | Selected story template (space / forest / pirates / dinosaurs / superhero / chef / castle / safari / inventor / candy) |
| `photo` | image | No | Child's photo, behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` (off until DPIA + OpenAI DPA). Requires the parent/guardian consent checkbox (`crear.photo.*`). Used ONLY to create the avatar portrait (and early child sheet), then deleted; hourly purge guarantees < 24 h. The book never uses it. |

### Child photo — privacy promise (2026-09-27)
- Public copy: "la borramos en cuanto creamos su personaje (y siempre en menos de 24 horas)"; OpenAI does not train on it and may keep it up to 30 days for abuse monitoring. Privacy policy section 8 "Fotos de menores" (`legal.privacy.section8*`).
- Consent record per photo (`photo_consents`: user, time, `PHOTO_CONSENT_VERSION`, locale), kept after deletion as proof. Bump `PHOTO_CONSENT_VERSION` whenever the `crear.photo.checkbox` copy changes.
- Withdrawal: `DELETE /api/characters/photo` or email to hola@meapica.shop → deleted immediately.
- Pending before enabling: DPIA/EIPD, OpenAI DPA, controller NIF/address in the privacy policy (`[NIF]`, `[DIRECCIÓN]` placeholders).

## Upsells & Add-ons

| Product | Price | Contents |
|---------|-------|----------|
| Pack Aventura Artesanal | +12.90 EUR | Personalized character letter + matte stickers + wooden bookmark |
| Digital PDF (instant) | +5 EUR | Immediate PDF version of the book |
| Second copy (discounted) | +15 EUR | Additional softcover copy |
| Collection discount | 3 books = -20% | Encourage multi-purchase / saga adoption |

Live today: extra copy only (hardcover 29,90 € / softcover 19,90 €, same format, printed at the same time; shown on the paywall as one checkbox line "Otro ejemplar para los abuelos"). After purchase, "Comprar otra copia" in My Orders sells a printed copy of a finished book (a second PDF of the same book is refused). Post-purchase offers (decided server-side in `src/lib/upsell.ts`, recorded in `orders.offer`): **PDF → papel** for PDF buyers, the 9,90 € PDF deducted (hardcover 40,00 € / softcover 25,00 €, IVA incluido, no time limit; shown in the orders tab, on the finished book and in the `book_ready` email); **"¿Una para los abuelos?"** for printed buyers, extra-copy price 29,90 / 19,90 € (IVA incluido) for 60 days after that order, shipped separately (orders tab + `delivered` email); after that, the normal price (34,90 / 49,90 €). Plus ONE reminder email 7 days after a PDF becomes ready ("¿Y si {nombre} tuviera su cuento en papel?", labelled "Oferta"), only if the upgrade is still eligible; cron `/api/cron/upsell-reminders` daily 08:00 UTC, skipped for good after day 10. **LSSI art. 21.2:** every checkout shows an unticked "No quiero recibir ofertas sobre mis libros por email" (`orders.marketing_opt_out`; orders from before it existed are NULL = never offered = no commercial content at all); every commercial block/email carries an unsubscribe link (`/unsubscribe`, confirm button, RFC 8058 one-click) and is omitted for opted-out or suppressed recipients (`email_suppressions`), while the transactional part is still sent. The Pack Aventura is off (`ADDON_ENABLED`), no collection discount.

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

## Free Reyes printables (`/tools`, es + ca only, 2026-10-02)

SEO, link-earning and brand for Christmas/Reyes: two free A4 PDFs, no sign-up, no email gate, zero generation cost.
- **Routes** (English slugs, Spanish/Catalan content): hub `/[locale]/tools`, `/[locale]/tools/letter-to-the-three-kings` ("Carta a los Reyes Magos para imprimir" / "Carta als Reis d'Orient per imprimir"), `/[locale]/tools/reply-from-the-three-kings` ("Respuesta de los Reyes Magos" / "Carta dels Reis als nens"). Only `es` and `ca`: `/en|fr/tools/*` are 404, not in the sitemap; hreflang es + ca + x-default (es); the language switcher sends en/fr to `/gifts/three-kings`.
- **Carta a los Reyes** (`LetterTool`): child's name + a portrait from the pre-rendered watercolour avatar matrix (compact "Créalo tú" picker: gender, age band, skin, hair colour, hairstyle with live thumbnails, glasses, freckles; no photo, no AI). Optional printed age; layout "Sí, con líneas" (writing lines) or "Aún no, para dibujar" (three drawing boxes for 2–5-year-olds). The page: "Este año me he portado…" tick boxes + best thing, "Me gustaría…" 1–3, "Para otros niños y niñas pido…", drawing box, sign-off with the name + signature line. Live paper preview on desktop.
- **Respuesta de los Reyes** (`ReplyTool`): name, portrait (gender drives the grammar), up to 3 achievements (12 presets), an optional own line ("has aprendido a…"), an optional challenge (10 presets), when it is read (5 Jan evening / Reyes morning, changes the text), optional P. D. The letter is composed from hand-written royal-voice templates (`src/lib/tools/reply-templates.ts`, several variants per section, native es and native ca: Carter/Patge Reial, "en Melcior", comma salutation); "Otra versión del texto" rotates the variants; the preview shows exactly the printed text. PDF: double frame, three crowns, portrait medallion, seals + signatures of Melchor/Melcior, Gaspar, Baltasar (vector ornaments, no images besides the portrait).
- **Privacy:** PDFs are rendered in memory by `POST /api/tools/pdf`; nothing is stored, names never logged (stated on the page and in the FAQ).
- **Opt-in:** unchecked "Avísame antes de la fecha límite de Reyes" + email → `/api/newsletter` with `source: "reyes_reminder"` and the locale (consent to that reminder only). No reminder sender exists yet (roadmap).
- **Content:** ~800–1000 words per page and locale (how to write it with children, ideas by age, delivery: buzón real / paje / cartero real / cabalgata; ca: Carter Reial, Patge Reial, Cavalcada, carbó de sucre, tortell), FAQ (FAQPage JSON-LD) + BreadcrumbList, OG images, soft book band (Reyes printed cut-off from `orderCutoffs`, PDF fallback after it, prices with "IVA incluido"/"IVA inclòs", "Crear el libro de {name}" carrying the typed name to `/create?name=`). No mobile sticky CTA on these pages (the download is the one primary action).
- **Links in:** footer "Carta a los Reyes para imprimir" (es/ca), `/gifts/three-kings` hero, `/christmas-delivery` PDF aside, `/llms.txt`. Links out: the other tool, hub, `/gifts/three-kings`, `/christmas-delivery`, `/blog/three-kings-gift-ideas`.
- **Product analytics (PostHog, consent-gated):** funnel landing → `create_step` 1-3 → generate → preview → InitiateCheckout → Purchase, heatmaps and session replays with the child's data masked (see docs/stack.md › PostHog).
- **Analytics (consent-gated `trackEvent`):** `ToolDownload` (GA4 `tool_download` with `tool`, Meta `trackCustom`), `Lead` (GA4 `generate_lead`, `lead_source=reyes_reminder`) on opt-in.

## Guide pages: Catalan, likeness, comparison (SEO/GEO wave 2, 2026-10-02)

Owner-approved positioning: win where Mumablue is weak or where we are different — Catalan written natively, a portrait that resembles the child (built from traits, **never "con foto"**: photo upload is off), the Reyes funnel. Registry `src/lib/guides.ts` (paths, locales, `GUIDES_CONTENT_UPDATED` = sitemap lastmod, footer/hub labels, language-switcher fallback to `/personalized-books`). Copy lives in typed modules `src/lib/guide-copy/{catalan,likeness,compare}.ts` (written natively per locale; facts interpolated from `product-facts.ts` via `guideFacts()`, incl. this season's Reyes cut-off), not in the message files. Shared parts: `src/components/seo-guides/GuideParts.tsx` (hero, price line with "IVA incluido", closing band) + the tools parts (`GuideSections`, `FaqSection`, `RelatedLinks`). Every page: BreadcrumbList + FAQPage JSON-LD, canonical, hreflang only for its own locales (x-default = es), OG image, sitemap, footer "Guías" row, links from the `/personalized-books` and `/gifts` hubs, `/llms.txt`.

- **`/[locale]/personalized-books/in-catalan`** (es + ca; en/fr 404). ca targets "conte personalitzat en català / amb el seu nom / llibre personalitzat per a nens"; es targets "cuento personalizado en catalán" and its CTA opens `/ca/create` (the book is written in the site's language; sticky CTA and name form hidden on the es page so nothing creates a Spanish book). Angles: written in Catalan not translated (personal article check), Sant Jordi / Reis (+ free Carta als Reis), school in Catalan, grandparents' dedication, specs and prices, honest note that the Stripe payment screen has no Catalan. Hero = Noa's real Catalan example (`/ca/examples/{id}`).
- **`/[locale]/personalized-books/looks-like-your-child`** (all 4). The exact traits of the avatar matrix (5 skins, 5 hair colours, up to 7 hairstyles, 6 eye colours, round/square glasses dark/red, freckles, portrait per age band, gender), 6 sample portraits rendered live from the matrix (labelled as samples, not real children), and up to 4 flagged showcase books with cover + portrait + first `PREVIEW_ILLUSTRATION_COUNT` scenes (`getShowcaseLikenessBooks` in `src/lib/showcase.ts`, same filters/public mirror as `/api/showcase/[id]`). "Sin subir ninguna foto" lines render only while `isPhotoUploadEnabled()` is false. Honest line: an illustration that shares their traits, not a copy of their face.
- **`/[locale]/compare`** (es + ca; en/fr 404). Dated table "Datos revisados el 2 oct 2026" Meapica vs Mumablue, Wonderbly, Hurra Héroes: price from, formats, Catalan, languages, shipping, preview, personalisation. Every competitor cell cites a numbered official source (`COMPARE_SOURCES`, list at the bottom with URL + date; raw evidence with quotes in `docs/compare-sources-2026-10-02.json`); unverifiable = "no indicado"; competitor prices "precio mostrado en su web", ours with IVA incluido. Fair sections: where each competitor is better (licences, catalogue, speed, full preview, choose stories, low shipping) and where we fall short (smaller catalogue, partial preview, no express, no Canarias). Micuento left out (micuento.com did not resolve on 2026-10-02, stated on the page). No logos, no disparagement. Re-check all facts and bump `COMPARE_CHECKED_ON` + `GUIDES_CONTENT_UPDATED` before editing any.
- `/ca` home meta description now opens with "Escrit en català" (+ keyword "conte personalitzat en català").

### Catalan cluster (2026-10-09)

Two more guides in the same registry (`src/lib/guides.ts`), **Catalan only** (every other locale 404s; hreflang `ca` + `x-default` = the ca URL; in the sitemap, the footer "Guies" row, the `/ca/gifts` and `/ca/personalized-books` hubs and `/llms.txt`). Each guide can carry its own sitemap date (`updated`) and its own language-switcher fallback (`fallback`). Both emit BreadcrumbList + FAQPage + Product JSON-LD and have an OG image.

- **`/ca/gifts/tio-de-nadal`** ("Regal per fer cagar el tió: un conte amb el seu nom", copy `src/lib/guide-copy/tio.ts`). What the tió traditionally brings and why a book fits, 20 × 20 cm under the blanket, honest note that the story is not about the tió (the dedication can be signed "El tió"), order-by date for 24 Dec from `shipping.ts` + the `DeadlineCards` of `/christmas-delivery`, tió vs Reis, written in Catalan, prices with "IVA inclòs", real Catalan example books, 6 own FAQs (incl. no shipping to Andorra / Catalunya del Nord). Switcher fallback: `/gifts/christmas`.
- **`/ca/personalized-books/in-catalan/by-age`** ("Contes en català per a cada edat", copy `src/lib/guide-copy/catalan-ages.ts`). One section per age band named by school stage (llar d'infants-I4, I5-2n, 3r-6è): how the text changes, the worlds of the band (read from `STORY_TEMPLATES`, each linking to its theme page) and the Catalan example books made for a child of that band; FAQ on lletra de pal vs lligada, which Catalan (standard, as published in Catalunya), reading above age. One page instead of three per-band pages, so it does not compete with `/ca/personalized-books/{band}`, which are already in Catalan.
- **Reis**: no second page. `/ca/gifts/three-kings` got one Catalan-specific section and links to the tió page and in-catalan.
- **Internal links** (`contextGuides` in `guides.ts`, rendered first in the "related" block of `SeoLandingPage`): christmas + three-kings → tió, in-catalan; sant-jordi → in-catalan, by-age; every age landing → by-age (ca). The Reyes tools, in-catalan and every Catalan example page link into the cluster too. `GuideSection` accepts an optional `link` under its paragraphs.
- **Head term**: the `/personalized-books` hub (es/ca) now leads with "Libro personalizado para niños" / "Llibre personalitzat per a nens" in title, H1, intro and meta description; the home carries it in the meta description and the "El libro impreso" subtitle. "Cuento personalizado" stays in the home title and H1.
- Product JSON-LD also on `/compare` and in-catalan (offers `url` = the page).

## Product facts, structured data and llms.txt (SEO/GEO pass, 2026-10-01)

- **Single source of truth:** `src/lib/product-facts.ts` derives every public fact from the code that runs the product: prices (`STRIPE_CATALOG`, VAT-inclusive), delivery promise (`PROMISED_BUSINESS_DAYS` 7–10 business days, exposed as `DELIVERY_PARAMS` in `shipping.ts`), coverage (peninsula + Baleares; no Canarias/Ceuta/Melilla), ages (2–12 from the template ranges; bands `AGE_BANDS` 2-4 / 5-7 / 8-12 also drive the catalog filter and `/personalized-books`), book specs (20 × 20 cm, 30 pages = Gelato `INNER_PAGE_COUNT`, 12 scenes, 170 g), returns (no withdrawal, defect reprint within 30 days), contact email (`CONTACT_EMAIL` = `SUPPORT_EMAIL`, TODO swap to hola@meapica.shop). Messages quote facts through ICU params (`COPY_PARAMS` / `factParams()`: `{minDays}` `{maxDays}` `{ageMin}` `{ageMax}` `{pages}` `{scenes}` `{size}` `{paper}` `{hardcover}` `{softcover}` `{pdf}`), never hardcoded numbers; template age badges render `data.ageRange` from `ageMin`/`ageMax`.
- **Measured vs promised delivery:** customer copy promises 7–10 business days; the Christmas/Reyes cut-offs use the measured Gelato 7–8 calendar days + 6-day buffer (`/christmas-delivery` "Cómo calculamos" states both).
- **JSON-LD** (`src/components/seo/JsonLd.tsx`): Organization (logo, email, contactPoint, Barcelona/ES, `hasMerchantReturnPolicy` = MerchantReturnNotPermitted + legal link; `sameAs` only when `SOCIAL_PROFILES` has real profiles). Product on the home and on every programmatic SEO landing (gifts / ages / themes; same Product, offers `url` = the page carrying it, 2026-10-03): real showcase covers as `image` (fallback template art), offers for hardcover / softcover / PDF with `valueAddedTaxIncluded: true`, `url` = the indexable home (not noindex `/create`), printed offers carry `shippingDetails` (0 €, ES postcode ranges excluding 35/38/51/52, 7–10 business days) and every offer the return policy.
- **SEO landings** (`SeoLandingPage` / `HubPage`): every page has its own FAQ (`seo.{type}.{slug}.faq.q1..a4`) with FAQPage JSON-LD; optional long-form `sections` (three-kings, christmas, `/personalized-books` hub); three-kings and christmas show this season's order-by cards (`DeadlineCards`) and revalidate daily. Keyword split: three-kings = "regalo de Reyes personalizado", christmas = "cuento personalizado de Navidad" (Nochebuena/Papá Noel; ca Tió), `/christmas-delivery` = deadlines. Baptism and first-birthday are framed as keepsakes to read from age 2 (youngest template).
- **Titles:** home "Cuento personalizado para niños con su nombre | Meapica" (ca/en/fr equivalents); the hero H1 contains the head term (eyebrow) + the brand line. `/create`, `/auth/*`, `/checkout/*` have their own noindex titles (`metadata.pages`).
- **Example books** (2026-10-03): `/[locale]/examples/{slug}` (slug from the printed title, e.g. `/es/examples/noa-y-la-llave-de-flor`, `/ca/examples/la-noa-i-la-clau-de-flor`) are indexable, server-rendered (story text in a "Leer el cuento completo" block, always labelled "Ejemplo"), Book + BreadcrumbList JSON-LD, hreflang between the 4 editions of the same book, in the sitemap. Since 2026-10-09 the page also server-renders the book's real art (cover + every ready scene, panoramas 2:1) as `<img>` with a localised alt ("Ilustración en acuarela del cuento personalizado «…», escena 3: …"), visible breadcrumbs, up to three other examples (`ExampleBookCard`, shared with the index), related links (the world's theme page, the child's age page, gifts hub, in-catalan, likeness, all examples) and the site `Footer`. The compact reader header stays instead of the marketing `Navbar` on purpose: the book needs the height and the Navbar's language switcher keeps the path, which 404s here because each locale edition has its own slug. **Sitemap lists only `es` and `ca` URLs** (2026-10-03, `SITEMAP_LOCALES` in `src/app/sitemap.ts`): we ship to Spain only and Google was spending the young domain's crawl on en/fr; those pages still exist, are indexable and keep hreflang. Old `/examples/{uuid}` links 308 to the slug. Blog index: Blog/CollectionPage JSON-LD with its BlogPostings. og:image:alt localized on every share image; `/legal` has its own share image. robots.txt has no `Host:` line. `/llms-full.txt` is not served (nothing links to it; 404 is correct).
- **`/llms.txt`** (`src/app/llms.txt/route.ts`, ISR daily): what Meapica is, prices with IVA incluido, formats, ages, languages, delivery and coverage, this season's cut-offs, returns, key URLs, contact; generated from the same constants.

## Home landing (`/[locale]`, brand refresh 2026-09-30)

Built on `docs/brand.md` + `src/components/ui/*`; components in `src/components/landing/`. Section order
(conversion order: promise → how → what the gift really is (emotion) → pick a story → proof it is theirs → the physical book → objections → close with their name).
Copy strategy (2026-09-30 emotion pass): every section is clear first, then carries one true emotional moment of the gift (the first look at their name, the bedtime "otra vez", the dedication they will reread as adults, a keepsake that outlives toys). Headline ES: "El cuento que te pedirá otra vez"; the sub says in one line what it is (name on the cover, watercolor face, adventure you choose, printed and home). Copy that follows the typed name: hero cover caption, `Moments` title/texts/dedication, `FinalCta` title ("El libro de Lucía empieza aquí.").

| # | Section (component, anchor) | Background | What it does |
|---|---|---|---|
| 1 | `Hero` | paper | H1 + "¿Cómo se llama?" field; the `LiveCover` (LCP image, `priority`, `alt` = `hero.coverAlt`) shows Noa's real painted cover (`LANDING_EXAMPLE.coverSrc`, printed-front layout `titleAt="top"`: "La aventura de Noa", caption "Ejemplo: el cuento de Noa, 4 años") and the title updates with the typed name on every keystroke (art stays Noa's); phone cover sized so CTA + price line fit the first screen of an iPhone 14 (390 × 664 visible); CTA "Crear el libro de {name}" → `/create?name=…` (works without JS: GET form). Price "Desde 34,90 € · IVA incluido · Envío gratis" + client-side delivery window. |
| 2 | `HowItWorks` (`#manifesto`) | surface | The five real creation steps illustrated with one example child (Noa, 4, forest world — a real showcase book in all 4 locales, `HowItWorksExample.ts`; its `gender` drives the Catalan personal article "de la Noa" / "d'en …" via an ICU select in the landing strings); step 1 is an illustration, not an input. Desktop-only CTA. |
| 2b | `Moments` (`#moments`) | brand-deep (full-bleed, the page's one warm dark band) | "Lo que de verdad le regalas (a {name})": three moments on paper cards, each with real art: the cover with the typed name (`LiveCover`; before a name, the example child's real painted cover) + a quiet "Escribe su nombre y míralo aquí" button that focuses the hero field; bedtime ("«Otra vez»"), watercolor `public/images/landing/bedtime.webp` (generated 2026-09-30, fal `flux-2/edit` with book art as style reference, no real person); the title + dedication page (p1 layout) with an example dedication labelled "Dedicatoria de ejemplo". Scroll-in reveal (`Moments.module.css`, cover tilt-and-rise), off with `prefers-reduced-motion`; content visible without JS. No CTA (sticky bar covers phones). |
| 3 | `BookCollection` (`#catalog`) | paper | 10 worlds, real showcase covers first (today space, pirates, forest, dinosaurs and castle — see curation note below); age filter chips (radiogroup, arrow keys); carousel < xl, 5-col grid ≥ xl. Each card is one link → `/create?template={id}&from=catalog` (world preselected); "Ver por dentro" → `/examples/{id}` when a real book exists. |
| 4 | `UniqueEdition` (`#unique-edition`) | surface | "No es una plantilla con su cara pegada": 4 real pages of Noa's book + 4 points; link to Noa's book. |
| 5 | `QualitySection` (`#artisanal`) | paper | Open `BookMockup` + specs table (20 × 20 cm, 170 g, covers, shipping, PDF) + both prices with VAT. |
| 6 | `AdventurePack` | — | Only when `ADDON_ENABLED.adventure_pack` (off). |
| 7 | `FaqSection` (`#faq`) | surface | 7 questions in native `<details>`; answers built from `pricing.ts` / `shipping.ts` (season cut-offs); single `FAQPage` JSON-LD from the same list. |
| 8 | `FinalCta` (`#final-cta`) | paper | Closing line + the same name field as the hero (shared `HeroNameStore`) + live cover → `/create?name=…`. |
| — | `Footer`, `MobileStickyCta` | brand-deep / — | Sticky "Crear su libro" bar on phones/tablets (< lg): appears after the hero CTA scrolls out, hides over `#final-cta` and the footer; on pages without the hero it appears after 60 % of the first screen. |

Navbar links: Cómo funciona (`/#manifesto`), Cuentos (`/#catalog`), Ver un ejemplo (`/examples`), Preguntas (`/#faq`).
`/create` reads `?name=` (step 1 prefilled; same name as the saved draft → resume it) and `?template=`.

**Showcase curation (which real books the public sees).** The single source of truth is the DB flag `stories.is_showcase` (+ status `ready`/`ordered`, `SHOWCASE_STATUSES` in `src/lib/showcase.ts`). It drives every public surface at once: the landing `BookCollection` cards and "Ver por dentro" (`/api/showcase`), the `/examples` index and `/examples/{id}` viewer (`/api/showcase/[storyId]`), and the SEO pages built on `SeoLandingPage` (themes / personalized-books / gifts). A world without a flagged book falls back to its template art with no "Ver por dentro"; an unflagged `/examples/{id}` shows "Cuento no encontrado". Rule (owner, 2026-09-30): **only flag a book after a page-by-page art + text review in every locale** — consistent protagonist and companions, no anatomy/duplicate-character/logic errors (e.g. a landmark visible from inside itself), text matching the pictures, no typos, print resolution (≥ 2400 px; the 1024 px March-2026 books do not qualify), no watermark/signature marks, no third-party IP lookalikes. When in doubt, leave it unflagged. **Rule (owner, 2026-09-30, showcase v2): examples must be generated by the current production pipeline — the same code path, models and premium final render a paying customer gets (Book Plan → preview session → `advanceFinalImages` with its QA judge + repairs, "Créalo tú" avatar-matrix face anchor) — and pass a page-by-page human QA of art and text in every locale before they are flagged.** Fixes use the customer paths only: per-image repair/re-render through `advanceFinalImages`/`repairShot` (same prompts and sheets) and text edits of `generated_text`. Translations follow the Hugo model: one row per locale sharing the ES art rows, `story_decisions.showcaseTranslationOf` = ES id, translated scenes/title/synopsis/final message/dedication/signature/map-game labels. Current flagged set (showcase v2, 2026-09-30, 20 rows, owner user `showcase+examples@meapica.com`): **space** — Martí, 7 (medium-light skin, short brown hair, round dark glasses, red jacket): es `31ada3cf-f98d-40f3-b978-d5f84ee99ef1`, ca `63c2b7fc-5c4d-494c-b4a1-95087786c470`, en `f9b0ae87-c2e4-4b20-8870-4f6b7eb8c9d5`, fr `ac800cb9-debb-4558-ab31-8132d7a00040`; **pirates** — Aitana, 6 (medium skin, dark-brown braids, teal jacket): es `5f4ace1a-0f90-4e2c-bf72-9f2a15ff84a6`, ca `a9e6218a-3633-4681-92ec-900e2b43c6cb`, en `aa034b64-77da-432f-9fff-b5cb246bce7a`, fr `779057b7-595b-4a0b-9855-d354c26e6652`; **forest** — Noa, 4 (light skin, red curls, freckles, green eyes, yellow jacket; the landing example): es `bc6e2dbd-fd14-4c5d-a9d0-07b10cffdbf2`, ca `5dfc4f5e-9a42-4ae5-a42b-a821d36c2f01`, en `602106d0-7b6d-4f6b-a862-bedb0eb6debc`, fr `7294b4d0-ecd1-4dcb-a744-faead62d58ba`; **dinosaurs** — Leo, 5 (dark skin, black afro, orange jacket): es `159f5965-7601-478d-8590-cda0d8253d62`, ca `fd5512f6-527e-4f2b-b344-749b8e0d3cfe`, en `62a6cde5-6c4c-47bd-bef2-9ea94ffb82a4`, fr `3d582903-f954-4a3e-b6ff-84f4c98051b3`; **castle** — Lucía, 9 (very dark skin, long black hair, plum jacket): es `461c6578-404b-4362-8dff-afcae81f6141`, ca `cbe54fa8-bbd2-4511-b08a-64e6fc079d4a`, en `b8e7eed9-b151-469b-bfdb-9298d12a2650`, fr `86146e9f-ad8c-42a5-acaf-2fac742c3ef9`. Retired (unflagged 2026-09-30, data untouched): Hugo/forest ×4 (`1a924f3c…`, `2152a65e…`, `2b1d4dfb…`, `305c2236…`; older pipeline, replaced by Noa). Still unflagged: Carla/pirates ×4 (a second lit lighthouse outside the lighthouse window, scenes 7 & 11), Pau/space ×4 (text "one sock on / sneaker left under the bed" vs sneakers in every picture; fr scene 10 "son souffle, trop petite"), and all March-2026 books — Lao/superhero ×4, Mani/castle ×4, Sam/candy ×4, Teo, Luna, Mia ×2 (1024 px art, protagonist drift, duplicated child, signature marks, Star Wars-like droid). The example PDF (`/api/showcase/[id]/pdf`) prints the same pages as the customer's: p. 27 hero portrait (`imageAssets.finalHero`) and pp. 28–29 adventure map + game, mirrored by `scripts/publish-showcase.mts`. After re-flagging, run `scripts/publish-showcase.mts` so the images reach the public bucket.

### Cookie consent + ad measurement (2026-09-30)

When ads tracking is on (`NEXT_PUBLIC_META_PIXEL_ID` and/or `NEXT_PUBLIC_TIKTOK_PIXEL_ID` set), first-time visitors see a small cookie notice (bottom; a full-width bar below 1024 px, a bottom-left card from 1024 px that sits just above the creation footer so it never covers "Atrás") with **Rechazar / Aceptar** at equal weight and a link to `/legal#cookies`. As a bar the notice is at most three lines of text plus one row of buttons (third parties are named in the settings layer and in the cookie policy, 2026-10-08) and it never covers a bottom bar: it publishes its height as `--cookie-banner-h` and the creation "next" bar, the preview buy bar and the landing sticky CTA sit on top of it (`body` keeps the same room at the end of the page). Rejecting keeps the site fully usable. "Configurar cookies" in the footer reopens it; withdrawing deletes the ad cookies. Only with consent: Meta and TikTok pixel events (view, story chosen, preview emailed, checkout started, purchase), the purchase sent server-side to Meta and TikTok, and the visit's UTMs attached to the order in Stripe. Legal texts (cookies + privacy, 4 locales) list Meta Platforms Ireland, TikTok Technology Limited and the consent basis.

## Abandoned-preview reminders (2026-10-03)

Where the parent previews the book (`/create/<id>/preview`), the "¿Lo decides más tarde?" › "Recíbelo por email" option sends
the preview link (transactional, nothing stored) and offers an **unticked** box "Recuérdamelo por email: como mucho 3 avisos sobre
este cuento en 3 días…" with a link to the privacy policy. The account email is prefilled for signed-in parents.

- **Legal basis:** express consent (LSSI art. 21.1 + RGPD art. 6.1.a). Before this, an address given at preview was not stored and
  the passwordless-login address was collected for the account only, so neither allowed commercial follow-ups (art. 21.2 needs a
  prior purchase). Proof of consent in `preview_reminders` (date, locale, text version `PREVIEW_REMINDER_CONSENT_VERSION`, source).
  Privacy policy §4 + §5 updated (4 locales, "Última actualización" 2026-10-03).
- **Sequence:** 1 h, 24 h, 72 h after the consent (reminder 1 "sigue aquí", 2 "¿cómo acaba?" with prices IVA incluido, 3 "último
  aviso"), each with the cover, the share link and the nearest printed-book cut-off from `src/lib/shipping.ts` (only within 75 days
  of it; after the last cut-off and before Reyes: "el PDF sí llega"). Never 22:00-08:00 Spain time; an overtaken reminder is skipped
  (one email per run); nothing after consent + 120 h.
- **Stops:** paid order / story past preview (`purchased`), address in `email_suppressions` (`unsubscribed`: one-click
  List-Unsubscribe + link in every email + the preview email itself), story gone or back to draft (`story_unavailable`), too late
  (`expired`). Max 3 emails per story ever (re-submitting never restarts a sequence). Unsubscribing suppresses the address for all
  commercial email (also the PDF → papel reminder).
- Languages: es / ca / en / fr (story locale of the request). Kicker "Recordatorio" + seller identity in the footer (LSSI 20.1).

## Referral programme "10 € y 10 €" + gift vouchers (2026-10-09)

Rules in `src/lib/promo-codes.ts` (pure, checked by `src/lib/promo-codes.check.mjs`); server code in `src/lib/growth/`.

- **Referral:** every paid book order (PDF or printed) gets one personal code (`MEA` + 6 chars), a Stripe promotion
  code on coupon `meapica_referral_10` (10 € off, applies only to the softcover/hardcover book products, so never the
  PDF, extra copies or upgrades; max 20 uses per code). Shown: QR + code + one line on the **last inner page**
  (colophon, replaces the plain meapica.shop QR; book locale), a commercial block in the order confirmation,
  `book_ready` and `delivered` emails (only with marketing permission + unsubscribe link, LSSI 21.2), and the
  library order card ("Copiar enlace"). Link `/<locale>/r/<code>` sets cookie `meapica_ref` (30 days, httpOnly) and
  redirects to `/create`; `/api/checkout` pre-applies it to a printed book (Stripe `discounts`, the code field is then
  hidden) unless it is the buyer's own code; an unusable code falls back to a normal checkout.
- **Reward:** when an order paid with a referral code is paid (webhook), the referrer gets a single-use 10 € code
  (`MEA` + 10, same coupon, 12 months) by email, once per referred order. No reward for own orders (same email,
  account or Stripe customer) nor when the buyer already had a live order (returning customer).
  Known gap: a refund after the reward does not revoke it (deactivate by hand in Stripe).
- **Gift voucher** (`/gift-voucher`, linked from the footer and the Christmas delivery page): buy a voucher for one
  format (hardcover 49,90 €, softcover 34,90 €, PDF 9,90 €, IVA incluido) with optional recipient name (40) and
  message (240). Stripe Checkout sells catalog items `voucher_*` (same amount and tax code as the book: single-purpose
  voucher, VAT at sale). On payment (webhook or thanks page, idempotent): `gift_vouchers` row, single-use code
  (`MEA` + 10) on the 100 % coupon of that format, no expiry (owner decision 2026-10-10), email to the buyer with a printable card
  (`/<locale>/gift-voucher/card/<signed token>`) and the invoice link. Redeeming = typing the code at the book
  checkout → 0 € order → normal fulfilment (Checkout still collects the shipping address). A full refund
  (withdrawal within 14 days) deactivates the code and issues the credit note. Terms: legal page, terms §7 and §8.
- **Fail soft:** until `scripts/stripe-setup-catalog.mts` has created the coupons/prices on the active account, no
  referral codes are minted (plain QR, no email block) and the voucher page shows "coming soon".

## Waitlist (Pre-Launch Gate)

The entire site is gated behind a pre-launch waiting list when `WAITLIST_MODE=true`. This allows building an audience and collecting leads before the product is publicly available.

**How it works:**
- A full-screen waitlist page replaces the normal site content for all visitors
- Users submit their **name + email** to join the waiting list
- On submission, a **confirmation email** is sent via **Resend** (currently sending from `constrack.pro` domain; `meapica.shop` DNS records pending configuration)
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
