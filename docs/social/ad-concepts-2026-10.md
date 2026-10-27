# Ad concepts, parent and child (2026-10-27)

Owner's brief: real-feeling sentimental scenes of a parent (or grandparent) with the child, different situations, AI
actors with visible faces. Research behind it: docs/social/research/2026-10-27-ad-video-research.md.

Rules for every concept:
- 20-30 s, 9:16, hook in the first 2 s, captions on, nothing in the bottom 35 % (Reels CTA) or top 14 %.
- Handheld, warm home light, natural Spanish dialogue with lip sync; soft music under it. Looks filmed by a family, not a studio.
- The book is ours: real cover with the child's name composited into the start frames, real rendered pages as inserts.
  The model never draws the book interior.
- Dramatisation, not a testimonial: nobody says "I bought it", no ratings, no invented numbers. Caption and a small
  on-screen line say "Escena dramatizada generada con IA".
- End card 3 s, not 5: cover + "Su cuento. Con su nombre y su cara." + "Desde 34,90 € IVA incluido".
- Different family per concept (age, look, mum/dad/grandparent) so the ad set has really different creatives.

## Least-AI pass (every ad, before generating and before showing it; owner 2026-10-27)
Viewers commented "basura de cuenta IA" on the first ads. Every ad goes through this pass twice: on the start frames and
on the finished cut (contact sheet + transcript). Anything that fails is regenerated, not shipped.
- **People**: ordinary faces, not models. Uneven skin, messy hair, ordinary clothes. No perfect teeth or symmetry, no beauty light.
- **Room**: a real Spanish flat with clutter: toys on the floor, a mug, cables, a radiator, mixed light (lamp + TV or
  window). No catalogue sofa, no symmetric lamps, no amber "golden hour" grade on everything.
- **Camera**: phone video by the other parent: off-centre, slightly too close or cut off, a little shake, focus that
  hunts. Not a framed cinematic shot.
- **Acting**: small reactions. No cartoon gasp, no wide-eyed wonder pose, no tears on cue. Better a look than a line.
- **Voices** (the owner's main complaint): native Castilian Spanish from Spain (never neutral or Latin American),
  conversational and unpolished, matched to age, the SAME voice for a character in every shot. Child lines short and mumbled
  rather than declaimed. Announcer or narrator voices are an AI tell inside a home scene. Pick voices tagged `conversational`, not `advertisement`.
- **Dialogue**: one or two short lines per ad at most. Lip-synced speech is the biggest tell, so let faces and room sound
  carry it.
- **Sound**: room tone and real noises first, quiet music under it, no swelling score.
- **Book**: the real cover composited, real pages as inserts, any model-drawn page blurred.
- Disclosure stays: "Escena recreada con IA" in the ad copy.

## Ten-ad slate for testing (2026-10-27, owner asked for other approaches)
Ten genuinely different concepts, one angle each, so Meta can tell them apart. Every one passes the least-AI pass;
voices ElevenLabs (child: Leo), video Higgsfield (Seedance 2.5). No testimonials, ratings or invented numbers.
Already made, to rebuild with the least-AI pass (as `ads/soy-yo-real/`):
1. «¡Soy yo!»: the reveal on the sofa. Angle: the child's reaction. Pilot done.
2. «La abuela escribió la primera página»: grandparents as the buyer, the real dedication page. Angle: grandparent gift.
3. «Si decides entrar en la cueva…»: dad's 90s gamebook, now his daughter chooses. Angle: parent nostalgia.
4. «Unos años más»: bedtime, "one day she'll stop asking me to read". Angle: time passing.
5. «Mañana de Reyes» (from 15 Nov): 6 January morning, the book under the tree, real order-by date. Angle: occasion + deadline.
New approaches:
6. «Así llega a casa» (real footage, zero AI): hands open the real printed book, slow page flip with paper sound,
   cover with the name. Angle: product proof, the category's best format. Needs a printed book and 1 min of phone video.
7. «¿Lo reconoces?»: a photo of the child (AI actor, disclosed) turns into his illustrated hero, then three adventures.
   Angle: the product's magic in 3 s, no screen recording.
8. «¿Sale su nombre?»: covers with popular names (Hugo, Lucía, Martín, Sofía…) flick past; "escribe su nombre en
   comentarios". Angle: personalisation + participation; replies are done by hand.
9. «POV: el tío que siempre regala lo mismo» (lo-fi, TikTok native): on-screen text joke over real pages and a trending
   sound. Angle: humour, the gift-giver's pain.
10. «No quería leer»: a child alone, absorbed in a book where he is the hero; one line from mum. Angle: reading habit
   (parent problem, not gift).
Paused: «La hermana mayor» and «Doce años después» (too close to 1 and 4).
Owner 2026-10-27: everything AI-generated, no real footage (so #6 is staged with AI hands). First batch 1 + 2 + 6 + 7,
built the same day, each `node docs/social/ads/<folder>/build.mjs`:
- #1 `soy-yo-real/` (`VOICE=leo`) → `seedance25-leo/video.mp4`, 18.5 s.
- #2 `la-abuela-real/` → `cut/video.mp4`, 19 s; grandmother = ElevenLabs Rosa `ypIbR1aohyRSdDv25DPr` (the line says
  «Anda, ábrelo» because Rosa misreads a bare «Ábrelo» as «Hebreo»).
- #6 `asi-llega/` → `cut/video.mp4`, 17 s; hands only, no dialogue, ElevenLabs sound effects in `sfx/` (`cfg.sfx` in
  the builder). Hook «Su cuento, ya en casa», not «Así llega…»: the box is staged, so no claim about real packaging.
  Clip C (page turning) was dropped: the model drew a text novel.
