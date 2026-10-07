# What the posts are teaching us

One entry per finding, newest first. Numbers come from Zernio analytics (delayed up to 48 h) and GA4 / the growth
funnel script for the site. Every change to the format is recorded here with the reason, so the next result can be
compared against it. Rules that survive go into `playbook.md`.

## Results so far

| Post | Format | Facebook views | TikTok views | Instagram views | Avg watch time | Site visits |
|---|---|---|---|---|---|---|
| 3 Oct, three ad-like posts | brand cards, logo, price | 230 (reel) | 0-2 | 89 (reel) | 2.9-3.3 s | 1 from Facebook in 3 days |
| 4 Oct 19:31, Aitana story | stills with zoom | deleted | 249 | 37 | 4.0-6.1 s | 0 |
| 4 Oct 23:27, Aitana story | animated scenes and transition | 1,069 | 247 | 14 | 4.3-5.8 s | 0 |
| 5 Oct 20:30, Noa story | animated + site label + first comment | 317 (12 h) | 187 (12 h) | 5 (12 h) | 4.7-4.9 s | 0 |

## Findings

- **2026-10-06 · The drop happens between second 2 and second 3, on the title and the slow first line.** Facebook
  retention curves: both bedtime stories keep 98-100 % at second 2 and 68 % at second 3, half at second 4, 22 % at
  second 10, 5 % at second 30. The ad-like reel of 3 Oct held everyone to second 3, 69 % at second 5 and 31 % at
  second 10. So "Cuento para dormir en 1 minuto" over a calm scene-setting sentence loses people faster than a
  product card did; it only reached more people. Three videos, one platform: a direction, not a proof.
  → Supports the cold opens from 8 Oct. Also test a first line with something at stake instead of a description.
- **2026-10-06 · TikTok is giving every video the same first batch (249, 248, 239 views) and none has passed it.**
  98 % of views come from For You, about 90 % from Spain, so the audience is right. Completion is 1-2 % on 60 s
  videos. TikTok views therefore do not yet tell formats apart; average watch time and completion do.
- **2026-10-06 · Full animation did not hold people longer than stills with two animated clips** (Aitana 4.3 s on
  Facebook, Noa 4.8 s). The paid image-to-video clips are worth it for the opening only, until retention moves.
- **2026-10-06 · Nobody sends or saves.** About 2,500 views in four days: 0 shares, 2 saves, 0 keyword comments.
  Instagram weighs sends most for non-followers, which fits its reach falling to 5 views.
- **2026-10-06 · Real people (proposed by the owner).** The missing format is a real child opening a real book. It
  can come from the gifted-book creators (`docs/outreach/creators-2026-10.md`) and from filming a printed copy
  ourselves. The owner also suggested generating realistic scenes with Higgsfield. Recommendation given, owner's
  answer pending: not for people reacting to the book, which would be invented proof (`playbook.md`, brand rules)
  and cannot show our actual pages. Higgsfield account on 2026-10-06: free plan, 0 credits.

- **2026-10-06 · People leave at about 5 seconds whatever the picture does.** Animation raised views on Facebook and
  TikTok but not watch time (3 s → about 5 s on a 50-60 s video). The opening is the problem, not the art.
  → Change from 8 Oct: every video opens on its most striking scene (the dragon, the crystal, the big dinosaur) with a
  line that promises the story, then tells it from the start. Compare 8, 9 and 11 Oct against 4 and 5 Oct.
- **2026-10-06 · Instagram reach is collapsing post after post (89 → 37 → 14 → 5 views).** Not explained by the content,
  which does better elsewhere the same day. Open question: account-level cause (new account, posts through the API,
  duplicate uploads on 4 Oct, the AI label). To investigate before changing anything else on Instagram.
- **2026-10-05 · Views do not become visits.** About 1,400 views produced one visit. Instagram and TikTok captions carry
  no clickable link. → From 5-6 Oct: site label and spoken address in the video, link in the first comment (Facebook,
  YouTube), "comment CUENTO / CONTE" automation with a private message (Instagram, Facebook), bio links.
  Measure: automation stats (`setup-automations.mjs`), GA4 sessions by source, stories started.
- **2026-10-04 · Ad-like posts are skipped.** 79 % skip rate and 3 s on brand cards with logo and price.
  → Rebuilt as organic formats (`playbook.md`).

## Experiments (owner, 2026-10-06: more A/B testing)

How a test is run (`experimentation-and-ab-testing` skill): two videos that differ in **one** thing only (same
format, language, hour, caption style), posted on different days. The rule that decides the winner is written
**before** publishing. Read on TikTok and Facebook, which give a new video a comparable first audience (TikTok about
250 views). About 250 views per video only shows big differences, so a variable becomes a rule in `playbook.md`
after **three** pairs agree; one win is noise and a small difference is a tie. Every pair uses a different book, which
cannot be controlled: one more reason to want three pairs.
Never upload both variants to Instagram on the same day (duplicate uploads on 4 Oct are a suspect for its reach).

