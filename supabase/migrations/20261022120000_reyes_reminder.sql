-- Reyes deadline reminder ("Avísame antes de la fecha límite de Reyes", free /tools/* printables).
--
-- The consent used to live only in newsletter_subscribers.source = 'reyes_reminder', a single
-- column that /api/newsletter overwrote on conflict: a footer subscriber who ticked the Reyes
-- box (or the reverse) lost the other consent. The Reyes consent now has its own column, and
-- the one email it allows is claimed through reyes_reminder_sent_at (cron /api/cron/reyes-reminders).
-- Additive only: safe to apply before or after the code.

alter table public.newsletter_subscribers
  add column if not exists reyes_reminder_consent_at timestamptz,
  add column if not exists reyes_reminder_sent_at timestamptz;

-- Consents given before this migration (source was the only record of them).
update public.newsletter_subscribers
  set reyes_reminder_consent_at = coalesce(subscribed_at, now())
  where source = 'reyes_reminder' and reyes_reminder_consent_at is null;

-- The cron scans pending consents only.
create index if not exists newsletter_subscribers_reyes_pending_idx
  on public.newsletter_subscribers (reyes_reminder_consent_at)
  where reyes_reminder_consent_at is not null and reyes_reminder_sent_at is null;
