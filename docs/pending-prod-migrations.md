# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| 20261109190000_preview_reminder_checkout_abandoned.sql | local | 2026-11-09 | (this branch) | Additive. Before the deploy (webhook + reminder cron use it). |
