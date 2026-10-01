# Meapica · Creative pack (Meta + TikTok)

Paid social creative for the Q4 2026 gift season. Built on `docs/brand.md` (voice, colours, bans) and the
real product: prices from `src/lib/pricing.ts`, delivery and Christmas cut-offs from `src/lib/shipping.ts`,
example books from the `is_showcase` stories. Last reviewed 2026-09-30.

## 0. Ground truth (only claim what is here)

| Fact | Value | Source |
|---|---|---|
| Prices (B2C, VAT inclusive) | PDF **9,90 € IVA incluido** · Tapa blanda **34,90 € IVA incluido** · Tapa dura **49,90 € IVA incluido** | `pricing.ts` |
| Extra copy (same format, printed together) | 19,90 € (blanda) / 29,90 € (dura) IVA incluido: "Otro ejemplar para los abuelos" | `pricing.ts`, paywall |
| Shipping | **Free** ("Envío gratis" / "Enviament gratuït") to Spain peninsula + Baleares. **Not** Canarias, Ceuta, Melilla | `landingFaq`, `quality.specs` |
| Delivery | 7–10 business days, "fecha estimada"; printed in Europe ("Impreso en Europa", never "en la UE" nor "en España": Gelato may route to non-EU hubs); "Hecho en Barcelona" OK | `shipping.ts`, `product-spec.md` |
| Christmas cut-offs 2026 (both formats, both regions) | **Nochebuena: order by Thu 10 Dec 2026** · **Reyes: order by Tue 22 Dec 2026** · after that, PDF only (arrives by email after payment, "normalmente en menos de una hora") | `lastOrderDate()` = deliver-by − 8 days − 6 buffer |
| Seasonal banner on site | Live from 1 Nov 2026 | `giftSeason().bannerFrom` |
| Free preview | Create the book free, no sign-up; see cover with name, watercolor portrait and the first 3 painted scenes before paying | `landingFaq.previewA`, `PREVIEW_ILLUSTRATION_COUNT = 3` |
| Book | 20 × 20 cm · 30 pages · 12 painted scenes · 170 g paper · matte cover · PDF included with printed book · ages 2–12 · dedication (up to 500 chars, printed as written) · favourite colour leads the palette | `product-spec.md` |
| Creation flow | 6 steps: Nombre → Protagonista → Aventura (world + 3 chapters) → Dedicatoria → Su libro (preview) → Pedido | `crear.header` |
| Reprint guarantee | Arrives damaged or with a print defect → reprinted at no cost | `SHOW_REPRINT_GUARANTEE` |
| No returns | Personalised goods, no withdrawal right. Don't promise "devolución" | terms s.5 |

**Worlds (10):** space, forest, pirates, dinosaurs, superhero, chef, castle, safari, inventor, candy.
Covers: `public/images/templates/{id}.jpg`; path art: `public/images/path/{id}/`.

**Real example books (ES/CA, use only these, always labelled "Ejemplo"/"Exemple", never as a customer):**

| Child (age) | World | ES title → `/es/examples/{id}` | CA title → `/ca/examples/{id}` |
|---|---|---|---|
| Hugo (5) | forest | Hugo y la llave de flor · `1a924f3c-969a-488e-9da8-1164680c57e5` | En Hugo i la clau de flor · `2152a65e-b1f3-4a46-8f96-2c06f906d0a5` |
| Carla (8) | pirates | Carla y el faro dormido · `e1a4d845-42e8-4307-b3d1-23d8bc3058a2` | La Carla i el far adormit · `cd2336ca-ec00-47c5-bb9a-ec91df308301` |
| Pau (11) | space | Pau y la nave dormida · `ddcbef5e-018b-4abe-85a2-626eefab7c11` | En Pau i la nau adormida · `5f59b2ba-b5df-4b7c-bfd7-ae88c2ac03e0` |
| Lao (8) | superhero | Lao, Superhéroe por un Día · `ef70b3ac-f21d-4fe6-8854-2911e10c084e` | Lao, Superheroi per un Dia · `b020aecb-20e0-4bfd-b949-f0f7b96d5b2b` |
| Mani (5) | castle | Mani y el Castillo de los Sueños · `512ce251-3ee4-4508-bee4-d00c1e41e9a9` | Mani i el Castell dels Somnis · `3e596911-c043-40a8-b3fd-743711758c8e` |
| Sam (5) | candy | Sam y la Montaña de Dulce Mar · `fb07048b-4216-4dc5-878b-cb0dd3c24fa2` | Sam i la Muntanya Dolça del Mar · `58d5b66b-191c-4625-bb19-57a052a713b7` |

