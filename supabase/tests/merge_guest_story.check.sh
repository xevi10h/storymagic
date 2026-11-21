#!/usr/bin/env bash
# merge_guest_account target rules (migration 20261121120000_merge_guest_story_to_guest.sql)
# against a real, throwaway Postgres: never a Supabase project. Needs the Postgres binaries
# (brew install postgresql@16). Run from the repo root:
#   bash supabase/tests/merge_guest_story.check.sh
set -euo pipefail

MIGRATION="supabase/migrations/20261121120000_merge_guest_story_to_guest.sql"
DIR=$(mktemp -d)
PORT=54330
trap 'pg_ctl -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

initdb -D "$DIR/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
pg_ctl -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
q() { psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qtAX "$@"; }

# Minimal stand-ins for the Supabase tables the function touches.
q <<'SQL'
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, is_anonymous boolean);
create table public.profiles (id uuid primary key);
create table public.characters (id uuid primary key, user_id uuid, avatar_url text);
create table public.sagas (id uuid primary key, user_id uuid);
create table public.character_preps (id uuid primary key, user_id uuid, fingerprint text, avatar_ref text);
create table public.stories (id uuid primary key, user_id uuid, character_id uuid, saga_id uuid, character_prep_id uuid,
  character_portrait_url text, pdf_url text);
create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid, story_id uuid, status text, pdf_url text);
create table public.photo_consents (id uuid primary key default gen_random_uuid(), user_id uuid);
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1', true),   -- guest who made the book (Instagram)
  ('00000000-0000-0000-0000-0000000000a2', true),   -- same parent, new guest in Safari
  ('00000000-0000-0000-0000-0000000000b1', false);  -- registered account
insert into public.profiles values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'), ('00000000-0000-0000-0000-0000000000b1');
insert into public.characters values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'portraits/00000000-0000-0000-0000-0000000000a1/x.webp');
insert into public.stories values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', null, null,
   'portraits/00000000-0000-0000-0000-0000000000a1/x.webp', null),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', null, null, null, null, null);
insert into public.orders (user_id, story_id, status) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'pending');
SQL
q -f "$MIGRATION"

fail() { echo "FAIL: $1"; exit 1; }

# 1. Partial merge guest → guest: the story, its character and its unpaid order move.
q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', array['00000000-0000-0000-0000-0000000000d1']::uuid[])" >/dev/null
[ "$(q -c "select user_id from public.stories where id = '00000000-0000-0000-0000-0000000000d1'")" = "00000000-0000-0000-0000-0000000000a2" ] || fail "story not moved to the new guest"
[ "$(q -c "select user_id from public.orders where story_id = '00000000-0000-0000-0000-0000000000d1'")" = "00000000-0000-0000-0000-0000000000a2" ] || fail "pending order not moved"
[ "$(q -c "select avatar_url from public.characters where id = '00000000-0000-0000-0000-0000000000c1'")" = "portraits/00000000-0000-0000-0000-0000000000a2/x.webp" ] || fail "portrait ref not rewritten"
[ "$(q -c "select user_id from public.stories where id = '00000000-0000-0000-0000-0000000000d2'")" = "00000000-0000-0000-0000-0000000000a1" ] || fail "an unnamed story moved"
[ "$(q -c "select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000a1'")" = "1" ] || fail "partial merge deleted the source guest"

# 2. Full merge into a guest is still refused.
if q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', null)" >/dev/null 2>&1; then
  fail "full merge into a guest was allowed"
fi

# 3. Never from a registered account, whatever the target.
if q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', array['00000000-0000-0000-0000-0000000000d1']::uuid[])" >/dev/null 2>&1; then
  fail "a registered account's story was moved"
fi

# 4. Unknown target refused.
if q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000ff', array['00000000-0000-0000-0000-0000000000d1']::uuid[])" >/dev/null 2>&1; then
  fail "an unknown target was allowed"
fi

# 5. Guest → registered account (partial and full) still works.
q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', array['00000000-0000-0000-0000-0000000000d1']::uuid[])" >/dev/null
[ "$(q -c "select user_id from public.stories where id = '00000000-0000-0000-0000-0000000000d1'")" = "00000000-0000-0000-0000-0000000000b1" ] || fail "guest → account partial merge"
q -c "select public.merge_guest_account('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', null)" >/dev/null
[ "$(q -c "select count(*) from auth.users where id = '00000000-0000-0000-0000-0000000000a1'")" = "0" ] || fail "full merge did not delete the guest"

echo "merge_guest_story: all checks passed"
