-- "¿Qué te frena?" on the book preview (2026-11-17).
--
-- One optional, one-tap answer per story from a parent who has seen the preview and has not
-- started paying (src/components/create/PreviewFeedback.tsx → POST /api/stories/{id}/feedback).
-- Why a table: the funnel showed 95 % leave on the preview / order screen and no analytics
-- tool says why (PostHog / GA4 need cookie consent, Vercel Web Analytics is off). No personal
-- data beyond the owner's user id; rows go with the story (on delete cascade).
-- Server-only (service role): RLS on, no policies, no client grants.
--
-- DEPLOY ORDER: additive. Apply BEFORE deploying the code (the route writes it).
-- Rollback: drop table if exists public.preview_feedback;

create table if not exists public.preview_feedback (
  story_id uuid primary key references public.stories (id) on delete cascade,
  user_id uuid not null,
  reason text not null check (reason in ('price', 'likeness', 'story', 'later', 'browsing')),
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preview_feedback enable row level security;
revoke all on table public.preview_feedback from anon, authenticated;

comment on table public.preview_feedback is
  'One-tap answer to "¿Qué te frena?" on the book preview, one row per story (last answer wins).';
