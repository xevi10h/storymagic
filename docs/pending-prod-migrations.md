# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| `20261019120000_story_attribution.sql` | local | 2026-10-19 | (this commit) | Additive: nullable `stories.attribution` jsonb + shape check. Any order vs the deploy (the API retries without the column on PGRST204), but apply before deploying to start recording. |
