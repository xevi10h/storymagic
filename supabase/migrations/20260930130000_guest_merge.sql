-- Guest → account merge (auth rebuild, 2026-09-30).
--
-- A guest is an anonymous Supabase user. When a guest proves ownership of an email
-- that already has an account (or pays with that email on another device), their
-- books move to the permanent account. The server (service role) calls this function
-- only after verifying, in TypeScript:
--   * full merge  : an HMAC-signed HttpOnly cookie minted while the browser HELD the
--                   anonymous session (src/lib/auth/merge-token.ts) + the new
--                   permanent session;
--   * story merge : the permanent user's verified email equals orders.customer_email
--                   of orders owned by an anonymous user.
-- The function re-checks both users' anonymity itself, so it can never move data out
-- of a permanent account, and it is executable by service_role only.
--
-- Every row holding a user id (enumerated against the live schema 2026-09-30):
--   stories.user_id → profiles       moved (story_illustrations follow via story_id)
--   characters.user_id → profiles    moved; avatar_url portraits/<anon>/… rewritten
--   sagas.user_id → profiles         moved
--   orders.user_id → profiles        moved (only orders of moved stories)
--   character_preps.user_id → users  moved; UNIQUE (user_id, fingerprint) conflicts
--                                    reuse the account's identical prep
--   photo_consents.user_id → users   moved on full merge (legal proof kept;
--                                    photo_path keeps the old folder, photos are
--                                    deleted within 24 h anyway)
--   rate_limits.user_id (no FK)      not moved (ephemeral counters)
--   profiles.id                      target row ensured; anon row goes with the user
-- Text refs rewritten on moved rows: characters.avatar_url,
-- stories.character_portrait_url, character_preps.avatar_ref ('portraits/<anon>/' →
-- 'portraits/<target>/'), stories.pdf_url / orders.pdf_url ('<anon>/<story>.pdf').
-- Storage objects are copied by the caller BEFORE this runs (src/lib/auth/guest-merge.ts);
-- orders.print_interior_path / print_cover_path keep their stored paths (objects stay).
--
-- Full merge (p_story_ids NULL) also deletes the anonymous auth user in the same
-- transaction, so nothing can be left behind for the ON DELETE CASCADE to drop.

create or replace function public.merge_guest_account(
  p_anon uuid,
  p_target uuid,
  p_story_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full boolean := p_story_ids is null;
  v_anon_portraits text := 'portraits/' || p_anon::text || '/';
  v_target_portraits text := 'portraits/' || p_target::text || '/';
  v_stories uuid[];
  v_characters uuid[];
  v_sagas uuid[];
  v_preps uuid[];
  n_stories int := 0;
  n_characters int := 0;
  n_sagas int := 0;
  n_preps int := 0;
  n_orders int := 0;
  n_consents int := 0;
  n_deleted int := 0;
begin
  if p_anon is null or p_target is null or p_anon = p_target then
    raise exception 'merge_guest_account: invalid user pair';
  end if;

  -- Source must still be anonymous (locked for the transaction), target permanent.
  perform 1 from auth.users where id = p_anon and is_anonymous is true for update;
  if not found then
    raise exception 'merge_guest_account: source is not an anonymous user';
  end if;
  perform 1 from auth.users where id = p_target and coalesce(is_anonymous, false) = false;
  if not found then
    raise exception 'merge_guest_account: target is not a permanent user';
  end if;

  -- FK target for stories/characters/sagas/orders (normally created by handle_new_user).
  insert into public.profiles (id) values (p_target) on conflict (id) do nothing;

  select coalesce(array_agg(s.id), '{}') into v_stories
    from public.stories s
   where s.user_id = p_anon and (v_full or s.id = any (p_story_ids));

  if v_full then
    select coalesce(array_agg(c.id), '{}') into v_characters from public.characters c where c.user_id = p_anon;
    select coalesce(array_agg(g.id), '{}') into v_sagas from public.sagas g where g.user_id = p_anon;
    select coalesce(array_agg(p.id), '{}') into v_preps from public.character_preps p where p.user_id = p_anon;
  else
    select coalesce(array_agg(distinct c.id), '{}') into v_characters
      from public.characters c
      join public.stories s on s.character_id = c.id
     where c.user_id = p_anon and s.id = any (v_stories);
    select coalesce(array_agg(distinct g.id), '{}') into v_sagas
      from public.sagas g
      join public.stories s on s.saga_id = g.id
     where g.user_id = p_anon and s.id = any (v_stories);
    select coalesce(array_agg(distinct p.id), '{}') into v_preps
      from public.character_preps p
      join public.stories s on s.character_prep_id = p.id
     where p.user_id = p_anon and s.id = any (v_stories);
  end if;

  update public.characters
     set user_id = p_target,
         avatar_url = replace(avatar_url, v_anon_portraits, v_target_portraits)
   where id = any (v_characters);
  get diagnostics n_characters = row_count;

  update public.sagas set user_id = p_target where id = any (v_sagas);
  get diagnostics n_sagas = row_count;

  -- Preps the account already has (same fingerprint = same sheet): point the moved
  -- stories at the account's prep and drop the guest duplicate.
  update public.stories s
     set character_prep_id = t.id
    from public.character_preps a
    join public.character_preps t on t.user_id = p_target and t.fingerprint = a.fingerprint
   where a.id = any (v_preps) and s.character_prep_id = a.id;
  delete from public.character_preps a
   where a.id = any (v_preps)
     and exists (select 1 from public.character_preps t where t.user_id = p_target and t.fingerprint = a.fingerprint);

  update public.character_preps
     set user_id = p_target,
         avatar_ref = replace(avatar_ref, v_anon_portraits, v_target_portraits)
   where id = any (v_preps) and user_id = p_anon;
  get diagnostics n_preps = row_count;

  update public.stories
     set user_id = p_target,
         character_portrait_url = replace(character_portrait_url, v_anon_portraits, v_target_portraits),
         pdf_url = case when pdf_url = p_anon::text || '/' || id::text || '.pdf'
                        then p_target::text || '/' || id::text || '.pdf' else pdf_url end
   where id = any (v_stories);
  get diagnostics n_stories = row_count;

  update public.orders
     set user_id = p_target,
         pdf_url = case when pdf_url = p_anon::text || '/' || story_id::text || '.pdf'
                        then p_target::text || '/' || story_id::text || '.pdf' else pdf_url end
   where user_id = p_anon and story_id = any (v_stories);
  get diagnostics n_orders = row_count;

  if v_full then
    update public.photo_consents set user_id = p_target where user_id = p_anon;
    get diagnostics n_consents = row_count;

    delete from auth.users where id = p_anon and is_anonymous is true;
    get diagnostics n_deleted = row_count;
  end if;

  return jsonb_build_object(
    'stories', n_stories,
    'characters', n_characters,
    'sagas', n_sagas,
    'preps', n_preps,
    'orders', n_orders,
    'consents', n_consents,
    'anon_deleted', n_deleted = 1,
    'story_ids', to_jsonb(v_stories)
  );
end;
$$;

revoke all on function public.merge_guest_account(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.merge_guest_account(uuid, uuid, uuid[]) to service_role;

comment on function public.merge_guest_account(uuid, uuid, uuid[]) is
  'Moves an anonymous (guest) user''s books to a permanent user. NULL p_story_ids = full merge + deletes the anonymous auth user. Service role only; caller must prove ownership (src/lib/auth/guest-merge.ts).';
