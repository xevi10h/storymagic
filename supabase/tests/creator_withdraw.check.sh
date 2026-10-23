#!/usr/bin/env bash
# Double-spend guard of the creator programme (RPC creator_withdraw, migration
# 20261023120000_creator_programme.sql) against a real, throwaway Postgres: never a Supabase
# project. Needs the Postgres binaries (brew install postgresql@16). Run from the repo root:
#   bash supabase/tests/creator_withdraw.check.sh
set -euo pipefail

MIGRATION="supabase/migrations/20261023120000_creator_programme.sql"
DIR=$(mktemp -d)
PORT=54329
trap 'pg_ctl -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

initdb -D "$DIR/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
q() { psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qtAX "$@"; }

# Minimal stand-ins for what the migration expects on Supabase.
q <<'SQL'
create role anon; create role authenticated; create role service_role;
create table public.orders (
  id uuid primary key default gen_random_uuid(), status text not null,
  format text not null default 'hardcover', ready_email_sent_at timestamptz
);
SQL
q -f "$MIGRATION"
q <<'SQL'
insert into public.creators (id, email, handle, promo_code, stripe_promotion_code_id)
values ('00000000-0000-0000-0000-00000000000c', 'lara@example.com', 'lara_mamaestra', 'LARA10', 'promo_x');
insert into public.orders (id, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'delivered'),
  ('00000000-0000-0000-0000-0000000000a2', 'delivered'),
  ('00000000-0000-0000-0000-0000000000a3', 'shipped');
-- PDF orders stay 'producing': not ready yet (a4) vs ready email sent (a5)
insert into public.orders (id, status, format, ready_email_sent_at) values
  ('00000000-0000-0000-0000-0000000000a4', 'producing', 'digital_pdf', null),
  ('00000000-0000-0000-0000-0000000000a5', 'producing', 'digital_pdf', null);
insert into public.creator_commissions (creator_id, order_id, amount_total_cents, commission_cents) values
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a1', 20000, 1500),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a2', 20000, 1500),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a3', 20000, 9999), -- pending: not spendable
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a4', 891, 86),     -- PDF not ready: pending
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-0000000000a5', 891, 86);     -- PDF ready below
SQL
C="'00000000-0000-0000-0000-00000000000c'"
fail() { echo "FAIL: $*" >&2; exit 1; }
count() { q -c "select count(*) from public.creator_withdrawals $1"; }

# 1. Credit of 10 € (available 30 €) → code worth 20 €. Same request key again = same row.
id1=$(q -c "select id from public.creator_withdraw($C, 'credit', 1000, '11111111-1111-4111-8111-111111111111', 'MEACODE1')")
id2=$(q -c "select id from public.creator_withdraw($C, 'credit', 1000, '11111111-1111-4111-8111-111111111111', 'MEACODE2')")
[ "$id1" = "$id2" ] || fail "replayed request key created a second row"
[ "$(count "")" = 1 ] || fail "double click double-spent"
[ "$(q -c "select discount_cents from public.creator_withdrawals where id = '$id1'")" = 2000 ] || fail "credit is not 2x"

# 1b. A PDF counts once its ready email went out (the other PDF stays pending): 20 € + 0,86 €.
q -c "update public.orders set ready_email_sent_at = now() where id = '00000000-0000-0000-0000-0000000000a5'"
q -c "select public.creator_withdraw($C, 'credit', 2087, gen_random_uuid(), 'MEACODEX')" 2>/dev/null && fail "pending PDF counted as available"
idp=$(q -c "select id from public.creator_withdraw($C, 'credit', 86, gen_random_uuid(), 'MEACODEP')")
# A credit whose Stripe code never got created can be cancelled (balance released); an issued one with a code cannot.
q -c "update public.creator_withdrawals set status = 'cancelled' where id = '$idp'"
q -c "update public.creator_withdrawals set stripe_promotion_code_id = 'promo_1', status = 'cancelled' where id = '$id1'" 2>/dev/null && fail "cancelled a credit that has a Stripe code"
q -c "select public.creator_withdraw($C, 'credit', 86, gen_random_uuid(), 'MEACODEQ')" >/dev/null # back to exactly 20 €

# 2. More than the available balance (20 € left; the pending 99,99 € and PDF don't count) is refused.
q -c "select public.creator_withdraw($C, 'credit', 2001, gen_random_uuid(), 'MEACODE3')" 2>"$DIR/err" && fail "overspend accepted"
grep -q insufficient_balance "$DIR/err" || fail "unexpected error: $(cat "$DIR/err")"

# 3. Two payouts of 20 € racing (different keys): the row lock lets exactly one through.
psql -h "$DIR" -p "$PORT" -U postgres -d postgres -qtAX -c "begin; select public.creator_withdraw($C, 'payout', 2000, '22222222-2222-4222-8222-222222222222', null, 'ES9121000418450200051332', 'Lara Fernández', '12345678Z'); select pg_sleep(1.5); commit;" >/dev/null &
sleep 0.5
q -c "select public.creator_withdraw($C, 'payout', 2000, '33333333-3333-4333-8333-333333333333', null, 'ES9121000418450200051332', 'Lara Fernández', '12345678Z')" 2>"$DIR/err2" && fail "concurrent payout double-spent"
wait
grep -q insufficient_balance "$DIR/err2" || fail "unexpected error: $(cat "$DIR/err2")"
[ "$(count "where kind = 'payout'")" = 1 ] || fail "expected exactly one payout"

# 4. Cancelling the payout releases its 20 €; a payout must be the whole balance (not 19,99 €).
q -c "update public.creator_withdrawals set status = 'cancelled' where kind = 'payout'"
q -c "insert into public.orders (id, status) values ('00000000-0000-0000-0000-0000000000a6', 'delivered')"
q -c "insert into public.creator_commissions (creator_id, order_id, amount_total_cents, commission_cents) values ($C, '00000000-0000-0000-0000-0000000000a6', 5000, 500)"
q -c "select public.creator_withdraw($C, 'payout', 2000, gen_random_uuid(), null, 'ES9121000418450200051332', 'Lara Fernández', '12345678Z')" 2>/dev/null && fail "partial payout accepted (20 of 25 €)"
q -c "select public.creator_withdraw($C, 'payout', 2500, gen_random_uuid(), null, 'ES9121000418450200051332', 'Lara Fernández', '12345678Z')" >/dev/null
[ "$(q -c "select count(*) from public.creator_withdrawals where kind = 'payout' and status = 'requested'")" = 1 ] || fail "released balance not reusable"

# 4b. A commission's order can't be deleted (accounting record).
q -c "delete from public.orders where id = '00000000-0000-0000-0000-0000000000a1'" 2>/dev/null && fail "order with a commission deleted"

# 5. Clients can neither call the RPC nor read the tables.
q -c "set role authenticated; select public.creator_withdraw($C, 'credit', 100, gen_random_uuid(), 'MEACODE9')" 2>/dev/null && fail "authenticated can call the RPC"
q -c "set role anon; select count(*) from public.creator_withdrawals" 2>/dev/null && fail "anon can read withdrawals"

echo "creator_withdraw.check: all assertions passed"
