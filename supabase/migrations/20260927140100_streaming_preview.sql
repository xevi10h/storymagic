-- Streaming preview (2026-09-27): early child sheet + incremental preview progress.
--
-- 1. character_preps: the child's preview character sheet, rendered by
--    POST /api/characters/prepare while the parent is still choosing the world
--    (before the story row exists). Written only by the server (service role);
--    owners may read their own rows. The optional child photo path is never
--    stored (only had_photo): the photo is deleted right after the sheet.
-- 2. stories.character_prep_id: which prep the story may reuse (the generate
--    route re-checks the Bible hash + avatar before reusing it).
-- 3. stories.preview_progress: incremental jsonb the generating screen polls
--    via GET /api/stories/{id}?light=true:
--      { "coverUrl"?: text, "scenes": [{ "index": int (scene number, 1-based), "url": text }], "total": int }
--
-- Additive only. Apply before deploying the code that uses it.

create table if not exists public.character_preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- sha256(bible hash + avatar ref + photo path): idempotency key per user
  fingerprint text not null,
  -- sha256(Bible description + age + gender + preview model/quality)
  bible_hash text not null,
  bible jsonb not null,
  -- "/images/avatar/…" (pre-rendered avatar) or the AI portrait URL; null = no avatar anchor
  avatar_ref text,
  had_photo boolean not null default false,
  status text not null default 'rendering' check (status in ('rendering', 'ready', 'failed')),
  child_sheet_url text,
  model text,
  cost_usd numeric(10, 4),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint character_preps_user_fingerprint_key unique (user_id, fingerprint)
);

alter table public.character_preps enable row level security;

drop policy if exists "character_preps_select_own" on public.character_preps;
create policy "character_preps_select_own" on public.character_preps
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: only the service role writes.

alter table public.stories
  add column if not exists character_prep_id uuid references public.character_preps (id) on delete set null,
  add column if not exists preview_progress jsonb;

create index if not exists stories_character_prep_id_idx on public.stories (character_prep_id) where character_prep_id is not null;