Hugo is the landing's example; his right-sized art is in `public/images/landing/hugo/` (cover, scene-3 and
scene-8 are 1600×800 panoramas, scenes 5/7/10/11 are 1024² pages).

**Hard rules for every asset:** no testimonials, reviews, star ratings, customer counts, "bestseller",
scarcity or fake UGC; no "IA"/"AI" selling angle; no sparkles/bolts/purple gradients; ≤ 1 emoji per copy;
every price has "IVA incluido / IVA inclòs / VAT included" glued to the number; brand colours only
(paper `#FFF8F0`, ink `#1b120e`, brand orange `#E86C3A` for the one CTA/accent, brand-deep `#5D4037`);
Fredoka for on-screen titles, Plus Jakarta Sans for small text.

**Meta policy guard (personal attributes):** never assert the viewer's status ("¿Eres madre?", "Como abuela…").
Talk about the child in third person ("su nombre", "su cuento") and let the viewer self-select.

---

## 1. Angles

Footage we do **not** have: the physical book in hands, a child's reaction. So every angle is built on what the
screen shows better than a photo would: the name appearing, the painted pages, the choice, the dedication, the date.

| # | Angle | Why it works (and why digitally) | Primary targets | Landing |
|---|---|---|---|---|
| **A1** | **Su nombre en la portada** — type the name, the cover changes live | The name is the product (brand.md). A live screen recording *is* the proof; it is the one moment competitors can't match without sign-up. Highest thumb-stop: viewers mentally type their own child's name. | Parents 28–42 (ES + CA), aunts/uncles/godparents 25–45 | `/{lang}` (hero name field) |
| **A2** | **Lo ves antes de pagar** — free preview, no sign-up, first 3 painted scenes | Kills the #1 objection for a 35–50 € gift bought from an ad ("¿y si no se parece?"). Screen recording of the real flow = demonstrable, not claimed. | Parents 28–42; retargeting of landing visitors | `/{lang}/create` |
| **A3** | **Tú eliges la aventura** — 10 worlds, 3 chapters, written for their age | Turns a purchase into something you do *with* the child at bedtime. Path art and the chapter choice are visually rich and exist today. Separates us from "template with a face pasted in". | Parents 28–42, esp. kids 4–9 | `/{lang}#catalog` or `/{lang}/themes/{theme}` |
| **A4** | **El regalo que abre con tus palabras** — dedication + extra copy for the grandparents' house | Gift-givers want to be remembered as the giver. The dedication page ("para que siempre sepa de quién fue el regalo") is a real feature and a real page. Extra copy is an AOV lever. | Grandparents 55–70, godparents/aunts/uncles 25–50 (ES + CA) | `/{lang}` |
| **A5** | **Llega a tiempo** — real cut-offs: 10 Dec (Nochebuena), 22 Dec (Reyes), PDF after that | Q4 gift buyers buy against a date; honest dates + a live countdown convert and are true. Run from 1 Nov, scale 25 Nov–22 Dec, PDF-only 23 Dec–5 Jan. | All segments, retargeting first | `/{lang}/christmas-delivery` |

