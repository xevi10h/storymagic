-- Security hardening (audit 2026-09-30).
--
-- Principle after this migration: browsers (roles anon + authenticated, which
-- includes anonymous guests) only READ their own rows. Every write to a product
-- table goes through a Next.js API route that checks ownership and whitelists the
-- editable fields, then writes with the service role (which bypasses RLS/grants).
-- Showcase (example books) is read server-side with the service role and an
-- explicit column whitelist; is_showcase is set by an operator only.
--
-- Checked against the live schema on 2026-09-30 (pg_policies, relacl,
-- pg_constraint). Idempotent: every drop is IF EXISTS, grants/revokes are
-- repeatable, the FK swap drops before it re-adds.
--
-- DEPLOY ORDER: deploy the code of this change FIRST (it writes with the service
-- role and reads showcase with the service role; it works under the old grants),
-- THEN apply this migration. Applying it before the code breaks book creation
-- (POST /api/stories, /generate, /title, /dedication) and the showcase pages.
--
-- Rollback (per section) is noted inline.

-- ── 1. newsletter_subscribers: was ALL to public USING (true) ────────────────
-- Anyone with the anon key could read, edit and delete every subscriber email.
-- Writers: /api/newsletter + /api/waitlist (service role).
drop policy if exists "Service role can manage newsletter" on public.newsletter_subscribers;
revoke all on table public.newsletter_subscribers from anon, authenticated;

-- ── 2. rate_limits: same pattern ────────────────────────────────────────────
-- Anyone could delete their own (or everyone's) rate-limit rows. Writer:
-- src/lib/rate-limit.ts (service role).
drop policy if exists "Service role manages rate limits" on public.rate_limits;
revoke all on table public.rate_limits from anon, authenticated;

-- Keep a day of history (send-preview limits recipients per 24 h); service only.
create or replace function public.cleanup_old_rate_limits()
returns void
language plpgsql
set search_path = ''
as $function$
begin
  delete from public.rate_limits where created_at < now() - interval '1 day';
end;
$function$;
revoke execute on function public.cleanup_old_rate_limits() from public, anon, authenticated;
grant execute on function public.cleanup_old_rate_limits() to service_role;

-- ── 3. Product tables: no client writes ─────────────────────────────────────
-- Owners could UPDATE any column (is_showcase, status, generated_text, pdf_url,
-- cover/portrait/avatar paths, completion_*, final_*) and INSERT stories already
-- 'ready'. Writers now: /api/stories (+ /title, /dedication, /generate), the
-- fulfilment pipeline and scripts — all service role.
-- Rollback: re-grant insert/update/delete and re-create the dropped policies.
drop policy if exists "Users can insert own stories" on public.stories;
drop policy if exists "Users can update own stories" on public.stories;
drop policy if exists "Users can delete own stories" on public.stories;
revoke insert, update, delete, truncate, references, trigger on table public.stories from anon, authenticated;

drop policy if exists "Users can insert own story illustrations" on public.story_illustrations;
drop policy if exists "Users can update own story illustrations" on public.story_illustrations;
revoke insert, update, delete, truncate, references, trigger on table public.story_illustrations from anon, authenticated;

-- characters.avatar_url is a face-anchor path the server fetches with the service
-- role: a client-editable value let a user point it at another child's portrait.
drop policy if exists "Users can insert own characters" on public.characters;
drop policy if exists "Users can update own characters" on public.characters;
drop policy if exists "Users can delete own characters" on public.characters;
revoke insert, update, delete, truncate, references, trigger on table public.characters from anon, authenticated;

-- sagas: unused by the app; read-only for owners.
drop policy if exists "Users can insert own sagas" on public.sagas;
drop policy if exists "Users can update own sagas" on public.sagas;
drop policy if exists "Users can delete own sagas" on public.sagas;
revoke insert, update, delete, truncate, references, trigger on table public.sagas from anon, authenticated;

-- Tables that already had no client write policy: remove the grants too
-- (defence in depth — a future permissive policy must not silently open them).
revoke insert, update, delete, truncate, references, trigger on table public.character_preps from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.orders from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.blog_posts from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.illustration_library from anon, authenticated;
revoke all on table public.ops_alerts from anon, authenticated;
revoke all on table public.photo_consents from anon, authenticated;

-- profiles: owners may change only their display name (/api/profile). email and
-- avatar_url are not client-editable; rows are created by handle_new_user().
revoke insert, update, delete, truncate, references, trigger on table public.profiles from anon, authenticated;
grant update (name) on table public.profiles to authenticated;

-- ── 4. Showcase: no public row access ───────────────────────────────────────
-- These exposed EVERY column of showcase rows (user_id, story_decisions, sender,
-- characters' traits…) to anyone with the anon key. Showcase is read server-side
-- (src/lib/showcase.ts, /api/showcase*, /ejemplo) with the service role and a
-- column whitelist.
drop policy if exists "Anyone can read showcase stories" on public.stories;
drop policy if exists "Anyone can read illustrations of showcase stories" on public.story_illustrations;
drop policy if exists "Anyone can read characters of showcase stories" on public.characters;

-- ── 5. book-pdfs bucket: server-only ────────────────────────────────────────
-- PDFs are rendered and uploaded by the fulfilment pipeline and handed out as
-- short-lived signed URLs by /api/stories/[id]/pdf and /api/downloads/[token]
-- (both check a paid order) — all service role. Client upload/overwrite let a
-- user replace their book file; direct read skipped the paid-order check.
drop policy if exists "Users can upload own PDFs" on storage.objects;
drop policy if exists "Users can update own PDFs" on storage.objects;
drop policy if exists "Users can read own PDFs" on storage.objects;

-- ── 6. Orders are accounting records (kept 6 years): never cascade-delete ───
-- Deleting a story or an account used to delete its paid orders. Now the order
-- keeps its amounts/Stripe ids/shipping data with story_id / user_id set to NULL.
alter table public.orders alter column story_id drop not null;
alter table public.orders alter column user_id drop not null;

alter table public.orders drop constraint if exists orders_story_id_fkey;
alter table public.orders
  add constraint orders_story_id_fkey
  foreign key (story_id) references public.stories(id) on delete set null;

alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
