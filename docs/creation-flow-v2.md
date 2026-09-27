# Creation flow v2 (approved 2026-09-27)

Sources: benchmark (Wonderbly ES, Librio ES, Hooray Heroes, Lullaby.ink — screenshots in session scratchpad),
current-flow map, latency analysis, GDPR analysis. Screen-by-screen behaviour as built: [`user-experience.md`](./user-experience.md).

## Implementation status (2026-09-27)

| # | Screen | Status | Where |
|---|--------|--------|-------|
| 1 | Nombre + live cover | ✅ built | `StepName`, `LiveCover` (`/crear`) |
| 2 | Protagonista (Créalo tú / Sube una foto) | ✅ UI built · avatar art = placeholder SVG until the avatar matrix lands · photo tab behind `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED` | `StepProtagonist`, `PhotoUploadPanel`, `components/avatar/WatercolorAvatar` |
| 3 | Aventura (world + 3 chapters, one screen) | ✅ built | `StepAdventure` |
| 4 | Mientras se pinta + dedicatoria | ✅ built · real progress needs `preview_progress` in the light GET (pipeline agent) | `crear/[storyId]/generar`, `DedicationEditor`, `PATCH /api/stories/{id}/dedication` |
| 5 | Su libro + checklist chips | ✅ built · pages stream on screen 4 (thumbnails); the flipbook opens once the preview is ready | `crear/[storyId]/preview`, `BookChecklist`, `Sheet` |
| 6 | Formato + pago | ✅ existing paywall reused, VAT next to every price, "Envíame la preview" added | `SendPreviewEmail`, `POST /api/stories/{id}/send-preview` |

Removed: `PortraitReveal` (AI portrait gate), `GuestGate`, `Step2CharacterCreation`, `Step5AuthorMessage`, `PathBuilder`, `PageFlip`, their i18n (`crear.step2/step5/portraitReveal/guestGate/regenerateConfirm/path`) and dead CSS. Ending picker dropped (the story closes from the chosen path).

Contracts consumed from other workstreams (mocked in `e2e/creation-v2.spec.ts` until merged):
- `POST /api/characters/prepare` → `{ characterPrepId }` (sent as `characterPrepId` in `POST /api/stories`; the stories route must persist it).
- `POST/DELETE /api/characters/photo` (privacy branch; consent copy `crear.photo.*` copied verbatim).
- `stories.preview_progress` in `GET /api/stories/{id}?light=true`.
- `WatercolorAvatar` real implementation + `CharacterData.glasses/freckles` persisted server-side (today the stories route strips them; only the prep call receives them).

QA: `e2e/creation-v2.spec.ts` — es/ca × 1440×900 / 390×844 happy path to screen 6, cover typography, offline trait swaps, Back/reload state, v1 draft migration, photo tab flag off/on (run with `PHOTO_FLAG=1` and the server flag on), mocked progress, zero console errors / 4xx.

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
- **Sube una foto**: private bucket `child-photos`, EXIF stripped, signed URLs ≤5 min, consent record
  (user, time, copy version, locale), deleted right after the portrait + hourly purge cron (≤24 h).

## Preview latency (honest numbers)
- Today ≈ 85–125 s, fully sequential; `onProgress` exists but `generate/route.ts:121` never passes it.
- Wiring onProgress + incremental `stories.preview_progress` (existing 3 s poll): first cover ≈ 40–55 s.
- To reach ~20 s perceived: start the child character sheet at the end of screen 2 (while user picks world and
  writes the dedication) → requires splitting the sheet into child rows + companion rows.

## Blocking findings (fix regardless of flow)
- `illustrations` bucket is public → children's likenesses world-readable.
- Privacy policy omits OpenAI (already a processor today), NIF, retention, AEPD complaint right.
- `photoUrl` is persisted in the Character Bible and reused by final-book → 24 h deletion impossible as-is.
- EIPD (DPIA) mandatory before launching photo upload (minors < 14 + generative AI).
