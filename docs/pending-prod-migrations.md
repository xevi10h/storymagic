# Pending production migrations

Migrations written in `supabase/migrations/` but not yet applied to the production database.
State: `local` = written, not applied anywhere · `applied` = in production (then remove the row).

| Migration | State | Since | Commit | Order and notes |
|---|---|---|---|---|
| `20261023120000_creator_programme` | local | 2026-10-23 | (creator programme commit) | Additive (`orders.promotion_code_id/promotion_code/discount_cents`, `creators`, `creator_commissions`, `creator_withdrawals`, RPC `creator_withdraw`). Apply **before** deploying the code: the Stripe webhook writes them on every promotion-code order and every refund. Then seed creators (`scripts/social/seed-creators.mjs`). Guard test: `bash supabase/tests/creator_withdraw.check.sh` (local throwaway Postgres). |
