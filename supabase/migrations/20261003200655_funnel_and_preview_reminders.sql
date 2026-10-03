-- Growth funnel timestamps + abandoned-preview reminder emails (2026-10-03).
--
-- 1. stories.generation_started_at / stories.preview_ready_at: first time a story was
--    claimed for generation (draft → generating) and first time it reached a viewable
--    preview (preview / ready / ordered / shipped / delivered). Set by a trigger, so
--    every code path (generate route, mock mode, admin fixes) records them and the app
--    never writes them (the code works before and after this migration). They are our
--    own operational records, independent of cookie consent; scripts/growth-funnel.mjs
--    reads them.
--
-- 2. preview_reminders: a parent who reached the preview, gave an email and ticked the
--    (never pre-ticked) "remind me" box at /create/<id>/preview gets at most 3 reminder
--    emails (1 h, 24 h, 72 h after the consent) until they buy or unsubscribe.
--    Legal basis: express consent (LSSI art. 21.1 + RGPD art. 6.1.a), recorded here
--    (consent_at, consent_version, consent_source, locale). The row belongs to the story
--    (deleted with it: account erasure, guest purge; it follows the story through a
--    guest merge). One row per story = the
--    sequence is idempotent per story; `stage` is the last reminder sent (0-3) and is
--    claimed with an optimistic `stage = <previous>` update by the cron
--    /api/cron/preview-reminders. stopped_at/stop_reason end the sequence
--    (purchased | unsubscribed | expired | story_unavailable).
--
-- DEPLOY ORDER: additive only (nullable columns, new table, trigger that only fills
-- the new columns). Apply BEFORE deploying the code: the reminder cron and the
-- send-preview route use preview_reminders (the route degrades gracefully without it:
-- the preview email is still sent, the reminder is not recorded).
--
-- Rollback:
--   drop trigger if exists stories_funnel_timestamps on public.stories;
--   drop function if exists public.stories_funnel_timestamps();
--   drop table if exists public.preview_reminders;
--   alter table public.stories drop column if exists generation_started_at, drop column if exists preview_ready_at;

-- ── 1. Funnel timestamps ───────────────────────────────────────────────────────

alter table public.stories
  add column if not exists generation_started_at timestamptz,
  add column if not exists preview_ready_at timestamptz;

comment on column public.stories.generation_started_at is
  'First draft → generating claim (trigger stories_funnel_timestamps). Growth funnel, consent-independent.';
comment on column public.stories.preview_ready_at is
  'First time the story reached a viewable preview (status preview or later; trigger stories_funnel_timestamps).';

create or replace function public.stories_funnel_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'generating' and new.generation_started_at is null then
    new.generation_started_at := now();
  end if;
  if new.status in ('preview', 'completing', 'ready', 'ordered', 'shipped', 'delivered') and new.preview_ready_at is null then
    new.preview_ready_at := now();
    -- A story that skipped "generating" (mock mode, admin fixture) still started once.
    new.generation_started_at := coalesce(new.generation_started_at, new.preview_ready_at);
  end if;
  return new;
end;
$$;

drop trigger if exists stories_funnel_timestamps on public.stories;
create trigger stories_funnel_timestamps
  before insert or update of status on public.stories
  for each row execute function public.stories_funnel_timestamps();

-- Backfill (approximate, documented): stories past draft before this migration.
-- preview_ready_at = created_at is a lower bound (previews take ~1 min); only the
-- per-day cohort (by created_at) is reported, so the approximation does not move it.
update public.stories
set preview_ready_at = created_at,
    generation_started_at = coalesce(generation_started_at, created_at)
where preview_ready_at is null
  and status in ('preview', 'completing', 'ready', 'ordered', 'shipped', 'delivered');

update public.stories
set generation_started_at = created_at
where generation_started_at is null and status = 'generating';

-- ── 2. Abandoned-preview reminders ─────────────────────────────────────────────

create table if not exists public.preview_reminders (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  email text not null,
  locale text not null default 'es',
  consent_at timestamptz not null default now(),
  consent_version text not null,
  consent_source text not null default 'preview_send_email',
  stage smallint not null default 0,
  last_sent_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preview_reminders_story_key unique (story_id),
  constraint preview_reminders_email_normalized check (email = lower(btrim(email)) and email <> ''),
  constraint preview_reminders_locale_check check (locale in ('es', 'ca', 'en', 'fr')),
  constraint preview_reminders_stage_check check (stage between 0 and 3),
  constraint preview_reminders_stop_reason_check
    check (stop_reason is null or stop_reason in ('purchased', 'unsubscribed', 'expired', 'story_unavailable'))
);

comment on table public.preview_reminders is
  'Consent record + state of the abandoned-preview reminder emails (max 3 per story). Service role only.';
comment on column public.preview_reminders.stage is
  'Last reminder sent: 0 none, 1 = 1 h, 2 = 24 h, 3 = 72 h. Claimed by the cron with stage = previous.';
comment on column public.preview_reminders.consent_version is
  'Version of the checkbox text the parent accepted (src/lib/marketing/preview-reminders.ts).';

-- Service role only: no policies, and no grants for the client roles.
alter table public.preview_reminders enable row level security;
revoke all on table public.preview_reminders from anon, authenticated;

-- The cron scans the open sequences.
create index if not exists preview_reminders_open_idx
  on public.preview_reminders (consent_at)
  where stopped_at is null and stage < 3;
