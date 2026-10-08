---
name: meapica-reel
description: Create, improve, schedule or review a Meapica social reel or a week of posts (Instagram, TikTok, Facebook, YouTube, Pinterest through Zernio). Use whenever the owner asks for new videos or reels, "contenido para redes", "prepara la semana", "mejora este vídeo", "cómo van las publicaciones", a staged scene with people, or anything about what is working on social. It is the order of work; the rules themselves live in docs/social/playbook.md.
---

# Meapica reel

The rules are in `docs/social/playbook.md` and the history in `docs/social/learnings.md`. Read both, then work in
this order. Do not restate their content here: change it there.

1. **Learn first.** `node scripts/social/learn.mjs`, then read `docs/social/scoreboard.md`. Decide from cuts marked
   "comparable"; anything else is still a test (playbook › The learning loop).
2. **Name the strategy** of each reel before building; no two in a week share one; Spanish only (playbook rule 0).
3. **Pick how it is made** (playbook › How each kind of video is made):
   - people or real settings: start photos, then Higgsfield. Copy `scripts/social/scene-photos.example.mjs`, give
     the model the real cover or spread as reference and the exact title text; then
     `SCENE_STYLE=photo node scripts/social/animate-scene.mjs <out.mp4> "<motion>" <start.jpg>`. People from behind
     or as hands, AI label on, caption says "Escena recreada".
   - a scene from an example book: `animate-scene.mjs` with `pdf:<story id>:<page>:<focus>`; reuse the clips in
     `docs/social/posts/*/clips/` first, they are already paid.
   - no reference images: a HyperFrames project under `videos/` (model: `videos/name-reveal/`).
4. **Storyboard before rendering:** `node scripts/social/render-video.mjs <video.json> --storyboard`.
5. **Improvement pass** on every video before showing it (playbook › Improvement pass); say what it changed.
6. **Closing:** `"outro": "short"` on short reels, `"outro": true` plus `outroSay` on narrated stories.
7. **Check by frames**, never by assumption: a contact sheet with ffmpeg, read it, fix, render again. Say that
   motion and sound were not checked.
8. **Post:** `docs/social/posts/<date>/post.json` with `strategy` (and `people`); `node scripts/social/schedule.mjs`
   is a dry run, `--schedule` schedules the next 6 days. A replaced video: `node scripts/social/zernio.mjs
   unschedule <id>` first, then `schedule.mjs --schedule --date=<date> --force`, then list again to confirm one post
   a day. Later dates are scheduled by the daily cloud routine from `main`, so the post must be pushed.
9. **Names must work in the language** (the Spanish example hero is Martín, the Catalan one Martí).

Costs: about $0.55 per 5 s Higgsfield clip from a prepaid balance
(`scripts/social/browser/higgsfield-balance.mjs` reads it); photos are cents; code animation is free.
Outreach to creators: `docs/outreach/`; Instagram first messages go through `scripts/social/browser/instagram-dm.mjs`.
