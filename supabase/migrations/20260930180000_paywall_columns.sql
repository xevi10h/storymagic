-- Paywall: the book's content is not client-readable (audit 2026-09-30).
--
-- Owners (role authenticated, incl. anonymous guests) could read their story's
-- FULL text straight from PostgREST with the public anon key + their session
-- (`GET /rest/v1/stories?select=generated_text`), and every scene's image prompt
-- (`story_illustrations.prompt_used`) — i.e. the whole book before paying. The
-- APIs now redact unpaid stories to the free preview (src/lib/preview-access.ts);
-- this closes the direct route.
--
-- After this migration:
--   * stories.generated_text and story_illustrations.prompt_used are readable by
--     the service role only; every other column keeps the owner-read RLS policy.
--     Routes that need generated_text read it with the service role and an
--     explicit user_id filter (/api/stories/[id], /pdf, /api/checkout,
--     /api/dashboard, /api/illustrations/sign).
--   * anon has no SELECT on either table (it never had a policy granting rows).
--   * owners can no longer read/sign objects of their story folders straight from
--     Storage; the app only ever hands out server-signed URLs (paywall-aware), so
--     nothing in the app uses that policy. Own portraits stay readable.
--
-- DEPLOY ORDER: deploy the code of this change FIRST (it no longer reads these
-- columns with the user's client), THEN apply this migration. Applying it before
-- breaks /api/stories/[id] (select *), the dashboard and checkout.
-- NOTE: a PostgREST `select=*` by an authenticated client on these tables now
-- fails with "permission denied": list columns explicitly (or use the service role).
-- New columns must be added to the grants below to be client-readable.
--
-- Column lists checked against the live schema on 2026-09-30 (PostgREST OpenAPI).
-- Rollback: grant select on table public.stories, public.story_illustrations to
-- authenticated; and re-create "illustrations_owner_read_story_images" from
-- 20260927140400_private_illustrations.sql.

-- ── 1. stories: every column except generated_text ───────────────────────────
revoke select on table public.stories from anon, authenticated;
grant select (
  id, user_id, character_id, template_id, creation_mode, story_decisions,
  dedication_text, sender_name, ending_choice, status, saga_id, saga_order,
  created_at, updated_at, pdf_url, is_showcase, title, cover_image_url,
  character_portrait_url, recraft_style_id, locale, art_style,
  completion_lease_until, completion_lease_owner, completion_attempts,
  completion_next_attempt_at, completion_last_error, final_qa_pass,
  final_qa_done_at, final_generated_at, character_prep_id, preview_progress
) on table public.stories to authenticated;

-- ── 2. story_illustrations: every column except prompt_used ──────────────────
revoke select on table public.story_illustrations from anon, authenticated;
grant select (
  id, story_id, scene_number, image_url, status, created_at, updated_at,
  render_stage, rendered_at
) on table public.story_illustrations to authenticated;

-- ── 3. Storage: no direct client read of story images ───────────────────────
drop policy if exists "illustrations_owner_read_story_images" on storage.objects;