- #7 `lo-reconoces/` → `cut/video.mp4`, 16 s; Seedance first + last frame (phone photo → page 29), mum off camera
  (ElevenLabs Carolina, `sfx/mum.mp3`).
Start frames now come from Qwen Image 3 edit on the Higgsfield API (`_shared/start-frames.mjs`).

## 1. "¡Soy yo!" (the reveal)
- 0-2 s: close-up of a 4-year-old's face as dad opens the cover; the child gasps: "Papá… ¡ese soy yo!"
- 2-10 s: the child turns pages and points: "¡Y aquí también!" (real page inserts with his face).
- 10-16 s: dad looking at him, not at the book; small smile, eyes wet.
- 16-19 s: on-screen "Hay regalos que se abren. Y regalos en los que se encuentran."
- 19-22 s: end card.

## 2. "Unos años más" (bedtime, time passing)
- 0-2 s: mum's voice over a dark bedroom: "Un día dejará de pedirme que le lea."
- 2-12 s: mum reading her cuento in bed; the girl mouths her own name when it appears.
- 12-20 s: the girl falls asleep hugging the book; mum stays a second longer, switches off the lamp.
- 20-23 s: "Que esta noche sea su cuento." + end card.

## 3. "La abuela escribió la primera página" (grandparent gift, dedication)
- 0-2 s: on-screen hook + grandmother's hand writing on paper (the dedication text the site prints on page 1).
- 2-12 s: the grandson opens it; the grandmother reads the dedication out loud, voice breaking slightly.
- 12-20 s: he hugs her; she looks at the camera holder (his mum) and laughs.
- 20-23 s: "Un regalo de los abuelos que se queda para siempre." + end card.

## 4. "La hermana mayor" (new baby at home; folder docs/social/ads/hermana-mayor/, was hermano-mayor)
- 0-3 s: everyone around a newborn; the 5-year-old alone on the sofa, watching. On-screen: "Desde que llegó su hermana, nadie le mira a él."
- 3-14 s: dad sits next to him with a book: "Este es solo tuyo." The boy sees himself on the cover, smiles.
- 14-20 s: later, he "reads" it to the baby, proud.
- 20-23 s: "En su cuento, el protagonista es él." + end card.

