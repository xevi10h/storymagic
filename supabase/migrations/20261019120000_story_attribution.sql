-- First-touch attribution of each story (2026-10-19).
--
-- stories.attribution: which channel brought the visitor who created the story, so
-- scripts/growth-funnel.mjs can split stories → previews → checkouts → orders by source.
-- Shape (every key optional, written once by POST /api/stories, never updated):
--   { "utm_source", "utm_medium", "utm_campaign", "utm_content",  -- lower-case, ≤ 100 chars
--     "click_id",        -- NAME of the ad-click param present (gclid|fbclid|ttclid|msclkid), never its value
--     "referrer_host",   -- referring site host only (no path / query), "www." stripped
--     "landing_path" }   -- first page of that page load, no query string
-- null = created before this column, or by a client that captured nothing.
-- Consent-independent: the browser stores nothing (captured in JS memory and sent with the
-- story-creation request), so LSSI art. 22.2 does not apply; the record itself is our own
-- processing under legitimate interest (RGPD art. 6.1.f). See docs/technical-architecture.md.
-- Orders reach it through orders.story_id: no column on orders.
--
-- Not client-readable: stories uses column-level SELECT grants (20260930180000_paywall_columns)
-- and this column is deliberately not granted to authenticated; only the service role reads it.
-- No index: only read by full-table aggregates in the funnel script (small table).
-- The check keeps it a bounded object (the API already validates every key).
--
-- DEPLOY ORDER: additive (nullable column, no default, no rewrite). Either order works:
-- the API retries the insert without the column on PGRST204, so code deployed first
-- simply records nothing until this runs.
--
-- Rollback:
--   alter table public.stories drop column if exists attribution;

alter table public.stories
  add column if not exists attribution jsonb;

comment on column public.stories.attribution is
  'First-touch channel (UTMs, ad-click id name, referrer host, landing path) captured in memory by the browser and sent with POST /api/stories. Growth funnel, consent-independent.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stories_attribution_shape'
      and conrelid = 'public.stories'::regclass
  ) then
    alter table public.stories
      add constraint stories_attribution_shape
      check (attribution is null or (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) <= 2048));
  end if;
end $$;