Rollout: October = A1 + A2 + A3 (learn which hook wins, cheap CPMs). From 1 Nov add A4 (grandparents) and A5.
A5 copy must be switched off / swapped to the PDF version on 23 Dec (printed cut-off passed).

Geo: ES audience = Spain **excluding Canarias, Ceuta, Melilla** (we don't ship there). CA audience =
Catalunya + Illes Balears (+ Andorra excluded: not served), language targeting "Català" where available.

---

## 2. Meta ad copy

Format: **Primary text** (first line = hook, ≤ 125 chars) / **Headline** (≤ 40) / **Description** / **CTA button** (Meta enum).

### A1 · Su nombre en la portada

**ES**
- Primary: Escribe su nombre y mira cómo aparece en la portada de su cuento.
  Un libro ilustrado a acuarela donde el protagonista es él o ella: su nombre, su cara, su aventura. Impreso en tapa dura o blanda y en tu casa en 7–10 días laborables.
  Desde 34,90 € IVA incluido · Envío gratis.
- Headline: Su nombre, en la portada
- Description: Ves su libro antes de pagar
- CTA: `SHOP_NOW` (Comprar)

**CA**
- Primary: Escriu el seu nom i mira com apareix a la portada del seu conte.
  Un llibre il·lustrat a l'aquarel·la on el protagonista és ell o ella: el seu nom, la seva cara, la seva aventura. Imprès en tapa dura o tova i a casa teva en 7–10 dies feiners.
  Des de 34,90 € IVA inclòs · Enviament gratuït.
- Headline: El seu nom, a la portada
- Description: Veus el llibre abans de pagar
- CTA: `SHOP_NOW`

**EN** (English-speaking families in Spain)
- Primary: Type their name and watch it appear on the cover of their own storybook.
  A watercolor picture book starring your child: their name, their face, their adventure. Printed in hardcover or softcover, at your door in 7–10 working days.
  From €34.90 VAT included · Free shipping in mainland Spain and the Balearics.
- Headline: Their name, on the cover
- Description: See the whole book before you pay
- CTA: `SHOP_NOW`

### A2 · Lo ves antes de pagar

**ES**
- Primary: Antes de pagar un euro, ves su libro: la portada con su nombre, su retrato y las primeras escenas pintadas.
  Sin registrarte y en unos minutos. Si te gusta, lo pides en tapa blanda (34,90 € IVA incluido) o tapa dura (49,90 € IVA incluido), con envío gratis y el PDF incluido.
- Headline: Mira su libro antes de pagar
- Description: Gratis y sin registro
- CTA: `LEARN_MORE` (Más información) for cold · `SHOP_NOW` for retargeting

**CA**
- Primary: Abans de pagar res, veus el seu llibre: la portada amb el seu nom, el seu retrat i les primeres escenes pintades.
  Sense registrar-te i en uns minuts. Si t'agrada, el demanes en tapa tova (34,90 € IVA inclòs) o tapa dura (49,90 € IVA inclòs), amb enviament gratuït i el PDF inclòs.
- Headline: Mira el seu llibre abans de pagar
- Description: Gratis i sense registre
- CTA: `LEARN_MORE` / `SHOP_NOW`

**EN**
- Primary: See their book before you pay a cent: the cover with their name, their portrait and the first painted scenes.
  No sign-up, ready in minutes. If you love it, order softcover (€34.90 VAT included) or hardcover (€49.90 VAT included), free shipping and the PDF included.
- Headline: See their book before you pay
- Description: Free preview, no sign-up
- CTA: `LEARN_MORE` / `SHOP_NOW`

### A3 · Tú eliges la aventura

**ES**
- Primary: ¿Piratas, dinosaurios o el espacio? Elegís juntos el mundo y los tres capítulos de su cuento.
  Cada elección cambia la historia, y el texto se escribe para su edad, de 2 a 12 años. 12 escenas pintadas a acuarela con su cara en cada página.
  Desde 34,90 € IVA incluido · Envío gratis.
- Headline: Tú eliges los tres capítulos
- Description: 10 mundos · de 2 a 12 años
- CTA: `SHOP_NOW`

**CA**
- Primary: Pirates, dinosaures o l'espai? Trieu junts el món i els tres capítols del seu conte.
  Cada elecció canvia la història, i el text s'escriu per a la seva edat, de 2 a 12 anys. 12 escenes pintades a l'aquarel·la amb la seva cara a cada pàgina.
  Des de 34,90 € IVA inclòs · Enviament gratuït.
- Headline: Tu tries els tres capítols
- Description: 10 mons · de 2 a 12 anys
- CTA: `SHOP_NOW`

### A4 · El regalo que abre con tus palabras (grandparents, godparents, aunts/uncles)

**ES**
- Primary: La primera página de su cuento la escribes tú, para que siempre sepa de quién fue el regalo.
  Su nombre en la portada, su cara pintada en acuarela y una aventura hecha para su edad. Tapa dura, 49,90 € IVA incluido, envío gratis. ¿Uno para casa de los abuelos? Otro ejemplar por 29,90 € IVA incluido.
- Headline: El regalo que empieza con tus palabras
- Description: Dedicatoria impresa tal cual la escribes
- CTA: `SHOP_NOW`

**CA**
- Primary: La primera pàgina del seu conte l'escrius tu, perquè sempre sàpiga de qui va ser el regal.
  El seu nom a la portada, la seva cara pintada a l'aquarel·la i una aventura feta per a la seva edat. Tapa dura, 49,90 € IVA inclòs, enviament gratuït. Un altre per a casa dels avis? Un segon exemplar per 29,90 € IVA inclòs.
- Headline: Comença amb la teva dedicatòria
- Description: S'imprimeix tal com l'escrius
- CTA: `SHOP_NOW`

### A5 · Llega a tiempo (run 1 Nov → 22 Dec; PDF variant 23 Dec → 5 Jan)

**ES**
- Primary: Para tenerlo en casa en Nochebuena, pídelo hasta el 10 de diciembre. Para Reyes, hasta el 22.
  Un cuento ilustrado con su nombre y su cara, impreso y con envío gratis a península y Baleares. Tapa blanda 34,90 € IVA incluido · Tapa dura 49,90 € IVA incluido.
- Headline: Para Reyes, pídelo hasta el 22/12
- Description: Mira todas las fechas límite
- CTA: `SHOP_NOW`
- PDF variant (23 Dec → 5 Jan): "El libro impreso ya no llega a Reyes, pero su cuento en PDF sí: te llega por correo tras el pago, normalmente en menos de una hora. 9,90 € IVA incluido." · Headline: "Su cuento en PDF, a tiempo para Reyes"

**CA**
- Primary: Per tenir-lo a casa per Nadal, demana'l fins al 10 de desembre. Per a Reis, fins al 22.
  Un conte il·lustrat amb el seu nom i la seva cara, imprès i amb enviament gratuït a la Península i les Balears. Tapa tova 34,90 € IVA inclòs · Tapa dura 49,90 € IVA inclòs.
- Headline: Per a Reis, demana'l fins al 22/12
- Description: Mira totes les dates límit
- CTA: `SHOP_NOW`
- PDF variant: "El llibre imprès ja no arriba per a Reis, però el seu conte en PDF sí: t'arriba per correu després del pagament, normalment en menys d'una hora. 9,90 € IVA inclòs." · Headline: "El seu conte en PDF, a temps per a Reis"

---

## 3. Video scripts (9:16, 1080×1920)

Production kit (all digital, capture once, reuse everywhere):
- **Phone screen recordings** at 390×844 (iPhone 14/15 viewport) on meapica.shop, in ES and in CA. Use Playwright
  `recordVideo` or iOS screen record; hide status-bar clutter. Record with a demo name, never a real customer's child.
- **Art stills**: `public/images/landing/hugo/*.webp`, `public/images/templates/{world}.jpg`, `public/images/path/{world}/`,
  portraits `public/images/avatar/{boy|girl|neutral}/…`, example books at `/{lang}/examples/{id}` (swipe viewer on mobile).
- **3D book**: the draggable 3D book on the preview screen (`/{lang}/create/{storyId}/preview`) and the harness
  `/{lang}/dev/book-mockup` (dev only, run locally with `npm run dev`).
- **Safe zones**: keep text out of the top 220 px and bottom 420 px (Reels/TikTok UI). One idea per card, Fredoka 64–80 px.
- **VO**: brand voice (the founder or a hired voice), warm, calm; it never says "my son loved it" or poses as a customer.
  Music: soft acoustic/piano from the platform's commercial library.
- End card (all videos): live cover + "meapica.shop" + price line with VAT + CTA text. Burned-in captions always (80 % watch muted).

### V1 · "Escribe su nombre" (A1) · 15 s
- **Hook 0–2 s:** extreme close-up of the empty hero field; a finger types "M-a-r-t-i-n-a" and the cover title changes letter by letter.
- Shots: 0–2 s type name (hero `/{lang}`) → 2–5 s cover fills screen, slow push-in → 5–9 s cross-fade to 3 painted pages (Hugo scenes 5, 7, 10) → 9–12 s cover again with a second name typed ("Leo") to show it's live → 12–15 s end card.
- On-screen ES: "Escribe su nombre" → "Y aparece en su portada" → "Y en cada página de su cuento" → "Desde 34,90 € IVA incluido · Envío gratis"
- On-screen CA: "Escriu el seu nom" → "I apareix a la seva portada" → "I a cada pàgina del seu conte" → "Des de 34,90 € IVA inclòs · Enviament gratuït"
- VO ES: "Escribe su nombre... y ya es el protagonista de su propio cuento." · VO CA: "Escriu el seu nom... i ja és el protagonista del seu propi conte."
- Capture: screen recording of `/{lang}` hero typing "Martina" then "Leo" (CA: "Jana", "Pol"); Hugo scenes 5/7/10.

### V2 · "Antes de pagar" (A2) · 25 s
- **Hook 0–2 s:** phone screen, big text over it: "Esto lo ves GRATIS antes de pagar" (CA: "Això ho veus GRATIS abans de pagar"), cover already painted.
- Shots: 0–2 s hook on finished preview → 2–6 s step 1 name → 6–10 s step 2 protagonist (skin, hair, glasses; portrait updates) → 10–14 s step 3 world + chapters → 14–20 s preview: cover + portrait + first 3 painted scenes, swipe → 20–25 s end card.
- On-screen ES: "Su nombre" · "Cómo es" · "Su aventura" · "Y su libro, antes de pagar" · "Sin registrarte · 34,90 € IVA incluido"
- On-screen CA: "El seu nom" · "Com és" · "La seva aventura" · "I el seu llibre, abans de pagar" · "Sense registrar-te · 34,90 € IVA inclòs"
- VO ES: "En unos minutos ves su libro: su portada, su retrato y sus primeras páginas pintadas. Solo pagas si te gusta." · VO CA: "En uns minuts veus el seu llibre: la portada, el retrat i les primeres pàgines pintades. Només pagues si t'agrada."
- Capture: full run of `/{lang}/create` → `/{lang}/create/{storyId}/preview` at 390 px, sped up 3–4× between steps, real speed on the reveal.

### V3 · "Elegid juntos" (A3) · 20 s
- **Hook 0–2 s:** fast 10-cover flick (all `templates/*.jpg`), freeze on one: "¿Dónde empieza su aventura?" (CA: "On comença la seva aventura?").
- Shots: 0–2 s cover flick → 2–8 s step 3 screen: tap world, then chapter 1, 2, 3 (path art animates) → 8–14 s cut to 2 painted scenes of that world's example book → 14–17 s "Cada elección cambia la historia" → 17–20 s end card.
- On-screen ES: "10 mundos" · "3 capítulos que eliges tú" · "Cada elección cambia la historia" · "Desde 34,90 € IVA incluido"
- On-screen CA: "10 mons" · "3 capítols que tries tu" · "Cada elecció canvia la història" · "Des de 34,90 € IVA inclòs"
- VO ES: "Piratas, dinosaurios o el espacio. Lo decidís juntos, capítulo a capítulo." · VO CA: "Pirates, dinosaures o l'espai. Ho decidiu junts, capítol a capítol."
- Capture: `/{lang}/create` step 3 recording (pirates, to match Carla's book); Carla pages from `/{lang}/examples/{carla-id}`.

### V4 · "No es una plantilla" (A1 proof) · 20 s
- **Hook 0–2 s:** macro zoom into a watercolor page (Hugo scene-7) so the paper texture fills the screen: "Pintado escena a escena" (CA: "Pintat escena a escena").
- Shots: 0–2 s macro → 2–10 s slow Ken Burns across 4 Hugo pages (5, 7, 10, 11) → 10–15 s the panorama spread (scene-8) opened in the 3D book → 15–20 s end card.
- On-screen ES: "No es una plantilla con su cara pegada" · "12 escenas pintadas para su historia" · "Con su pelo, su piel y hasta sus pecas" · "Ejemplo real: el libro de Hugo, 5 años"
- On-screen CA: "No és una plantilla amb la seva cara enganxada" · "12 escenes pintades per a la seva història" · "Amb el seu cabell, la seva pell i fins i tot les pigues" · "Exemple: el llibre d'en Hugo, 5 anys"
- VO ES: "Cada página se pinta para su historia. No es un cuento con su cara pegada: es su cuento." · VO CA: "Cada pàgina es pinta per a la seva història. No és un conte amb la seva cara enganxada: és el seu conte."
- Capture: `public/images/landing/hugo/scene-{5,7,10,11,8}.webp`; 3D book from `/{lang}/dev/book-mockup` with scene-8.

### V5 · "Tus palabras, en la primera página" (A4) · 20 s
- **Hook 0–2 s:** typing on screen, handwritten-feel: "Para Hugo, de sus abuelos…" (CA: "Per a en Hugo, dels avis…").
- Shots: 0–2 s dedication step typing → 2–7 s the printed title/dedication page rendered in the preview → 7–12 s cover + 2 scenes → 12–16 s paywall line "Otro ejemplar para los abuelos" ticked → 16–20 s end card.
- On-screen ES: "La primera página la escribes tú" · "Se imprime tal cual la escribes" · "¿Y otro para casa de los abuelos?" · "Tapa dura 49,90 € IVA incluido · Envío gratis"
- On-screen CA: "La primera pàgina l'escrius tu" · "S'imprimeix tal com l'escrius" · "I un altre per a casa dels avis?" · "Tapa dura 49,90 € IVA inclòs · Enviament gratuït"
- VO ES: "Para que, cuando crezca, sepa de quién fue el regalo." · VO CA: "Perquè, quan sigui gran, sàpiga de qui va ser el regal."
- Capture: `/{lang}/create` dedication step (sender "Los abuelos" / "Els avis") + preview dedication page + paywall extra-copy line (Pedido step).

### V6 · "Cuenta atrás" (A5) · 15 s · live 1 Nov → 22 Dec
- **Hook 0–2 s:** the real countdown on `/{lang}/christmas-delivery`: "Quedan N días" (CA "Queden N dies"), filmed the day you publish.
- Shots: 0–2 s countdown → 2–6 s the two dates as cards → 6–11 s 3D book rotating, name on cover → 11–15 s end card.
- On-screen ES: "Nochebuena: pídelo hasta el 10 de diciembre" · "Reyes: hasta el 22 de diciembre" · "Envío gratis · Desde 34,90 € IVA incluido"
- On-screen CA: "Nadal: demana'l fins al 10 de desembre" · "Reis: fins al 22 de desembre" · "Enviament gratuït · Des de 34,90 € IVA inclòs"
- VO ES: "Si lo quieres para Reyes, tienes hasta el 22 de diciembre." · VO CA: "Si el vols per a Reis, tens fins al 22 de desembre."
- Capture: `/{lang}/christmas-delivery` at 390 px (re-record the countdown weekly so N is true); 3D book from preview. In dev you can preview any date with `?now=YYYY-MM-DD` (never publish a date-faked screen as "today").

### V7 · "De 2 a 12 años" (A3, older kids) · 20 s
- **Hook 0–2 s:** three covers side by side: Hugo 5 · Carla 8 · Pau 11 — "El mismo libro no sirve a los 5 y a los 11" (CA: "El mateix llibre no serveix als 5 i als 11").
- Shots: 0–2 s three covers → 2–8 s Hugo text page (big type, short lines) → 8–13 s Carla text page → 13–17 s Pau text page (richer prose) → 17–20 s end card.
- On-screen ES: "5 años: frases cortas, letra grande" · "8 años: diálogos y misterio" · "11 años: una novela ilustrada" · "Escrito para su edad"
- On-screen CA: "5 anys: frases curtes, lletra gran" · "8 anys: diàlegs i misteri" · "11 anys: una novel·la il·lustrada" · "Escrit per a la seva edat"
- VO ES: "Escrito para su edad: de los primeros cuentos a las primeras novelas." · VO CA: "Escrit per a la seva edat: dels primers contes a les primeres novel·les."
- Capture: text pages from `/{lang}/examples/{hugo|carla|pau}` (screen recording of the mobile viewer). Label "Ejemplos"/"Exemples".

### V8 · "Por qué lo hacemos" (brand creator VO, A2 + A1) · 30 s
- **Hook 0–2 s:** a name typed in the hero, VO cold open: "Esto es lo que ve un padre la primera vez que escribe el nombre de su hija." (CA: "Això és el que veu un pare el primer cop que escriu el nom de la seva filla.")
- Shots: 0–4 s hero typing → 4–12 s creation flow montage → 12–20 s painted pages + portrait → 20–26 s 3D book, both formats → 26–30 s end card.
- VO ES (brand, first person plural, never "a mi hijo le encantó"): "Hacemos Meapica en Barcelona. Queríamos que un cuento personalizado se sintiera de verdad suyo: su nombre, su cara pintada en acuarela y una aventura que eliges tú. Y que lo vieras entero antes de pagar."
- VO CA: "Fem Meapica a Barcelona. Volíem que un conte personalitzat fos de debò seu: el seu nom, la seva cara pintada a l'aquarel·la i una aventura que tries tu. I que el veiessis sencer abans de pagar."
- On-screen: captions of VO + end card "Desde 34,90 € IVA incluido · Envío gratis" / "Des de 34,90 € IVA inclòs · Enviament gratuït".
- Capture: reuse V1/V2 recordings + Hugo art. On TikTok post from the brand account (Spark Ads), not a creator posing as a customer.

---

## 4. Static / carousel concepts (1:1 feed + 4:5 + 9:16 story crop)

**S1 · Carousel "Así es un libro por dentro" (A1/A4) · 6 cards**
1) Hugo cover: "Así es un libro Meapica por dentro" / CA "Així és un llibre Meapica per dins" · 2) title/dedication page · 3) scene-5 "Su cara en cada página" · 4) panorama scene-8 split across cards 4–5 (seamless swipe) · 6) end card price + "Crea el suyo" / "Crea el seu". Caption tag "Ejemplo: Hugo, 5 años".