## 5. "Doce años después" (legacy)
- 0-2 s: a teenager clearing her shelf stops at a worn children's book. On-screen: "Lo encontró 12 años después."
- 2-12 s: she opens it, sees herself at 4 on the cover, reads the dedication from her parents.
- 12-18 s: she goes to the kitchen and hugs her mother without saying why.
- 18-22 s: "Hoy es un cuento. Mañana, un recuerdo." + end card.

## 6. "Mañana de Reyes" (from ~15 Nov)
- 0-2 s: 6 January, 8 a.m., the boy running in pyjamas to the presents. On-screen: "Este año, los Reyes le traen su propio cuento."
- 2-12 s: he unwraps it, reads his name on the cover out loud, syllable by syllable.
- 12-18 s: the whole family on the sofa reading it.
- 18-22 s: "Pídelo antes del [real cut-off from src/lib/shipping]" + end card.

## 7. "Si decides entrar en la cueva…" (parents' gamebook nostalgia, owner idea 2026-10-27)
Insight: today's parents (30-45) grew up with gamebooks where you chose what happened ("pasa a la página 47"). Our
creation flow is the same idea (branching story tree, the parent and child pick each fork), and now the hero is the child.
Honesty: the choosing happens while creating the book; the printed book reads straight through. Never say or show
that the printed book branches.
- 0-3 s: 1994, VHS grain, a boy under the blanket with a torch and a worn paperback. A finger on the line
  "Si decides entrar en la cueva, pasa a la página 47." On-screen: "Si te acuerdas de esto…"
- 3-8 s: match cut, same hands now adult, dad on the sofa today with his 5-year-old. On-screen: "…ahora te toca a ti con él."
- 8-16 s: they choose together, the boy shouting the choice ("¡El volcán!"), dad laughing; the phone stays soft-focus,
  faces carry the shot.
- 16-22 s: the printed book arrives, the boy finds himself on the cover. On-screen: "Antes elegías tu aventura. Ahora
  él es el protagonista."
- 22-25 s: end card.
- IP: do not name the "Elige tu propia aventura" series nor copy its cover design; a generic worn 90s paperback.
- A 12-15 s cut-down (shots 1, 2, 5 + end card) for TikTok.

## Recast for Spain (owner, 2026-10-27)
Ads target Spain, so the families look typical of the Spanish audience (Mediterranean look) and only example books whose
hero fits are used; the child matches the illustrated hero at the same age, the parents plausibly theirs.
- «¡Soy yo!» (`ads/soy-yo/`): Martín (7, book 31ada3cf) and his dad. «Papá… ¡ese soy yo!» / «¡Y aquí también!».
- «La hermana mayor» (`ads/hermana-mayor/`): Noa (4, book bc6e2dbd), her mum and a newborn brother. «Desde que llegó su
  hermano, nadie la mira a ella.» / «Este es solo tuyo.» / «Mira. Esta soy yo.» / «En su cuento, la protagonista es ella.»
  No dedication insert: Noa's real one is signed "Tu tía Marta" and here the book is mum's gift.
- «Si decides entrar en la cueva…» (`ads/la-cueva/`): Aitana (6, book 5f4ace1a) and her dad, who is the boy with the torch
  in 1994. «¡El barco! ¡Elige el barco!» / «¡Papá, salgo yo!» / «Antes elegías tu aventura. Ahora ella es la protagonista.»
- The live Meta ad `..._ad_2026-10-27_soy-yo` still runs the earlier Leo video (uploaded copy); the local file is now Martín.

## Sound, captions and cuts (owner, 2026-10-27, after watching with sound)
All in `ads/_shared/build-ad.mjs`, so every ad gets it: only the voice comes from the Kling clips (ElevenLabs audio isolation,
gated to the spoken lines, 50 ms fades at every edge); one levelled music bed + a quiet room tone run under the whole ad,
ducked -4 dB with 1.2 s ramps while someone speaks, and the music start is offset so no cut lands on a phrase change.
Spoken captions are timed from ElevenLabs speech-to-text word timestamps (first word to last word + 0.25 s), written as
`{ html, shot }` entries. The first 0.4 s of every Kling clip (start hold) is never shown. Two shots of the same framing
never cut together (a page insert goes between). Each build writes `.build/report.json`: caption-vs-word offsets checked
on a fresh transcript of the final mix, words cut by a shot edge, and the bed's loudness step at every cut (target ≤ 3).

