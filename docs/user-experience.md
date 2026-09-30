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
  → 5 Su libro        flipbook + ✎ edits in place (sheets), ends on the printed book [/crear/{id}/preview]
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
- Big name field (any Unicode letters, accents, ñ, l·l, apostrophes, compound names; 50-char cap; never rejected). Display form normalised on blur / Next and again server-side in `POST /api/stories` (`formatChildName`, `src/lib/child-name.ts`): first letter of each part capitalised, rest untouched ("xavi" → "Xavi", "pau-joan" → "Pau-Joan", "joan d'arc" → "Joan d'Arc", "maria dels àngels" → "Maria dels Àngels", "XAVI" → "Xavi", "McKenzie"/"JJ" kept), so book, UI, emails and the LLM title spell it the same. Age as 2–12 chips (radiogroup; the youngest book plan is written for 2–4, age 1 is not offered; 2–6 use the "small" avatar band). "Es…": Una niña / Un niño / Prefiero no decirlo (only drives feminine/masculine/neutral wording).
- `LiveCover`: square book cover = template art + "La aventura de" + the name, re-rendered client-side on every keystroke (measured < 100 ms in e2e). Name size scales with length (`coverNameFontSize`), never breaks inside a word. Catalan/French elide "de" before vowels (`L'aventura d'Àlex`). Fonts load `latin` + `latin-ext` subsets.

### 2 · Protagonista ✅

**Components:** `StepProtagonist`, `PhotoUploadPanel`, `ProtagonistAvatar` (pre-rendered `WatercolorAvatar`, vector `AvatarSketch` fallback for combinations not rendered yet)
- **Créalo tú** (default): skin, hair colour, hairstyle (mini-avatar thumbnails), eyes, glasses (none/round/square + dark/red frame), freckles. Portrait swaps instantly with zero network; sticky under the header on mobile, sticky column on desktop.
- **Color favorito** (both tabs, optional): "Sin preferencia" (default) + the 8 `FAVORITE_COLORS` swatches. It leads the whole book palette in print and web (`src/lib/template-colors.ts`: hand-tuned per colour, text roles WCAG-checked on the cream paper) and the jacket colour of the Character Bible; stored in `characters.favorite_color` (null = neutral warm caramel/cocoa palette). World and gender no longer tint the book.
- **Sube una foto** (only when `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED=true`): unchecked parental-consent checkbox gates the picker; the photo is re-encoded client-side to JPEG ≤ 1536 px (drops EXIF, handles HEIC/large phone photos) and posted to `POST /api/characters/photo` (`photo`, `consent`, `consentVersion`, `locale` → `{ photoPath }`). "Quitar la foto" calls `DELETE /api/characters/photo` and resets consent. Server error codes map to `crear.photo.errors.*`.
- On "Siguiente": `POST /api/characters/prepare` fire-and-forget (traits + optional `photoPath`) → `characterPrepId` stored in the draft and sent with the story. Re-sent only when the look changes. A `410 photo_unavailable` clears the photo and asks for a re-upload.
- The old AI portrait screen (`PortraitReveal`) is gone from the flow.

### 3 · Aventura ✅

**Component:** `StepAdventure`
- World picker (10 templates, horizontal scroller on mobile, grid on desktop; "Para su edad" badge from `getRecommendedTemplates`), then chapter 1 → 2 → 3 of the template's branching tree (`story-trees/loaders.ts`, art from `art-manifest.ts`) on the same screen. Each chapter appears after the previous choice and scrolls into view; changing an earlier chapter drops only the choices that no longer follow.
- The cover (sticky on desktop, mini on mobile) switches to the chosen world's art. "Crear su libro" enables once world + 3 chapters are set.
- Creating the story sends the pre-filled dedication (`crear.dedication.default`, "Para ti, {firstName}: …", first given name only, no emoji) so the parent's text is always the verbatim dedication. Back → Create with an unchanged draft reuses the same story (no duplicate book).
- The per-template ending picker was dropped (the LLM closes the story from the chosen path).

### 4 · Dedicatoria (while the preview is painted) ✅

**Route:** `/crear/[storyId]/generar` · **Components:** `LiveCover`, `DedicationEditor`, `useDedicationAutosave`
- Real progress only: polls `GET /api/stories/{id}?light=true` every 3 s and reads the signed `preview_progress { coverUrl?, coverKey?, scenes[{index,url,key}], total }` (images kept while their `key` is unchanged, so polls never swap them). Copy: "usually under a minute" (slow notice after 90 s). Thumbnails: cover first, then the scene slots; the bar counts landed images / (scenes + cover). The first image to land dresses the hero: usually scene 1 (with a "painting the cover" badge), then the painted cover the moment `coverUrl` exists; scene thumbnails fill their scene slot as they arrive; the bar is determinate only when `total` is known (indeterminate otherwise), plus an honest elapsed timer. No fake curve.
- Dedication: pre-filled, rendered live on a page mock, 500-char counter, "De parte de" never pre-filled (inclusive placeholder only; the page mock shows it once typed); autosaved (debounced) to `PATCH /api/stories/{id}/dedication`, stored verbatim; mirrored into the draft.
- When ready: "Ver su libro" (no auto-redirect while the parent is typing). Failure state with retry; Back returns to screen 3 with everything kept.

