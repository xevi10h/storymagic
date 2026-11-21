# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| `20261121120000_merge_guest_story_to_guest.sql` | local | 2026-11-21 | feat/conversion-fixes | **Apply BEFORE deploying the "continue your book" links.** `create or replace` of `merge_guest_account` (same signature): partial merges may target another guest. Without it, a claim from a new guest browser fails with the retry screen. Check: `bash supabase/tests/merge_guest_story.check.sh`. |