## Production
- Start frames: Qwen Image 3 edit on the Higgsfield API (`_shared/start-frames.mjs`, up to three references: actor
  frames plus the real cover); then image-to-video through the Higgsfield API (Seedance 2.5, the line spoken in Spanish),
  voice replaced with ElevenLabs by `scripts/social/dub-clip.mjs`. Pick the model and quote the cost before generating.
- ElevenLabs delivery tags matter for dubbing: «[con ritmo natural de conversación]» matched the actor's pace (tempo
  1.01) where «[despacio]» needed a 1.23 squeeze; dub-clip keeps the clean take closest to the actor's pace.
- Each ad is 4-6 shots of 4-6 s; render one draft, check it by frames, improvement pass, then upload paused.
- Least-AI pilot (2026-10-27, `ads/soy-yo-real/`): «¡Soy yo!» reshot with ordinary actors in a cluttered flat
  (`start-frames.mjs`), the same three frames animated by Seedance 2.5 and by Kling 3.0 Pro (`clips.sh`, about $7 of the
  Higgsfield API balance), one cut per model (`MODEL=seedance25|kling3 node build.mjs`). Both models redraw the cover
  art as it moves, so the live shot is blurred under the cover and the real cover follows as an insert; Seedance also
  drew a stray book into the dad shot. Kling's line «Papá… ese soy yo» drags over 3 s, Seedance's lands in 2 s. Owner
  picks the model by ear. Owner (2026-10-27): Seedance 2.5 preferred; voices always from ElevenLabs.
- Voices from ElevenLabs (owner 2026-10-27): the line is ElevenLabs TTS (`eleven_v4`, peninsular voice), aligned to
  where the model spoke, then the mouth is re-timed with fal `fal-ai/sync-lipsync/v3` (about $0.4 a clip, faces kept).
  Ruled out the same day: ElevenLabs voice changer on the model's voice (mangled the words: «¡Y aquí también!» came out
  as «¿Lancia está bien?»), Seedance 2.5 reference-to-video with `audio_urls` (re-performs the line with its own timing,
  480p, changes the child's face), and designing a child voice (ElevenLabs blocks it). Only peninsular child voice in
  the library: Leo `1tDEBGOo8EqEPApM49eJ`; alternative, a young woman voicing the child as in Spanish dubbing (Raquel
  `1eHrpOW5l98cxiSRjbzJ`). Video model research: Artificial Analysis I2V leaderboard (Oct 2026) puts MiniMax H3, FLUX 3
  Max, Seedance 2.5, Gemini Omni Flash 1.1 and Wan 3.0 in a statistical tie at the top; Kling 3.0 is not in the top 15.
  Owner picked Leo for the child (2026-10-27). MiniMax H3 (Higgsfield API, `MODEL=minimax`, silent) on the same frames:
  1440p, steadier cover, no invented objects; its cut with Leo needs the fal lip-sync. FLUX 3 Max is fal only
  (`blackforestlabs/flux-3-max/image-to-video`); not on the Higgsfield API. fal answered 403 "User is locked. Reason:
  TOP_UP" after the four lip-sync calls, which blocks both until the owner tops up fal.
  Owner: use Higgsfield. The Higgsfield API has no lip-sync and no FLUX 3. Tried there: Wan 3.0 image-to-video with
  `audio_url` (ignored it, the boy read the cover title aloud), Seedance 2.5 `video-edit` (`video_url` + `audio_url`, about
  $2.8 a 5 s clip: scene kept, mouth on our timing, but it voices the line in Chinese). Adopted instead, free:
  `scripts/social/dub-clip.mjs` — Seedance speaks the Spanish line itself, then the ElevenLabs line replaces it,
  stretched to the actor's word span, so the drawn mouth still matches.
