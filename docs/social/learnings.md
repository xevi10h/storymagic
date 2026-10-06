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

## To review on Monday 12 Oct

Did the cold opens move average watch time above 8 s? Did any keyword comment arrive? Which platform sent visits?