**S2 · Static "Su nombre aquí" (A1), dynamic creative**
The live cover (forest or space) with 6 name variants rendered from the hero: ES Lucía, Martina, Hugo, Leo, Mateo, Sofía · CA Jana, Martina, Pol, Nil, Arlet, Biel. Line under cover: "Escribe el suyo en meapica.shop" / "Escriu el seu a meapica.shop". Price line with VAT. Let Meta's dynamic creative rotate names.

**S3 · Carousel "3 pasos y lo ves antes de pagar" (A2)**
Card per step, each a real phone screenshot: 1) "Su nombre" 2) "Cómo es" (portrait) 3) "Su aventura" (path art) 4) "Su libro, gratis antes de pagar" (preview) 5) formats: "Tapa blanda 34,90 € IVA incluido · Tapa dura 49,90 € IVA incluido · PDF 9,90 € IVA incluido". CA equivalents from §3 V2.

**S4 · Static deadline card (A5, from 1 Nov)**
Paper background, big Fredoka date: "22 DIC" / "22 DES", sub "Último día para que llegue en Reyes" / "Últim dia perquè arribi per a Reis", small line "Nochebuena: hasta el 10 dic · Envío gratis · Desde 34,90 € IVA incluido", 3D book right. Swap to "Su cuento en PDF, a tiempo · 9,90 € IVA incluido" on 23 Dec.

