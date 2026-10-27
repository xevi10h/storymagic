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

## 4. "El hermano mayor" (new baby at home)
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

## Production
- Start frames: fal flux-2 edit with the actor photos plus the real cover; then image-to-video with audio (lip sync)
  through Higgsfield. Pick the model and quote the cost before generating.
- Each ad is 4-6 shots of 4-6 s; render one draft, check it by frames, improvement pass, then upload paused.
