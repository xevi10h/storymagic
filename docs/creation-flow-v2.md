# Creation flow v2 (approved 2026-09-27)

Sources: benchmark (Wonderbly ES, Librio ES, Hooray Heroes, Lullaby.ink — screenshots in session scratchpad),
current-flow map, latency analysis, GDPR analysis. Screen-by-screen behaviour as built: [`user-experience.md`](./user-experience.md).

## Implementation status (integrated on `feat/creation-flow-v2`, 2026-09-28)

| # | Screen | Status | Where |
|---|--------|--------|-------|
| 1 | Nombre + live cover | ✅ built | `StepName`, `LiveCover` (`/create`) |
| 2 | Protagonista (Créalo tú / Sube una foto) + optional favourite colour (book palette) | ✅ built · real `WatercolorAvatar` (pre-rendered matrix, `src/lib/avatar/*`); full matrix rendered 2026-09-28 (950 bases × age band small 3–6 / big 7–12 + eye/freckles/glasses overlays); the vector `AvatarSketch` is only a fallback for a combination missing from the manifest · glasses = shape + frame colour · photo tab behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` | `StepProtagonist`, `PhotoUploadPanel`, `components/avatar/{ProtagonistAvatar,WatercolorAvatar,AvatarSketch}` |
| 3 | Aventura (world + 3 chapters, one screen) | ✅ built | `StepAdventure` |
| 4 | Mientras se pinta + dedicatoria | ✅ built · real progress from the signed `preview_progress` (light GET); the first image to land (usually scene 1) dresses the hero until the cover arrives | `crear/[storyId]/generate`, `DedicationEditor`, `PATCH /api/stories/{id}/dedication` |
| 5 | Su libro + ✎ edits in place | ✅ built · chips replaced by ✎ on cover/dedication + quiet edit links (2026-09-30); preview ends on chapters-to-come + printed book | `crear/[storyId]/preview`, `BookEditSheets`, `Sheet`, `lib/preview-teaser.ts` |
| 6 | Formato + pago | ✅ redesigned 2026-09-30: mockup of their book per format, compact radios, delivery date, one-line consent, sticky bar formats-first (see user-experience.md) | `components/purchase/*`, `SendPreviewEmail`, `SharePreviewButton` |

Removed: `PortraitReveal` (AI portrait gate), `GuestGate`, `Step2CharacterCreation`, `Step5AuthorMessage`, `PathBuilder`, `PageFlip`, their i18n (`crear.step2/step5/portraitReveal/guestGate/regenerateConfirm/path`) and dead CSS. Ending picker dropped (the story closes from the chosen path).

Wiring (single sources of truth):
- **Look payload** — `characterLookPayload()` (`src/lib/creation-flow.ts`) builds the look fields of BOTH `POST /api/characters/prepare` (`characterPrepareBody`) and `POST /api/stories` (`storyCharacterBody`); the server validates both with `characterLookShape` (`src/lib/character-look.ts`). Same traits → same Character Bible hash → the generate route reuses the prepared child sheet. `characters.glasses` / `characters.freckles` are persisted and feed the Bible (and the Book Plan's child description).
- **Face anchor** — "Créalo tú": `avatarAssetPath` = the matrix base for the traits (`/images/avatar/{gender}/{band}/{skin}/{hair}-{style}.webp`, only when rendered), sent to prepare and stored as `characters.avatar_url`; the server downloads it from `NEXT_PUBLIC_SITE_URL` (never a request-derived host). Overlays (glasses/freckles) are carried by the Bible text. "Sube una foto": `photoPath` to prepare only (no avatar asset); the photo is read before the 202 (410 → the UI asks for it again) and deleted right after the child sheet.
- **Progress** — `preview_progress` stores object paths; `GET /api/stories/{id}?light=true` returns it signed for the owner, with a stable `key`/`coverKey` per image so the client keeps the `<img>` it already shows (every poll returns new signatures). Children's images are always plain `<img>`, never `next/image`.
- Removed UI still has API: `POST /api/characters/portrait` (AI portrait, 24 h signed URL) and `POST /api/illustrations/sign` (re-sign own refs) are not called by the v2 UI.

QA: `e2e/creation-v2.spec.ts` — es/ca × 1440×900 / 390×844 happy path to screen 6, cover typography, offline trait swaps, prepare ≡ stories look payload, first-scene-before-cover + stable signed URLs, Back/reload state, v1 draft migration, photo tab flag off/on incl. prepare with `photoPath` (run with `PHOTO_FLAG=1` and the server flag on), mocked backend, zero console errors / 4xx. Trait swaps are asserted to hit only already-preloaded avatar images (no fetch/xhr/document).

## Benchmark takeaways
- Best wow: Librio's cover with name + avatar (~10 s after "Ver libro"). We beat it: live cover on the first keystroke.
- Wonderbly: book always visible + checklist "drawers" (✓ Protagonista, Dedicatoria…), pre-filled dedication rendered live.
- Hooray/Librio avatar: glasses (frame colours) + freckles as toggles; portrait scrolls away on mobile (we keep it sticky).
- Anti-patterns: Hooray rejects "Lucía" (ASCII-only); Librio newsletter pop-up mid-editor; Lullaby signup wall at the wow; 2–4 s server round-trip per trait (Librio).
- Nobody classic offers the child's photo as protagonist (Wonderbly sells a dedication photo at 4,99 €). Our differentiator.

## Flow: 6 screens (today: 3 steps + portrait reveal + generating + preview + paywall, many sub-screens)

```
1 NOMBRE                      2 PROTAGONISTA                 3 AVENTURA
┌──────────────────────┐      ┌──────────────────────┐       ┌──────────────────────┐
│  ┌────────────────┐  │      │ [Sube foto][Créalo tú]│      │ Elige su mundo        │
│  │  LA AVENTURA   │  │      │  ┌────────┐ sticky    │      │ [🏴‍☠️][🚀][🦖][🧁] ...   │
│  │   DE LUCÍA     │◄─┼ live │  │ avatar │◄ instant  │      │ ─────────────────     │
│  │  (template art)│  │      │  └────────┘           │      │ Cap.1 ○A ○B  Cap.2 …  │
│  └────────────────┘  │      │ Piel ●●●●●  Pelo ●●●● │      │ (cover updates w/     │
│ ¿Cómo se llama?      │      │ Peinado ▢▢▢▢ Ojos ●●● │      │  world art)           │
│ [Lucía_________]     │      │ Gafas ○○○ Pecas ◯     │      │                       │
│ Edad [3─●──12] ♀/♂   │      │ — o foto: ☐ consent   │      │                       │
│        [Seguir →]    │      │        [Seguir →]     │      │ [Crear su libro →]    │
└──────────────────────┘      └──────────────────────┘       └──────────────────────┘
   wow < 3 s                     bg: child sheet starts        bg: Book Plan starts

4 MIENTRAS SE PINTA           5 SU LIBRO (preview)           6 FORMATO + PAGO
┌──────────────────────┐      ┌──────────────────────┐       ┌──────────────────────┐
│ ▓▓▓▓░░ Portada lista │      │  ◄ [flipbook] ►       │      │ ◉ Tapa dura  (más     │
│ Escribe su dedicatoria│     │  pages stream in      │      │   popular) [precio]   │
│ ┌──────────────────┐ │      │ ✓Protagonista ✓Dedic. │      │ ○ Tapa blanda         │
│ │Querida Lucía, ...│ │      │ ○Portada  (chips edit │      │ IVA incluido          │
│ │  (live on page)  │ │      │   in place, no exits) │      │ Envíame la preview ✉  │
│ └──────────────────┘ │      │                       │      │ [Pagar]               │
│ De: [Mamá y papá]    │      │ [Lo quiero →]         │      │                       │
└──────────────────────┘      └──────────────────────┘       └──────────────────────┘
   real progress (cover→scene1)  checklist, back always works
```

Rules: no gates before the wow (anonymous session stays silent), email only as "envíame la preview" after it,
every screen has Back that keeps state, names with accents/ñ/l·l/apostrophes, sticky portrait on mobile.

## Protagonist
- **Créalo tú**: pre-rendered watercolor avatars, swapped client-side (0 ms). Plan: derive all variants from one
  base via image edits so face position is identical; glasses/freckles as aligned overlay layers. Validate with a
  ~10-image spike before rendering the matrix (~300 bases × overlays, est. 10–30 $ one-off).
- **Sube una foto**: private bucket `child-photos`, EXIF stripped, never a URL (bytes read server-side), consent
  record (user, time, copy version, locale), deleted right after the early child sheet + hourly purge cron (≤24 h).

## Preview latency (honest numbers)
- Was ≈ 85–125 s, fully sequential. Now (streaming Book Plan + split sheets + early child sheet from screen 2,
  measured 2026-09-27): scene 1 visible ≈ 35 s, cover ≈ 40 s after "Crear su libro"; the UI shows scene 1 as soon
  as it lands. Next levers in `roadmap.md` (template companion sheets, templated cover shot).

## Blocking findings (status 2026-09-28)
- ✅ `illustrations` bucket private (signed URLs, public `showcase` mirror) — code on this branch; the flip is a deploy step (docs/stack.md).
- ✅ Privacy policy: OpenAI as processor, retention, photo deletion, AEPD complaint right (`/legal`). Check NIF before launch.
- ✅ The photo is no longer in the Character Bible / preview / final book (only avatar portrait + early child sheet, then deleted; hourly purge ≤ 24 h).
- ⏳ EIPD (DPIA) + OpenAI DPA mandatory before turning `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` on (minors < 14 + generative AI).
- ⏳ Photo mode still builds the Bible from the (untouched) default traits: the text can contradict the photo (e.g. "very fair skin, short brown hair"). Before enabling the flag, derive the look from the photo or ask for skin/hair in photo mode.
