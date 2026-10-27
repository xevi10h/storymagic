-- Advent calendar 2026 (/[locale]/advent, es + ca): "Ábreme la puerta cada mañana", one
-- email a day from 1 to 24 December with that door's story as a PDF (and on the 24th the
-- 24-story compilation). Rules: src/lib/advent/calendar.ts; run: src/lib/advent/send-run.ts
-- (cron /api/cron/advent).
--
-- Consent: explicit, unticked checkbox (RGPD 6.1.a, LSSI 21.1); proof = consent_at +
-- consent_version + consent_source. One row per address and season (a new sign-up updates
-- the child and re-consents). The portrait PDF goes only to the signed-in account's own
-- verified email (user_id + character_id, re-checked at send time); everyone else gets
-- name-only PDFs.
--
-- Double opt-in (owner 2026-10-27): a sign-up whose email is the signed-in account's own
-- confirmed address is active at once (confirmed_at = sign-up time); every other sign-up is
-- pending (confirmed_at null) until the link in ONE plain confirmation email is clicked
-- (confirm_token; re-sent at most every 10 min via confirm_sent_at). The cron only writes to
-- confirmed rows; a pending row never gets anything but that confirmation. confirmed_at is
-- the consent proof together with consent_at / consent_version / consent_source.
--
-- Idempotency: the cron claims a send by moving last_sent_day forward with a conditional
-- update (last_sent_day < door) and moves it back if the email fails.
-- Unsubscribe: unsubscribe_token (random, app-generated) in every email + List-Unsubscribe
-- one-click (POST /api/advent/unsubscribe). The global email_suppressions list is honoured too.
--
-- Server-only (service role): RLS on, no policies, no client grants.
-- DEPLOY ORDER: additive (new table). Apply BEFORE deploying the code: without it the
-- sign-up answers 503 and the cron reports { migrationPending: true }.
-- Rollback: drop table if exists public.advent_subscriptions;

create table if not exists public.advent_subscriptions (
  id uuid primary key default gen_random_uuid(),
  season smallint not null default 2026,
  email text not null,
  user_id uuid,
  character_id uuid references public.characters(id) on delete set null,
  child_name text not null,
  gender text not null default 'neutral',
  locale text not null default 'es',
  consent_at timestamptz not null,
  consent_version text not null,
  consent_source text not null default 'advent_page',
  confirmed_at timestamptz,
  confirm_token text not null,
  confirm_sent_at timestamptz,
  unsubscribe_token text not null,
  unsubscribed_at timestamptz,
  last_sent_day smallint not null default 0,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advent_subscriptions_season_email_key unique (season, email),
  constraint advent_subscriptions_token_key unique (unsubscribe_token),
  constraint advent_subscriptions_confirm_token_key unique (confirm_token),
  constraint advent_subscriptions_email_normalized check (email = lower(btrim(email)) and email <> ''),
  constraint advent_subscriptions_child_name_check check (char_length(btrim(child_name)) between 1 and 40),
  constraint advent_subscriptions_gender_check check (gender in ('boy', 'girl', 'neutral')),
  constraint advent_subscriptions_locale_check check (locale in ('es', 'ca')),
  constraint advent_subscriptions_last_sent_day_check check (last_sent_day between 0 and 24),
  constraint advent_subscriptions_token_format check (unsubscribe_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  constraint advent_subscriptions_confirm_token_format check (confirm_token ~ '^[A-Za-z0-9_-]{32,64}$')
);

comment on table public.advent_subscriptions is
  'Advent calendar daily email (1-24 Dec): consented subscriptions, one per email and season. Service role only.';
comment on column public.advent_subscriptions.last_sent_day is
  'Last door emailed (0 = none). The cron claims door n with a conditional update last_sent_day < n.';
comment on column public.advent_subscriptions.confirmed_at is
  'Double opt-in proof: when the confirmation link was used (or the sign-up time for the account''s own verified email). Null = pending, never emailed by the cron.';
comment on column public.advent_subscriptions.character_id is
  'Saved character of the signed-in account whose own verified email this is (portrait PDFs); null = name-only.';

-- The cron scans the season's confirmed, active subscriptions behind today's door.
create index if not exists advent_subscriptions_pending_idx
  on public.advent_subscriptions (season, last_sent_day)
  where unsubscribed_at is null and confirmed_at is not null;
create index if not exists advent_subscriptions_user_idx on public.advent_subscriptions (user_id);

alter table public.advent_subscriptions enable row level security;
revoke all on table public.advent_subscriptions from anon, authenticated;
