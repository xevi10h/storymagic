# Meta promotions Q4 2026: two ads per promotion, A/B on the hook

Owner decisions of 2026-10-26: every promotion runs **two Meta ads** that switch on and off with the promotion.
The only thing that differs between A and B is the **hook**: the first beat of the video (clip, on-screen title and the
narrator's first line, about the first 3 s) and the first line of the primary text. Body, offer, headline, link
description, CTA, landing page, audience, placements, optimisation and budget are identical.

Built 2026-10-26, everything **PAUSED**. Script: `scripts/ads/promos-q4.mjs` (`structure`, `ads`, `verify`);
ids it wrote: `docs/ads/promotions-q4-2026.ids.json`. Video configs: `docs/ads/creatives/promos/make-configs.py`
(writes each `<promo>/hook-<a|b>/video.json` for `scripts/social/render-video.mjs`). Hard rules from
`creative-pack.md` § 0 apply (every price glued to "IVA incluido", no reviews, no invented scarcity, no "IA" angle,
third person about the child, examples labelled as examples).

## Test design (same for all five)

- **One campaign per promotion**, `OUTCOME_TRAFFIC`, ad-set budgets (ABO, `is_adset_budget_sharing_enabled: false`,
  so Meta cannot move money between A and B).
- **Two ad sets**, one ad each: `daily_budget` 5 €/day each (10 €/day per promotion), `LANDING_PAGE_VIEWS`, billing
  on impressions, lowest cost, DSA beneficiary/payor "Meapica". Targeting is copied byte for byte from the live
  warm-up ad set `120252257133430661`: Spain minus Canarias, Ceuta and Melilla (we do not ship there), age 25+
  (Advantage+ audience, suggestion 25-55), Spanish locales, Advantage+ placements.
- **Schedule = the promotion window** (`start_time`/`end_time`, Europe/Madrid). Once the owner sets campaign, ad sets
  and ads to ACTIVE, Meta starts and stops each promotion by itself. Activating after a window has ended does nothing.
- **Ads** made through Zernio `POST /v1/ads/create` (attach shape, `adSetId`) because our Meta app is in development
  mode; each carries the pixel `1830635711690297` ("Meapica web") in `tracking_specs`, the AI disclosure on
  (`aiDisclosure: OPT_IN`, the voice and the lifestyle scenes are generated) and multi-advertiser ads off.
  9:16 is the default video (Stories, Reels and every other placement), the 4:5 cut is pinned to the Facebook and
  Instagram feeds (placement asset customisation).
- **UTMs** on the landing URL: `utm_source=meta&utm_medium=paid&utm_campaign=<promo>_q4-26&utm_content=<ad name>`.
  Zernio adds `zrn={{ad.id}}`.
- **Read-out (7 days after the ad sets start, or at the end of a window shorter than that):** hook rate (3-second
  video plays / impressions), CTR (link), cost per InitiateCheckout (pixel, attributed to the ad). Winner = lower
  cost per InitiateCheckout; if both have fewer than 5 InitiateCheckout, the higher hook rate × CTR. The winner's
  ad set gets both budgets (10 €/day) for the rest of the window and the loser's ad set is paused. A promotion
  shorter than 9 days (Black Friday, Última llamada) is read at day 4 instead. Write the result here and carry the
  winning hook style into the next promotion.

Naming: campaign `mpc_meta_<promo>_es_q4-26`, ad set `..._as_hook-<a|b>_broad-25-55`,
ad `..._ad_hook-<a|b>_<hook name>`.

## 1. Pack Reyes (`pack-reyes`)

- **Offer** (`src/lib/second-book.ts`): every printed book paid until 22 Dec earns one single-use code for a second
  book in softcover at **19,90 € IVA incluido**, valid until 6 Jan (another child or another adventure).
- **Window:** creation (2026-10-26) → **22 Nov 2026 23:59**. Turn on only once the Pack Reyes code is deployed.
- **Landing:** `https://meapica.es/es?utm_source=meta&utm_medium=paid&utm_campaign=pack-reyes_q4-26&utm_content=<ad name>`
  (the seasonal banner announces the pack from 1 Nov; the purchase panel shows it at checkout).
- **Hook A `familia`** (clip: grandmother handing over Martín's book): "Un cuento para cada niño de la familia." ·
  **Hook B `precio`** (clip: Leo's book in wrapping paper): "El segundo cuento, a 19,90 € IVA incluido."
  Hypothesis: a gift-for-every-child framing stops more scrollers than leading with the price; the price hook may
  still win on cost per InitiateCheckout because it pre-qualifies.
- **Shared body (primary text after the hook line):** "Por cada libro impreso que pidas hasta el 22 de diciembre, te
  llevas un código para un segundo cuento en tapa blanda a 19,90 € IVA incluido, para otro niño o con otra aventura.
  Válido hasta el 6 de enero. / Su nombre en la portada y su cara en cada ilustración. Ves la portada antes de pagar.
  Tapa blanda desde 34,90 € IVA incluido, envío gratis a península y Baleares. / Escenas recreadas con nuestros
  libros de ejemplo."
- **Headline:** "El 2.º cuento a 19,90 € IVA incluido" · **Description:** "Ves su libro antes de pagar" · **CTA:** SHOP_NOW.
- **Video body** (same in A and B): Leo's book in hands ("Un cuento con su nombre en la portada…") → the dinosaur egg
  page ("Tú eliges su aventura…") → grandfather reading, title "2.º libro en tapa blanda: 19,90 € IVA incluido" with
  the offer spoken → corporate closing (short) with "Crea el suyo, con su nombre, en meapica punto es."

## 2. Black Friday (`black-friday`)

- **Offer:** the same Pack Reyes, presented as our Black Friday. No price cut, never "rebaja", never a struck-through
  price (the site's banner says "Black Friday: el 2.º libro en tapa blanda a 19,90 € IVA incluido" that week).
- **Window:** **23 Nov 2026 00:00 → 30 Nov 2026 23:59**.
- **Landing:** `https://meapica.es/es?utm_source=meta&utm_medium=paid&utm_campaign=black-friday_q4-26&utm_content=<ad name>`.
- **Hook A `precio`** (wrapping-paper clip): "Nuestro Black Friday: el segundo cuento, a 19,90 € IVA incluido." ·
  **Hook B `familia`** (grandmother clip): "Este Black Friday, un cuento para cada niño de la familia."
  Hypothesis: in Black Friday week people scan for a number, so the price-led hook should win here even if the
  family hook wins in the Pack Reyes test; together the two tests show whether the season changes the answer.
- **Shared body, video body, description and CTA:** identical to Pack Reyes. **Headline:** "Black Friday: 2.º a 19,90 € IVA incluido".

## 3. Historia exclusiva de Reyes, "Paje Real por una noche" (`paje-real`)

- **Product:** the seasonal world `reyes` (`src/lib/story-trees/reyes.ts`), orderable only until 6 Jan; printed in time
  for Reyes until 22 Dec.
- **Window:** **1 Dec 2026 00:00 → 22 Dec 2026 23:59**.
- **Landing:** `https://meapica.es/es/create?template=reyes&utm_source=meta&utm_medium=paid&utm_campaign=paje-real_q4-26&utm_content=<ad name>`
  (the `?template=` entry pre-selects the world).
- **Hook A `reyes-ayuda`** (animated: the three Kings at the window): "Esta Noche de Reyes, los Reyes Magos necesitan un
  Paje Real." · **Hook B `su-nombre`** (animated: the child with Baltasar and the camels): "Este año, el Paje Real de
  los Reyes Magos lleva su nombre." Hypothesis: the story's problem (open loop) holds attention better than leading
  with personalisation; personalisation may click better.
- **Shared body:** "«Paje Real por una noche»: la noche del 5 de enero, los Reyes Magos necesitan ayuda para repartir
  los regalos antes del amanecer. El Paje Real lleva su nombre y su cara en cada ilustración, y tú eliges su
  aventura. / Una historia exclusiva de Reyes: se puede pedir solo hasta el 6 de enero. Para tenerlo impreso en
  Reyes, pídelo hasta el 22 de diciembre. Tapa blanda desde 34,90 € IVA incluido, envío gratis. Ves la portada antes
  de pagar. / Ilustraciones de un libro de ejemplo."
- **Headline:** "Paje Real por una noche" · **Description:** "Historia de Reyes, solo hasta el 6 de enero" · **CTA:** SHOP_NOW.
- **Art:** the example book generated on 2026-10-26 (`artifacts/bench-preview/2026-10-26T15-24-46-888Z`, copied to
  `docs/ads/creatives/promos/paje-real/art/`): an AI example character, no real child; only the text-free scenes and
  the cover art (no Catalan title on it) are used. Two scenes animated with Higgsfield (`clips/kings.mp4`,
  `clips/cover.mp4`); the rest are stills with free motion.

## 4. Última llamada impreso (`ultima-llamada`)

- **Fact:** last day to order a printed book that arrives for Reyes = **22 Dec 2026** (`src/lib/shipping.ts`,
  `lastOrderDate()`, both formats and regions).
- **Window:** **15 Dec 2026 00:00 → 22 Dec 2026 23:59** (overlaps with Paje Real: 20 €/day those 8 days).
- **Landing:** `https://meapica.es/es/christmas-delivery?utm_source=meta&utm_medium=paid&utm_campaign=ultima-llamada_q4-26&utm_content=<ad name>`
  (the live countdown "Quedan N días" is the countdown; a video cannot show a true number of days left).
- **Hook A `fecha`** (Leo in bed with his book): "Para que el libro impreso llegue a Reyes, el último día es el 22 de
  diciembre." · **Hook B `6-enero`** (a child unwrapping Leo's book): "Imagina su cara cuando lo abra el 6 de enero y
  vea su nombre en la portada." Hypothesis: the hard date (loss) beats the outcome picture (gain) in the final week.
- **Shared body:** "Un cuento con su nombre en la portada y su cara en cada ilustración, impreso y con envío gratis a
  península y Baleares. Tú eliges su aventura y ves la portada antes de pagar. / Tapa blanda desde 34,90 € IVA
  incluido. Para que llegue a Reyes, el 22 de diciembre es el último día para pedir el libro impreso. / Escenas
  recreadas con nuestros libros de ejemplo."
- **Headline:** "Para Reyes, pídelo hasta el 22/12" · **Description:** "Después, solo en PDF" · **CTA:** SHOP_NOW.

## 5. PDF + tarjeta regalo de última hora (`pdf-regalo`)

- **Facts:** PDF **9,90 € IVA incluido**, arrives by email after payment, normally in under an hour. Gift voucher
  (`/es/gift-voucher`, `src/lib/promo-codes.ts`): arrives at once by email, ready to print, no expiry; the family
  creates the book later (softcover voucher 34,90 € IVA incluido, shipping included).
- **Window:** **23 Dec 2026 00:00 → 5 Jan 2027 23:59**.
- **Landing:** `https://meapica.es/es/christmas-delivery?utm_source=meta&utm_medium=paid&utm_campaign=pdf-regalo_q4-26&utm_content=<ad name>`
  (after the cut-off it leads with the PDF and links the gift voucher).
- **Hook A `tarde`** (the dedication page of Martín's book): "¿Llegas tarde a Reyes? Su cuento todavía llega a
  tiempo." · **Hook B `una-hora`** (Martín's book next to his jar): "Un regalo de Reyes con su nombre, que
  normalmente llega por correo en menos de una hora." Hypothesis: naming the problem (late) beats naming the
  mechanism (speed).
- **Shared body:** "El libro impreso ya no llega a Reyes, pero su cuento en PDF sí: te llega por correo tras el pago,
  normalmente en menos de una hora. Su nombre en la portada y su cara en cada ilustración. 9,90 € IVA incluido. /
  ¿Lo prefieres en papel? La tarjeta regalo te llega al momento por email, lista para imprimir y dejar con los
  regalos, y la familia crea el cuento después: tapa blanda 34,90 € IVA incluido, envío incluido. / Escenas
  recreadas con nuestros libros de ejemplo."
- **Headline:** "Su cuento en PDF, a tiempo para Reyes" · **Description:** "PDF 9,90 € IVA incluido" · **CTA:** SHOP_NOW.

## Creatives

`docs/ads/creatives/promos/<promo>/<promo>-hook-<a|b>-9x16.mp4` (1080×1920) and `-4x5.mp4` (1080×1350, the 9:16
cropped at y = 230 so the hook title, the captions and the closing stay in frame). Folder is git-ignored; rebuild:
`python3 make-configs.py` in that folder, then `node scripts/social/render-video.mjs <promo>/hook-<v>/video.json`
for each, then the crop (`ffmpeg -i X-9x16.mp4 -vf crop=1080:1350:0:230 -c:a copy X-4x5.mp4`).
Narrator, music bed, captions and the short corporate closing are the social pipeline's (`docs/social/playbook.md`).
Lifestyle clips are the existing Higgsfield scenes in `docs/social/tests/2026-10-07-*` and `docs/social/posts/*/clips`.

## Ids (created 2026-10-26, all PAUSED, verified with Graph the same day)

| Promotion | Campaign | Ad set A / ad A | Ad set B / ad B | Video A / B (s) |
|---|---|---|---|---|
| `pack-reyes` | `120252263165940661` | `120252263168000661` / `120252263480280661` | `120252263169300661` / `120252263498150661` | 27 / 29 |
| `black-friday` | `120252263170800661` | `120252263172680661` / `120252263570490661` | `120252263174090661` / `120252263581320661` | 31 / 28 |
| `paje-real` | `120252263175190661` | `120252263177830661` / `120252263659410661` | `120252263179260661` / `120252263690060661` | 31 / 31 |
| `ultima-llamada` | `120252263180340661` | `120252263181520661` / `120252263935900661` | `120252263182600661` / `120252263947140661` | 29 / 29 |
| `pdf-regalo` | `120252263184250661` | `120252263186750661` / `120252263957690661` | `120252263187760661` / `120252263967750661` | 32 / 33 |

Zernio ad ids are in `promotions-q4-2026.ids.json`. On 2026-10-26 Graph showed every campaign, ad set and ad
`status: PAUSED` (ads `IN_PROCESS` / `PENDING_REVIEW` = Meta's ad review, which runs while paused), budgets `500`,
the windows above, the pixel in each ad's `tracking_specs`, two videos (9:16 default + 4:5 feed rule) and the
landing URL with its UTMs, and the creative's `generative_asset_spec` self-disclosure `OPT_IN`. The first four
Última llamada / PDF ads (price only in a split caption) were deleted and rebuilt with the price + "IVA incluido" in
the beat's title. Paid generation for this batch: two Higgsfield clips for Paje Real (about 1,10 $) and
340 ElevenLabs characters of new narration (account counter 6.708 → 7.048; repeated lines come from `docs/social/.tts-cache`).

## Activation checklist (owner)

1. **Spending limit.** DONE 2026-10-27: monthly account spending limit raised from 300 € to 450 € (resets on the 1st;
   Graph `spend_cap` 45000). The account is prepay, so the API refuses the change: it is done in Billing hub.
2. **Pack Reyes deployed.** Before activating `pack-reyes` / `black-friday`: the second-book code is live in
   production (`src/lib/second-book.ts` is not yet committed), the purchase panel shows it, and from 1 Nov the
   banner on `/es` shows "y el 2.º libro en tapa blanda a 19,90 € IVA incluido" (23–30 Nov: the Black Friday line).
3. **Reyes world deployed.** Before 1 Dec: `https://meapica.es/es/create?template=reyes` opens with "Paje Real por
   una Noche" selected.
4. Set **campaign, both ad sets and both ads to ACTIVE** for each promotion (any time before its window; Pack Reyes
   right after step 2). The schedule does the rest. `pack-reyes` ACTIVE since 2026-10-27 (ads in Meta review,
   `IN_PROCESS`); the other four are still PAUSED.
5. Day 7 (day 4 for Black Friday and Última llamada): read-out above, move both budgets to the winner, note it here.
