# Organic social playbook (Instagram, TikTok, Facebook)

Written 2026-10-04 after the first posts failed as organic content (ad-like cards: 79 % skip rate, ~3 s average
watch time) and a review of how the category and the platforms work. Sources and what was verified are at the end.
Every post in `docs/social/posts/` follows this. Brand rules still apply (`docs/ads/creative-pack.md` § 0:
no invented proof, no "IA" angle, VAT next to every price, examples labelled as examples).

## Goal

Reach people who do not follow us, and leave them wanting the book. Organic social builds awareness and branded
search; Instagram and TikTok do not send clicks (bio link only). Clickable traffic comes from Pinterest (every post is
also a pin linking to the site); videos also go to YouTube as Shorts (bedtime stories are declared "made for kids").

## Rules

1. **5 of 7 posts are useful or entertaining without buying anything.** At most 2 a week are product-first.
2. **First frame = the art, full screen, already moving.** Never a logo, a brand card or a price. **No intro, ever**:
   the first 3 seconds decide whether the video is watched. The brand signature is the **outro** (3.6 s: the book of the logo opens
   and the name Meapica flows out of it, with its own chime; the music bed fades out before it) on narrated videos; short loops keep a `meapica.shop` pill on the last beat instead.
3. **Hook on screen from frame one**, 7 words or fewer, true to what follows. It answers a question a parent
   really searches or asks.
4. **Works muted**: captions burned in from the first word. **Works with sound**: the same narrator in every video
   (ElevenLabs, voice fixed in `scripts/social/render-video.mjs`) over a soft music bed (`docs/social/audio/`).
5. **Scenes move.** The opening scene, the transitions between places and the most magical moment are animated with
   an image-to-video model (paid); every other scene gets free layered motion; all beats dissolve into each other.
   **A visual change every 2 to 4 seconds.** One book and one idea per video. 15 to 60 seconds.
6. **The site is said and shown before people leave**: a small `meapica.shop` label from the third beat on (`"web": true`),
   the narrator says it over the outro (`outroSay`), and Facebook and YouTube get the link as a first comment
   (automatic; not on YouTube videos declared as made for kids, which have no comments). Reason: on 2026-10-05 about
   1,400 social views had produced one visit to the site.
7. **Caption**: first line is the search phrase, then 1 or 2 lines, then 3 to 5 specific hashtags.
   The call to action is "guárdalo" or "envíaselo a…", not "compra". Price only in product-first posts.
7. **Series beat one-offs**: the same formats come back every week so people know what to expect.
8. **Narrated videos carry the platform AI label** (`aiVideo: true`): the voice is synthetic.

## How each kind of video is made (owner, 2026-10-07)

1. **People or real settings** (the printed book in hands, a bedtime scene): a start photo generated from the real
   cover or spread (`fal-ai/flux-2/edit`), then animated with Higgsfield (`SCENE_STYLE=photo animate-scene.mjs`).
   Brand imagery, never worded as a customer or a review; platform AI label on; people from behind or as hands.
2. **Scenes from a book we have as PDF**: the illustration animated with Higgsfield (`animate-scene.mjs`).
3. **No reference images** (a name typed on a cover, a question in moving type): our own animation in code, a
   HyperFrames project under `videos/`.
A still with a zoom is the fallback, not the plan. Cost: 10 Higgsfield credits per 5 s clip; code animation is free.

## Formats (weekly skeleton)

| Slot | Format | Why it earns reach | Why it sells |
|---|---|---|---|
| Mon, Fri, Sun | **Cuento para dormir** (30 to 60 s): a real example book read aloud, abridged | Complete value, watched to the end, saved for the next night | The viewer hears a story where the hero has a name, and pictures their child's |
| Tue | **Search-led gift answer** (15 to 25 s): "Qué regalar a un niño de 5 años…" | Matches what people type in TikTok and Instagram search | The one product-first slot |
| Wed | **Saveable carousel**: ideas a parent keeps (dedications, reading by age, gifts that are not toys) | Saves and sends | The book appears once, as the example |
| Thu | **Parent question** (20 to 30 s): "¿Por qué pide el mismo cuento 20 veces?" | A question parents share with each other | Ends on "…y si la protagonista es ella" |
| Sat | **Choose the adventure** (10 to 15 s): worlds flick past, question to the comments | Comments, loops | Mirrors the creation flow |

Next formats to build: name reveal ("busca su nombre", one cover per popular name, reply to comments with their
name), and real reaction or flip-through video once printed books and nano-creators exist (the category's
strongest format, which we cannot make honestly yet).

## Review every week

Average watch time and skip rate per video (Zernio analytics), sends and saves. Keep the formats that hold people
past 3 seconds; replace the ones that do not.

## Sources

Verified in the sources: Instagram ranks on watch time, likes and sends, with sends weighing most for
non-followers (Mosseri, Jan 2025); TikTok weighs finishing a video heavily and does not use follower count as a
direct factor (TikTok newsroom); Wonderbly found one book per ad converts better and uses organic for awareness;
Hooray Heroes runs on nano-influencer content (1,615 creators in France and Spain); Lovevery structures Reels as
parent question, demonstration, reasoning; Pinterest gift searches are mostly unbranded.
Not verified: competitor profiles sit behind login walls, so no per-video numbers were seen. The format ranking,
lengths and cadence above are our inference from the platform signals, to be corrected with our own data.

- https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/
- https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you
- https://www.creativereview.co.uk/insights-how-wonderbly-uses-facebook-to-drive-sales-of-its-personalised-childrens-books/
- https://www.epidemic.co/how-hooray-heroes-used-nano-influencer-marketing-to-create-authentic-user-generated-content
- https://influencermarketinghub.com/how-lovevery-connected-parenting-content-with-product-discovery/
- https://business.pinterest.com/blog/festive-gifting-pinterest/

Skills installed for this work (project `.claude/skills/`): `social`, `copywriting` (coreyhaines31/marketingskills),
`short-form-video-script`, `reels-script`, `hook-writer`, and since 2026-10-07 `tiktok-script`,
`storytelling-and-narrative`, `experimentation-and-ab-testing`, `viral-reverse-engineering`
(social-media-skills/skills; ignore its WoopSocial routing, we publish through Zernio).