| # | Variable | A | B | Decision rule (set before publishing) | Status |
|---|---|---|---|---|---|
| 1 | Opening | "Cuento para dormir en 1 minuto" over a calm first scene and a descriptive line: Noa, 5 Oct, ES, 20:30 | same title, format, language and hour, opening on the most striking scene with a line that has something at stake: Martí, 9 Oct | B wins if Facebook retention at second 3 is 78 % or more (A: 68 %) and average watch time is not lower than A (4.8 s Facebook, 4.9 s TikTok) | pair 1 on 9 Oct, read 12 Oct |
| 2 | Language | cold-open bedtime story in Spanish: Martí, 9 Oct | cold-open bedtime story in Catalan: Leo, 11 Oct (19:30, one hour earlier) | Tie unless average watch time differs by 20 % or more on both platforms | pair 1 on 11 Oct |
| 3 | Length | the full story, 50-60 s | the same story cut to 15-20 s | B wins if TikTok completion is at least double and saves per view are not lower | next, from 12 Oct |
| 4 | First line | a question to the parent | a story line with something at stake | set when built | queued |
| 5 | World | space, castle and magic, dinosaurs, pirates, forest: same format, one world each | | set when built | queued; 10 Oct post asks it in comments |
| 6 | Voice | narrator (carries the AI label) | music and captions only, no label | set when built | queued; also tests the Instagram drop |
| 7 | Footage | illustrated pages | a real printed book in real hands | set when built | when a printed copy or a creator video exists |

**Lifestyle photos test, 2026-10-07 (owner's idea: people enjoying the book, as a clothing brand would shoot it).**
Draft in `docs/social/tests/2026-10-07-lifestyle/`, not scheduled. Four photos generated with `fal-ai/flux-2/edit`
from the real cover and spreads of Leo's example book (`gen.mjs`); on the two open-book photos the real pages are
re-projected over the generated ones (`composite.py`, feature matching), so the printed text is ours and readable.
On the two closed-book photos the cover is the model's reproduction (faithful on inspection, title correct): the
re-projection spilled over the book edge there and was not used. `video.mp4` is the 6 Oct gift video with the same
script, title, voice and music and only the pictures changed: it is ready to be B of test 7 (footage).
Second pass the same day (owner: "these are still images, animate them"): every scene is now a moving clip made by
code, no video model. The camera pushes in, and in the two open-book scenes the pages turn through three real
spreads each: `pages.py` finds where the photo shows a known page and prints any other real page in that exact
place, with the photo's light and the fingers kept in front. Hands and people still do not move; that would need an
image-to-video model, which redraws the book.
Rules if it is published: brand imagery, never worded as a customer or a review; platform AI label on; adults and
children seen from behind or as hands. Known flaw: the child in the gift photo has different hair from the others.

**Video by code (owner sent a YouTube video, 2026-10-07; transcript in `docs/social/research/`).** Its method is
frames drawn by JavaScript in a headless browser, stitched with ffmpeg, narration from ElevenLabs, and a contact
sheet to check the result. `render-video.mjs` and the HyperFrames outro already work this way. What it adds for us:
(1) a storyboard of stills approved before rendering, since a render takes minutes; (2) scenes that are pure
motion graphics instead of a zoom on a page (the name writing itself on the cover, the world picker, animated
text for parent questions), at no cost per clip, unlike the image-to-video clips; (3) taking the composition of a
video that worked as the reference. Its limit is ours too: it draws, it does not film.
Built the same day: (1) `render-video.mjs <video.json> --storyboard` writes `storyboard.jpg`, the first frame of
every beat with its title and whole line, in about 40 s instead of a render of several minutes; (2) the first
code-drawn format, "Escribe su nombre" (`videos/name-reveal`, HyperFrames, 13 s loop, music only, renders in 18 s):
a name is typed and lands letter by letter on the real cover of that child's example book (Leo, Noa, Lucía, Martí,
Aitana), ending on an empty field and "¿Y el suyo?". Draft in `docs/social/tests/2026-10-07-name-reveal/`, not
scheduled. No synthetic voice or generated people, so it needs no AI label: it can also serve as B of test 6.

Not tests (no pair): 8 Oct parent question and 10 Oct poll. They are read as formats, against the bedtime stories.

**Review of the week's posts, 2026-10-07** (with `tiktok-script`, `storytelling-and-narrative`, `hook-writer`):
- 8 Oct: the answer came at second 5, leaving no reason to stay. Now the narrator promises two reasons and keeps the
  better one for later (an open loop); the last line still leads back into the opening question.
- 9 Oct: was "Así empieza el cuento de Martí", a hook about a stranger, four beats of setting before anything
  happened and an ending with no payoff. Rebuilt as the complete story in a minute, opening on the crystal with
  what is at stake. It is now the clean pair of 5 Oct for test 1 (before, 8, 9 and 11 Oct all differed from 4 and
  5 Oct in format or language as well as in the opening).
- 11 Oct: the scene-setting beat right after the cold open is cut.
- 7 Oct carousel and 10 Oct poll: unchanged. Open doubt on carousels: the two image posts of 3 Oct show 0 views on
  every platform, so today's carousel is the first real reading of the format.

**Other people's worlds (owner asked 2026-10-06: Harry Potter, Star Wars).** Recommendation given, not a decision:
no names, characters, logos or music from them. They are registered marks and copyrighted works; using them to sell
our book is infringement, platforms remove such posts and strike the account, and the product cannot deliver a book
set there. What is free to use is the genre: a school of magic, a young wizard, a galaxy adventure, knights and
dragons. Test 4 measures whether those worlds pull more than the others. Calendar hooks (Halloween, Castanyada,
Nadal, Reis) are the other source of borrowed interest.

## To review on Monday 12 Oct

Did the cold opens move average watch time above 8 s? Did any keyword comment arrive? Which platform sent visits?
