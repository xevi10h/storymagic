# Creation flow v2 (approved 2026-09-27)

Sources: benchmark (Wonderbly ES, Librio ES, Hooray Heroes, Lullaby.ink — screenshots in session scratchpad),
current-flow map, latency analysis, GDPR analysis. Screen-by-screen behaviour as built: [`user-experience.md`](./user-experience.md).

## Implementation status (integrated on `feat/creation-flow-v2`, 2026-09-28)

| # | Screen | Status | Where |
|---|--------|--------|-------|
| 1 | Nombre + live cover + edad + género | ✅ built · age and gender are **never preselected** (2026-10-03): both start empty and are required (`basicsConfirmed` in the draft; Next stays disabled until name, age and gender are in, with the footer naming what is missing, like every other screen (2026-10-07); picking the age scrolls the gender question into view; Enter in the name field shows inline errors and scrolls to the first missing question). Old drafts already past screen 1 keep their choice; a saved character (`?characterId=`) counts as chosen | `StepName`, `LiveCover` (`/create`) |
| 2 | Protagonista (Créalo tú / Sube una foto) + optional favourite colour (book palette) | ✅ built · real `WatercolorAvatar` (pre-rendered matrix, `src/lib/avatar/*`); full matrix rendered 2026-09-28 (950 bases × age band small 3–6 / big 7–12 + eye/freckles/glasses overlays); the vector `AvatarSketch` is only a fallback for a combination missing from the manifest · glasses = shape + frame colour · photo tab behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` | `StepProtagonist`, `PhotoUploadPanel`, `components/avatar/{ProtagonistAvatar,WatercolorAvatar,AvatarSketch}` |
| 3 | Aventura (world + 3 chapters, one screen) | ✅ built | `StepAdventure` |
| 4 | Mientras se pinta + dedicatoria | ✅ built · real progress from the signed `preview_progress` (light GET); the first image to land (usually scene 1) dresses the hero until the cover arrives; when ready, a big "Ver el libro" on every size and a cancellable 3 s auto-open (never while writing the dedication; see product-spec › Painting screen ready state) | `crear/[storyId]/generate`, `DedicationEditor`, `PATCH /api/stories/{id}/dedication` |
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
  record (user, time, copy version, locale), deleted right after the photo-mode portrait is drawn (2026-11-09) + hourly purge cron (≤24 h).

## Preview latency (honest numbers)
- Was ≈ 85–125 s, fully sequential. Now (streaming Book Plan + split sheets + early child sheet from screen 2,
  measured 2026-09-27): scene 1 visible ≈ 35 s, cover ≈ 40 s after "Crear su libro"; the UI shows scene 1 as soon
  as it lands. Next levers in `roadmap.md` (template companion sheets, templated cover shot).

## Blocking findings (status 2026-09-28)
- ✅ `illustrations` bucket private (signed URLs, public `showcase` mirror) — code on this branch; the flip is a deploy step (docs/stack.md).
- ✅ Privacy policy: OpenAI as processor, retention, photo deletion, AEPD complaint right (`/legal`). Check NIF before launch.
- ✅ The photo is no longer in the Character Bible / preview / final book (only the photo-mode portrait, then deleted; hourly purge ≤ 24 h).
- ⏳ EIPD (DPIA) + OpenAI DPA mandatory before turning `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` on (minors < 14 + generative AI). Enable steps: `docs/stack.md` › Child photo mode.
- ✅ (2026-11-09) **Photo → drawing, no selectors.** Replaces the 2026-11-07 trait confirmation below. Upload → `POST /api/characters/photo-portrait` (guards like the portrait route: outage breaker, IP + per-user `generate_portrait`, BotID `photo_portrait`, daily cap, guest IP cap, MOCK_MODE) renders the portrait with `buildPhotoPortraitPrompt` (photo = only identity reference, no Bible identity text, the Bible outfit verbatim, same framing/size as the avatar portrait), deletes the photo, stores the drawing in `portraits/{uid}/…`, then `deriveTraitsFromPortrait` (`src/lib/ai/photo-traits.ts`, gpt-5.4-mini vision, strict schema restricted to SKIN_TONES / HAIR_COLORS / EYE_COLORS / AVATAR_HAIRSTYLES[gender] / glasses / freckles; never gender or age; defaults on failure) reads the traits from the drawing. Client: `photoCharacter` in the draft (never written into `character`), `protagonistLook()` merges its traits over the parent's data, prepare + stories send `portraitUrl` = the drawing path (stored as `characters.avatar_url` → `finalFaceAnchor` anchors the printed book on it). `photoTraitsConfirmed` and the photo branch of prepare are gone (`photoPath` → 400). Real render 2026-11-09 (synthetic child): drawing $0.027 + traits $0.0016, ~17 s; the prep sheet anchored on it kept glasses, freckles, hair and eyes.
- (superseded 2026-11-09) (2026-11-07, branch `fix/photo-claims`) Photo mode no longer writes the Bible from the untouched defaults. After the upload, screen 2 shows the same trait pickers under «Confirma cómo es {name}» plus a required «Sí, así es {name}» box (`photoTraitsConfirmed` in the draft, reset by any new/removed photo; `protagonistReadiness()` gates Next; a stale unconfirmed photo draft reopens on screen 2). The traits are chosen by the parent, never inferred from the photo (no skin-tone inference from a minor's photo: closer to GDPR art. 9 and one more model call). `POST /api/characters/prepare` refuses `photoPath` without `photoTraitsConfirmed: true` or next to an avatar anchor (`prepareInputSchema`, `src/lib/character-look.ts`). The legacy `POST /api/characters/portrait` no longer takes a photo at all (`portraitInputSchema`: `photoPath` / `keepPhotoForSheet` → 400), so prepare is the only photo path. The prepare and stories bodies carry the same confirmed traits, so the story text, the photo sheet and the reused prep agree.
- (superseded 2026-11-09: the drawing is the stored portrait, so `avatarUrl` is set directly) (2026-11-07) The final book keeps the photo likeness: a reused prep with `had_photo` makes the preview child sheet the plan's `avatarUrl` (`finalFaceAnchor`, `src/lib/ai/face-anchor.ts`), so `final-book.ts` anchors the print sheets on it instead of redrawing the child from the text alone. Before this, a photo-mode book lost the likeness between preview and print.
- Validation (2026-11-07, `scripts/photo-mode-spike.mts`, two AI-generated fictional children, no real photo): the Images edits endpoint accepted both photos (no moderation block); the sheets were clearly the same child (curls, skin, glasses, freckles) and a scene anchored on the sheet kept the likeness. Cost: photo sheet $0.024 vs avatar sheet $0.020 (1,536 vs 1,024 image-input tokens) → +$0.004 per preview; the final main sheet's anchor is the 1536×1024 sheet instead of the avatar → +$0.004 per paid book. Checks: `npx tsx --tsconfig tsconfig.json src/lib/photo-mode.check.mts`, `node --experimental-strip-types src/lib/privacy/child-photo.check.mjs`, `PHOTO_FLAG=1` e2e (trait confirmation, prepare body, reset on a new photo).
