# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| `20261019150000_reviews.sql` | local | 2026-10-19 | (this commit) | Additive (orders columns + trigger + backfill, `reviews` table). Code tolerates it missing (cron returns `migrationPending`, `/api/reviews` 503, no reviews shown), so order vs deploy is free; apply it first to start the review emails. |
