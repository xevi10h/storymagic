# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| `20261022120000_reyes_reminder.sql` (`newsletter_subscribers.reyes_reminder_consent_at` + `reyes_reminder_sent_at`, backfill from `source`, partial index) | local | 2026-10-22 | (this commit) | **before** the deploy (additive; the new `/api/newsletter` writes the column, so Reyes opt-ins 500 without it; the cron degrades to `migrationPending`) |
