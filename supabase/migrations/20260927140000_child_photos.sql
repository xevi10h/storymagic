-- Child photos (creation flow v2, owner decision 2026-09-27).
--
-- The parent may upload ONE photo of the child. It is used only to create the
-- avatar portrait (and the early child character sheet), then deleted right away;
-- an hourly cron (/api/cron/purge-photos) removes anything older than 24 h.
-- Preview and final book are rendered from the avatar + generated sheets only.
--
--   storage bucket  child-photos      private, path {userId}/{uuid}.jpg (re-encoded
--                                     JPEG, EXIF/GPS stripped, max 1536 px)
--   table           photo_consents    parental consent record per photo (kept after
--                                     the photo is deleted, as proof of consent)
--
-- Access is server-only (service role). No storage.objects policies and no table
-- policies are created on purpose: anon/authenticated clients can neither read,
-- list, upload nor delete child photos or consent rows directly.
--
-- Additive only. Safe to apply before deploying the code that uses it.

-- ── Private bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('child-photos', 'child-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Consent record ───────────────────────────────────────────────────────────
create table if not exists public.photo_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Object path inside the child-photos bucket: {userId}/{uuid}.jpg
  photo_path text not null unique,
  -- Version of the consent copy the parent accepted (PHOTO_CONSENT_VERSION in code)
  consent_version text not null,
  locale text not null check (locale in ('es', 'ca', 'en', 'fr')),
  created_at timestamptz not null default now(),
  -- When the photo object was deleted (after the avatar, on withdrawal, or by the purge cron)
  deleted_at timestamptz
);

comment on table public.photo_consents is
  'Parental consent per uploaded child photo. The photo itself lives in the private child-photos bucket and is deleted right after the avatar is created (max 24 h); this row is kept as proof of consent.';

create index if not exists photo_consents_user_idx on public.photo_consents (user_id);
-- Purge sweep: photos not yet deleted, oldest first.
create index if not exists photo_consents_pending_idx
  on public.photo_consents (created_at)
  where deleted_at is null;

alter table public.photo_consents enable row level security;
-- No policies: only the service role (which bypasses RLS) can read/write.

-- ── Purge helper: every child-photos object older than the cutoff ───────────
-- Catches orphans too (an upload whose consent insert failed), which a sweep of
-- photo_consents alone would miss. storage.objects is not exposed through the
-- Data API, hence the security-definer function (service role only).
create or replace function public.list_expired_child_photos(p_older_than timestamptz, p_limit integer default 500)
returns table (name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'child-photos'
    and o.created_at < p_older_than
  order by o.created_at
  limit greatest(1, least(p_limit, 1000));
$$;

revoke all on function public.list_expired_child_photos(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_expired_child_photos(timestamptz, integer) to service_role;
