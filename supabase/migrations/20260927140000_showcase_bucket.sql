-- Public `showcase` bucket for marketing imagery (audit 2026-09-27: children's
-- illustrations must not be world-readable).
--
-- Holds ONLY what is meant to be public: copies of the example books flagged
-- stories.is_showcase (same object paths as in `illustrations`), the waitlist
-- covers and style samples. Filled by `scripts/publish-showcase.mts` (service role).
--
-- Additive; apply FIRST (before publish-showcase and before the code deploy).
-- No policies on storage.objects for this bucket: public buckets serve objects by
-- URL without RLS; listing/writing stays service-role only.

insert into storage.buckets (id, name, public)
values ('showcase', 'showcase', true)
on conflict (id) do update set public = true;
