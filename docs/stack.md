# Stack & infrastructure (Meapica)

> The full stack table, data model and file tree live in `docs/technical-architecture.md`;
> the image engine in `docs/generation-pipeline.md`. This file holds infrastructure
> runbooks that change how things are deployed.

## Supabase Storage buckets

| Bucket | Access | Holds |
|---|---|---|
| `illustrations` | **Private** | Every generated image of a child: avatar portraits, character sheets, scenes, covers |
| `showcase` | Public | Marketing copies only: is_showcase example books, waitlist covers, style samples, blog images, mock art |
| `book-pdfs` | Private | Rendered PDFs (digital download + Gelato print files), 1 h / 7 d signed URLs |
| `child-photos` | Private, server-only (no storage policies) | The child's photo (flagged feature): bytes read server-side, never a URL; deleted after the early child sheet, hourly purge ≤ 24 h |

## Private illustrations (2026-09-27)

Illustrated likenesses of real children were world-readable by URL, forever. Now:

- **DB stores object paths** ("illustration refs"): `stories.cover_image_url`,
  `stories.character_portrait_url`, `characters.avatar_url`, `story_illustrations.image_url`,
  and `generated_text.imagePlan.avatarUrl` / `imageAssets.*`. Legacy rows holding the old
  public URL keep working (`illustrationPath()` parses the path out).
- **Ownership comes from the path**, never from a user-editable column:
  `{storyId}/…` → story owner · `portraits/{userId}/…` → that user · legacy
  `portraits/{uuid}/…` → only when one of the user's own rows references it.
- **Signed URLs** (`src/lib/storage/illustration-urls.ts`, batch `createSignedUrls`):

  | Consumer | How | TTL |
  |---|---|---|
  | Book preview / flipbook (`GET /api/stories/[id]`) | `signStoryRowImages` (owner via RLS query + `user_id`) | 1 h |
  | Dashboard avatars (`GET /api/dashboard`) | `signIllustrationRefs` + `userAccess` | 1 h |
  | Generating screen (`GET /api/stories/[id]?light=true` → `preview_progress`) | `signPreviewProgress` (owner via RLS query + `user_id`), stable `key` per image so polls don't swap images | 1 h |
  | AI portrait (`POST /api/characters/portrait`, not used by the v2 UI) | signed on upload; re-sign own refs via `POST /api/illustrations/sign` | 24 h |
  | OpenAI references, QA judge, PDF render (preview, final, print) | `toServerFetchUrl` (service role) | 10 min |
  | Gelato | never sees illustrations: images are embedded in the print PDFs (`book-pdfs`, 7-day signed URL) | — |
  | Showcase / ejemplo / landing / OG / waitlist | `toShowcaseUrl` → public `showcase` mirror (never signed: cached pages + OG) | public |
  | Emails | contain no child imagery | — |

- **Anonymous guests** are `authenticated` Supabase users with a uid, so they own their
  stories/portraits exactly like registered users.
- **next/image** only optimizes `/storage/v1/object/public/**` (`next.config.ts`): the
  optimizer caches by full URL for max(minimumCacheTTL, upstream max-age = 1 year), which
  would outlive a signature. Children's images render with plain `<img>`.
- **Input hardening**: `POST /api/stories` stores only the caller's own portrait path;
  `/generate` re-checks it before using it as a reference. The child photo is addressed only by
  a `child-photos` object path (`{userId}/{uuid}.jpg`, regex + ownership + open consent row), so no
  client-supplied URL is ever fetched. The pre-rendered avatar anchor is a `/images/avatar/…` path
  (strict regex) resolved against the deployment serving the request.
- Storage RLS (`20260927140400_private_illustrations.sql`): all old policies mentioning the
  bucket dropped; owners may SELECT their own story folders / `portraits/{uid}/`; no client
  writes (uploads are service-role only).

### Deploy order — creation flow v2 (do not reorder)

Six migrations, all dated 2026-09-27. Apply them **one at a time** (Supabase MCP `apply_migration`,
which records the version, or the SQL editor followed by
`supabase migration repair --status applied <version>`), never with a single `supabase db push`:
`20260927140400` must wait until the new code is live.

| Version | File | When |
|---|---|---|
| 20260927140000 | `child_photos.sql` (private bucket, `photo_consents`, purge RPC) | before the deploy (additive) |
| 20260927140100 | `streaming_preview.sql` (`character_preps`, `stories.character_prep_id`, `stories.preview_progress`) | before the deploy (additive) |
| 20260927140200 | `character_look_traits.sql` (`characters.glasses`, `characters.freckles`) | before the deploy (additive) |
| 20260927140300 | `showcase_bucket.sql` (public `showcase`) | before `publish-showcase` |
| 20260927140400 | `private_illustrations.sql` (flip + owner policies) | AFTER the deploy |
| 20260927140500 | `illustration_paths_backfill.sql` (URLs → paths, idempotent) | any time after 140400 |

1. **Apply** 140000, 140100, 140200 (additive; the old code ignores them).
2. **Apply** 140300 (creates public `showcase`).
3. **Run** `npx tsx --tsconfig tsconfig.json scripts/publish-showcase.mts --dry-run`, then without
   `--dry-run` (copies showcase stories, waitlist covers, style samples, blog images; rewrites
   blog rows to the showcase URL). Must precede the deploy: the new code serves every public
   page (landing, `/ejemplo`, OG, waitlist) from `showcase`.
4. **Env (Vercel prod):** `CRON_SECRET` set (both crons need it); `NEXT_PUBLIC_PHOTO_UPLOAD_ENABLED`
   unset/false until the DPIA + OpenAI DPA are signed.
5. **Deploy the code** (works with the bucket still public: signed URLs also work on public buckets).
   Check `/ejemplo`, landing BookCollection, waitlist page, blog; create a book end to end
   (protagonist → prepare → story → generating screen shows images → preview).
6. **Apply** 140400 (flip `illustrations` to private + owner read policies).
7. **Apply** 140500 whenever convenient.
8. Smoke test: preview of an existing story, dashboard avatar, a new book's generating screen and
   preview, `/ejemplo/[id]`, an old public illustrations URL → 400. `GET /api/cron/purge-photos`
   with the bearer secret → 200.

**Rollback:** `update storage.buckets set public = true where id = 'illustrations';` (code keeps working).

**Operational rule:** after flagging a story `is_showcase = true`, re-run `scripts/publish-showcase.mts`
(otherwise its images 404 on public pages). Unflagging does not delete the public copy.

Known residuals: legacy portraits (`portraits/{uuid}/…`) can be re-signed by any user who
writes that path into their own character row — only possible for someone who already had the
old public URL. A preview tab left open > 1 h shows broken images for pages not yet loaded
(reload fixes it). `illustration_library` (unused cache table) was not migrated.