### 5 · Su libro ✅

**Route:** `/crear/[storyId]/preview` · **Components:** `BookEditSheets` (+ `Sheet`), `PurchasePanel`, `PreviewFaq` (redesign 2026-09-30 after the conversion audit)
- Layout: mobile = title with ✎ + "Vista previa · 3 de 12 escenas" → full-width book → "Ampliar" / "Compartir" pills + "Desliza para pasar de página · Toca una página para ampliarla" → quiet "Cambiar título, dedicatoria o aspecto" links → buy panel → "¿Lo decides más tarde?" → 5 short FAQs. Desktop (lg+) = two columns: title + big book (sized to the viewport height) left, sticky buy panel right with the CTA above the fold at 1440×900. One counter only ("3 de 12 escenas"; the share view shows the spread, "2–3 / 11"); desktop hint "Haz clic en las páginas o usa las flechas ← →".
- **The book is shown as printed on every screen** (redesign 2026-09-30, owner feedback): the cover alone (centred), then two facing pages side by side — same pairing as print (`src/components/book-viewer/spreads.ts`, react-pageflip landscape with `showCover`), with a fold shadow in the gutter. Every page is laid out at 420 px (`BOOK_LAYOUT_PX`) and scaled to the rendered size, so a phone shows a faithful miniature of the real spread (2:1 box across the full width). Phones (and any book with pages under 300 px, e.g. a phone held sideways): swipe turns the spread, **a tap on a page opens it enlarged** (`FullscreenPageViewer`): portrait = that page at full width ("Gira el móvil para ver la doble página"), landscape = the whole spread at screen height, navigation by spread. Desktop: click / arrow keys turn the page. Arrows, progress bar and keyboard move by spread.
- **The web book is the printed book** (2026-09-30, owner request "the PDF exactly as the web"): every viewer (this preview, the example books `/ejemplo/[id]`, the share view) shows the PDF's 34 pages in print order — cover · endpaper · p1 title + dedication · p2–p25 the 12 scene spreads · p26 "Fin" ↔ p27 hero portrait · **p28–29 the adventure map of the book's world with its search-and-find game** · p30 colophon ↔ endpaper · back cover. Pages are drawn from the print plan (`book_plan`, made server-side by the PDF's own planner and fonts: same text, fitted type sizes, drop caps, folios, crops, panorama gradients, cover lockup and back-cover arch) in the PDF's point geometry (`BookPrintPage`), showing the 200 mm trim the reader holds (the digital PDF adds the 4 mm bleed). Book copy ("Fin", "Una aventura personalizada para…", the game) is in the book's language, not the site's. On screen the map game's circles can be ticked (tap/click an item; it never turns the page) — same card as printed. See technical-architecture.md → "Web book = printed book".
- Edits in place, never back to a form: ✎ "Editar" pill on the cover (title sheet with suggestions) and the dedication page (editor sheet, autosave); the links open the same sheets plus the protagonist sheet, whose primary action is now "Dejarlo así" ("Cambiar su aspecto" = secondary, it repaints the whole book). Sheets never autofocus a field on touch screens (no keyboard popping). The old checklist chips are gone.
- The preview ends on two teaser pages (`withTeaserEnd`, `src/lib/preview-teaser.ts`), not on a blank padlock page: "Lo que viene en la historia" (chapters 4–12 + "…y el final: la ficha de héroe de Lucía y el mapa de su mundo, con un juego de busca y encuentra" over blurred art from the book — every ordered book gets the map, the final-image run always paints it) facing the printed book (`BookMockup` of their cover in the selected format) with "Desde 34,90 € · IVA y envío incluidos" and "Elegir formato". 11 pages → every desktop spread is complete. The read-only share view uses the chapters page too.
- "Lo quiero" (desktop) / sticky bar (mobile, first tap scrolls to the formats) lead to screen 6.

### 6 · Formato + pago ✅

- Buy panel (`PurchasePanel`, `#checkout-section`): headline "El libro de Lucía, impreso y en tu casa" + specs "30 páginas · 12 escenas ilustradas · 20 × 20 cm · impreso en Europa"; `BookMockup` of their own cover that follows the chosen format (hardcover ↔ softcover animates, PDF shows tablet + phone; "× 2" badge with the extra copy). Format radios (`#formats`): Tapa dura (preselected, "Ideal para regalar · Solo 15,00 € más que la blanda") and Tapa blanda, each with price + "IVA incluido", "Envío gratis · PDF incluido"; the PDF is a text link "¿Solo el PDF? 9,90 € IVA incluido" (`PDF_AS_LINK` in `PurchasePanel.tsx`, false = three rows). Extra copy = one checkbox line "+ Otro ejemplar para los abuelos · 29,90 € IVA incluido · se imprime a la vez" (price follows the format). Delivery line per format next to the CTA: "Llega entre el 9 y el 15 de octubre (fecha estimada)" + "Envío gratis a España peninsular y Baleares" (`deliveryWindow`: 7–10 business days from today in Spain, weekends + national holidays incl. Good Friday skipped); from 1 Nov the Christmas/Reyes cut-off links to `/christmas-delivery`. Consent = one plain line + checkbox (never pre-ticked). CTA "Pedir el libro de Lucía · 49,90 €" with "IVA y envío incluidos" under it. Trust lines (verifiable only): "Has visto su libro antes de pagar", "Pago seguro con Stripe", "Hecho en Barcelona, impreso en la UE"; "¿Llega dañado o con un defecto de impresión? Te lo reponemos sin coste" (`SHOW_REPRINT_GUARANTEE`, on since 2026-09-30). FAQ help inbox = `SUPPORT_EMAIL` (admin@casmar.tech, interim).
- Mobile sticky bar: "Su libro impreso · desde 34,90 €" / "IVA incluido · Envío gratis" + "Lo quiero" → scrolls to the formats (scroll-margin clears the sticky header) until the parent picks a format themselves; then "{formato} · {total}" + "Pedir el libro" → if the consent is missing it scrolls to it with a soft highlight (never the red error), else straight to Stripe. Hidden while the main CTA is on screen. Stripe Checkout; the creation draft is cleared when checkout starts.
- **"¿Lo decides más tarde?"** (below the buy panel): one heading and three equal options in one card (3 columns on desktop, stacked rows on mobile), each icon + title + one line + action: **Guárdalo** ("Crear cuenta" → signup and back here; logged in: "Ya está guardado" → "Ir a mi biblioteca"), **Compártelo** (`SharePreviewButton` → `POST /api/stories/{id}/share`: mobile opens the OS share sheet with "Mira el cuento que estoy preparando para {name}:" + link, desktop copies it — "Enlace copiado" —, clipboard blocked → link shown to copy by hand; the link works on any phone for 30 days, view only), **Recíbelo por email** (`SendPreviewEmail` inline: field + "Enviar" → `POST /api/stories/{id}/send-preview`, rate-limited 3/h, address not stored; the email carries the same share link). The "Compartir" pill also sits under the book. The FAQ ("Antes de pedirlo") uses the same card and heading style. Copy says "vista previa" (ca "vista prèvia", fr "aperçu"), never "preview".
- **3D book in the buy panel** (`BookMockup rotatable`, `useDragRotate`): drag (touch or mouse) turns the closed book round — spine, page block, and the printed back cover at the extremes (`BackCoverFace`: cream paper, arch vignette of the closing art — the cover until it exists —, title, "Una historia personalizada para {name}", synopsis, brand) — with a slight tilt, inertia and an ease back to the resting pose. Vertical swipes keep scrolling the page (`touch-action: pan-y`). One-time hint "↻ Gíralo" plus a small peek turn until the first drag (`localStorage meapica:mockup-turned`). Reduced motion: no inertia/peek, stays where released.
- **Share view** `/[locale]/preview/[token]`: anyone with the link sees the same book (spreads, tap to enlarge on phones), read-only — cover, dedication, the first 3 scenes and the locked teaser ("El resto del cuento es una sorpresa para {name}" → "Crea el tuyo"). Below: "El resto del cuento es sorpresa" + CTA **Crea el tuyo** → `/crear`, and "¿Es tu cuento? Inicia sesión para terminarlo". No checkout, no editing, no owner data. The owner opening their own link lands on their editable preview. Invalid/expired link → "Este enlace ya no funciona" + "Crea tu propio cuento". Buying the shared book as a gift (third-party purchase) is not offered yet.
- **Opened in another browser**: `/crear/{id}/preview` answering 401/404 (guest session of another browser/device, or another account) shows "Este cuento se abrió en otro navegador" with the way forward (emailed link, log in, or create a new one) instead of a connection error.

---

### Dashboard ✅ IMPLEMENTED

**Route:** `/dashboard`
**Purpose:** Manage books, orders, and characters.

**Implementation:**
- My Books: list of created/purchased stories with status badges
- My Orders (`?tab=orders` opens it; `OrdersTab.tsx`): reference, date, format, extras, total "IVA incluido", address, 4-step print stepper with tracking link (digital orders: "Listo para descargar" instead), invoice, PDF download, "Contactar sobre este pedido" (mailto admin@casmar.tech with the reference), "Comprar otra copia" (printed copy of a finished book at the normal price)
- My Heroes: saved character profiles
- Authenticated route (redirects to /auth/login if not logged in; guests count as logged in)

---

### Profile ✅ IMPLEMENTED

**Route:** `/perfil`
**Implementation:** Edit name, account info, sign out, "Eliminar mi cuenta" danger zone (type the confirmation word → `DELETE /api/account`; blocked with the order reference while a paid order is being produced/shipped). Guests see "Guarda tus libros" (enter email) and a warning before signing out that they lose access.

### Login ✅ IMPLEMENTED (2026-09-30)

**Route:** `/auth/login` (signup/reset/update-password redirect here). Passwordless: enter email → one email with a link and a 6-digit code (type the code on any device) or Google. A guest who logs in keeps their books and orders (in-place upgrade or merge into the existing account). `?email=` prefills (order emails), `next` is preserved and sanitised.

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
