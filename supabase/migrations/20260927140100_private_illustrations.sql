-- Make children's imagery private (audit 2026-09-27).
--
-- The `illustrations` bucket holds illustrated likenesses of real children
-- (avatar portraits, character sheets, scenes, covers). Until now it was public:
-- every image was world-readable by URL, forever.
--
-- After this migration:
--   * /storage/v1/object/public/illustrations/... returns 400/404 for everyone.
--   * The app serves images through short-lived signed URLs created server-side
--     with the service role, after an ownership check on the object PATH
--     (src/lib/storage/illustration-urls.ts).
--   * The owner (signed-in user, incl. anonymous guests — role `authenticated`) may
--     also read/sign their own objects directly, mirroring the server rules:
--       <storyId>/...                  story.user_id = auth.uid()
--       portraits/<auth.uid()>/...     own avatar portraits
--     Legacy portraits (`portraits/<uuid>/file`, owner not in the path) are NOT
--     readable by clients; the server signs them only for rows the user owns.
--   * No client may insert/update/delete: uploads are service-role only.
--
-- PRE-REQUISITES (deploy order, see docs/stack.md → "Private illustrations"):
--   1. 20260927140000_showcase_bucket.sql applied and `scripts/publish-showcase.mts`
--      run, so example books / waitlist covers / blog images are served from `showcase`.
--   2. Code that stores/signs paths is deployed (it works with a public bucket too).
-- Applying this before (2) breaks every image of the old code (it uses public URLs).
-- Rollback: update storage.buckets set public = true where id = 'illustrations';

-- ── 1. Flip the bucket ───────────────────────────────────────────────────────
update storage.buckets set public = false where id = 'illustrations';

-- ── 2. Drop every existing policy that mentions the illustrations bucket ─────
-- (e.g. a "public read" or "anyone can upload" policy created from the dashboard).
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ~ '''illustrations''' or coalesce(with_check, '') ~ '''illustrations''')
  loop
    raise notice 'Dropping storage.objects policy "%"', r.policyname;
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end
$$;

-- ── 3. Owner read access ─────────────────────────────────────────────────────
create policy "illustrations_owner_read_story_images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'illustrations'
  and exists (
    select 1
    from public.stories s
    where s.id::text = (storage.foldername(objects.name))[1]
      and s.user_id = (select auth.uid())
  )
);

create policy "illustrations_owner_read_own_portraits"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'illustrations'
  and (storage.foldername(objects.name))[1] = 'portraits'
  and (storage.foldername(objects.name))[2] = (select auth.uid())::text
);