---

## 5. Naming and UTMs

**Campaign:** `mpc_{platform}_{objective}_{lang}_{season}` → `mpc_meta_sales_es_q4-26`, `mpc_tiktok_sales_ca_q4-26`, `mpc_meta_rtg_es_q4-26`
(platform: meta | tiktok · objective: sales | traffic | rtg · lang: es | ca | en).

**Ad set / ad group:** `{audience}_{geo}_{age}_{placement}` → `parents_es-noCN_28-42_adv`, `grandparents_cat-bal_55-70_fbig`, `gifters_es-noCN_25-50_adv`, `rtg-visitors7d_es-noCN_all_adv`
(`es-noCN` = Spain minus Canarias/Ceuta/Melilla; `cat-bal` = Catalunya + Balears; `adv` = Advantage+ placements).

**Ad:** `{angle}_{format}_{concept}_{lang}_v{n}` → `a1_vid15_typename_es_v1`, `a2_vid25_flow_ca_v2`, `a5_static_22dic_es_v1`, `a1_car_inside_ca_v1`.
Organic posts: `org_{platform}_w{week}{day}_{lang}` → `org_ig_w1mon_es`.

**UTMs** (always lower-case; `lang` is our own param, the path locale must match it):

| Source | Template |
|---|---|
| Meta (URL parameters field) | `utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.id}}&utm_id={{campaign.id}}&lang=es` |
| TikTok | `utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_term=__AID_NAME__&utm_content=__CID__&utm_id=__CAMPAIGN_ID__&lang=ca` |
| Instagram organic | `utm_source=instagram_organic&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=org_ig_w1mon_es&lang=es` (bio link: `utm_content=bio`) |
| TikTok organic | `utm_source=tiktok&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=org_tt_w1wed_ca&lang=ca` |

`utm_content` = the platform ad id (paid) so spend joins cleanly to orders; the human-readable ad name lives in the ad itself.
Example final URL: `https://meapica.shop/ca/create?utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.id}}&utm_id={{campaign.id}}&lang=ca`

---

## 6. Tracking status

Built 2026-09-30 (see `docs/ads/setup-guide.md` and `docs/technical-architecture.md` › Ads tracking): cookie banner (AEPD-compliant), Meta Pixel (PageView, ViewContent, Lead, InitiateCheckout, Purchase), server-side Purchase via Conversions API from the Stripe payment (deduplicated by `event_id`), and UTMs stored on the Stripe session metadata. All of it stays off until `NEXT_PUBLIC_META_PIXEL_ID` is set. No TikTok Pixel: TikTok is organic only at this budget (TikTok Ads minimum is €50/day per campaign).
