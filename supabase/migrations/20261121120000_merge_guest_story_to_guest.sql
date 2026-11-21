-- "Continue your book" links (src/lib/share/story-claim-token.ts → POST /api/stories/claim):
-- a parent who made a book as a guest in one browser (Instagram's in-app one) opens the
-- emailed link in another, where they are a NEW guest. The story must move guest → guest.
--
-- merge_guest_account() only accepted a permanent target. Now:
--   - full merge (p_story_ids NULL, deletes the source guest): target must still be permanent;
--   - partial merge (named stories only): target may be any existing user, guest or not.
-- Everything else is unchanged (same signature, same grants). Callers still prove ownership
-- (guest-merge cookie, verified order email, or a signed claim link).

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

  -- Source must still be anonymous (locked for the transaction). Target: permanent for a
  -- full merge; any existing user (another guest too) when only named stories move.
  perform 1 from auth.users where id = p_anon and is_anonymous is true for update;
  if not found then
    raise exception 'merge_guest_account: source is not an anonymous user';
  end if;
  perform 1 from auth.users where id = p_target and (not v_full or coalesce(is_anonymous, false) = false);
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
  'Moves an anonymous (guest) user''s books to another user. NULL p_story_ids = full merge into a permanent user + deletes the anonymous auth user; named stories may also move to another guest (claim links). Service role only; caller must prove ownership (src/lib/auth/guest-merge.ts).';
