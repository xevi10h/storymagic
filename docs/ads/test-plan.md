# Creative test plan — Meta (IG + FB), October 2026

**Goal:** find which creative sells, on a small budget. **Not** many ad sets with €1–2/day each (none would exit
learning or reach 2–3 purchases). Instead: **1 Sales campaign (Advantage+ campaign budget, CBO) → 2 ad sets
(CA: Catalonia + app language Catalan · ES: rest of Spain excl. Canarias/Ceuta/Melilla) → all creatives in each ad
set**. Meta shifts spend to winners automatically.

Budget: €15/day for 14 days (~€210). Read after 7 days: **hook rate (3-s views / impressions), CTR, cost per
InitiateCheckout**; after 14 days: purchases (Stripe metadata carries `utm_content` = ad id).
Kill the bottom third at day 7; add the next batch (Martina, older-kid angle) into the same ad sets.

## Creatives per ad set (same set in ES and CA)

| Ad name (`utm_content`) | Format | Kid | File (docs/ads/creatives/...) |
|---|---|---|---|
| vid-story-28-noa | video 28 s 9:16 (Reels/Stories/TikTok) | girl | story/v3/out/noa-full-9x16-{lang}.mp4 |
| vid-story-28-leo | video 28 s 9:16 | boy | story/v3/out/leo-full-9x16-{lang}.mp4 |
| vid-story-15-noa | video 15 s 9:16 | girl | story/v3/out/noa-short-9x16-{lang}.mp4 |
| vid-story-15-leo | video 15 s 9:16 | boy | story/v3/out/leo-short-9x16-{lang}.mp4 |
| vid-feed-28-noa / -leo | video 28 s 4:5 (feed) | both | story/v3/out/{kid}-full-4x5-{lang}.mp4 |
| vid-feed-15-noa / -leo | video 15 s 4:5 | both | story/v3/out/{kid}-short-4x5-{lang}.mp4 |
| img-rec-noa / -leo | photo: recognition laugh | both | story/v3/stills/out/photo-{kid}-rec-{4x5,9x16}-{lang}.jpg |
| img-read-noa / -leo | photo: reading together, "Tú eliges su aventura" | both | story/v3/stills/out/photo-{kid}-read-{4x5,9x16}-{lang}.jpg |
| img-product-screens / -name / -preview | product statics (Noa/Leo covers) | both | static-{angle}-{lang}.png |

Placement pairing: upload the 4:5 and 9:16 of the same ad together (Meta "placement asset customization").
Primary text per angle: `creative-pack.md`. TikTok (3-day test, €20/day ad group): the 9:16 videos only,
**AI-generated content label ON** (required). Meta adds its "AI info" label automatically.

## How the story videos are produced (reproducible)
- Scenes: MiniMax H3 reference-to-video via Higgsfield API (`story/shoot.mjs`, `story/leo-shoot.mjs`) from
  character sheets + real covers; transitions/world: H3 image-to-video (start/end frame).
- Narration: ElevenLabs **Eleven v4**, voice Martin Osborne (es-ES), one continuous take per variant
  (`story/v3/vo-take.py`); brand said **"MÉ-a-pi-ca"** (write "Méapica", never a period right after it).
- Score: ElevenLabs Music with section plans (`story/v3/audio/music-{full,short}.json`, sections ≥ 3 s).
- Assembly: `node docs/ads/creatives/story/v3/story-ad.mjs <noa|leo> <es|ca> <full|short> <916|45>`.
- Phone beat: real meapica.shop flow (`story/v3/rec-flow.mjs`). Note: Turnstile now blocks automated
  chapter taps; Leo's flow ends at the world/chapter-1 screen.
