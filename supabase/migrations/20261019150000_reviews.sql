-- Customer reviews on our own site (owner decision 2026-10-19).
--
-- 1. orders.shipped_at / orders.delivered_at: first time an order reached 'shipped' and
--    'delivered'. Set by a trigger on the status column, so the Gelato webhook, the
--    reconciliation sweep and admin fixes all record them and the app never writes them
--    (the fulfilment code works before and after this migration).
--    Existing shipped/delivered orders are backfilled with updated_at (approximate; the
--    review cron only emails orders whose due date is at most 14 days old).
--
-- 2. orders.review_request_sent_at: exactly-once claim of the single review-request email
--    per order (cron /api/cron/review-requests, rules in src/lib/reviews/review-schedule.ts).
--
-- 3. reviews: one per order (unique order_id), written ONLY by the server (service role)
--    after verifying the signed link of that email. rating 1-5, optional body (<= 1000
--    chars), display name chosen by the customer (<= 40 chars), locale, explicit publish
--    consent. status: pending (no consent, or held for moderation), published (shown on
--    the site and in the Product JSON-LD), hidden (taken down by the owner). Published
--    rows are read server-side with an explicit column whitelist; no client role can
--    read or write the table. Deleted with the order (cascade) and on account erasure.
--
-- DEPLOY ORDER: additive only (nullable columns, new table, a trigger that only fills
-- the new columns). Apply BEFORE adding the cron to production traffic: the cron route
-- and the review API answer "migration_pending" / 503 without these objects, and the
-- public pages simply show no reviews, so deploying the code first is harmless.
--
-- Rollback:
--   drop table if exists public.reviews;
--   drop trigger if exists orders_fulfilment_timestamps on public.orders;
--   drop function if exists public.orders_fulfilment_timestamps();
--   drop index if exists public.orders_review_request_printed_idx;
--   drop index if exists public.orders_review_request_pdf_idx;
--   alter table public.orders drop column if exists shipped_at, drop column if exists delivered_at,
--     drop column if exists review_request_sent_at;

-- ── 1. Fulfilment timestamps ───────────────────────────────────────────────────

alter table public.orders
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists review_request_sent_at timestamptz;

comment on column public.orders.shipped_at is
  'First time the order reached status shipped (or delivered). Set by trigger orders_fulfilment_timestamps.';
comment on column public.orders.delivered_at is
  'First time the order reached status delivered. Set by trigger orders_fulfilment_timestamps.';
comment on column public.orders.review_request_sent_at is
  'Exactly-once claim of the review-request email (cron /api/cron/review-requests).';

create or replace function public.orders_fulfilment_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('shipped', 'delivered') and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_fulfilment_timestamps on public.orders;
create trigger orders_fulfilment_timestamps
  before insert or update of status on public.orders
  for each row execute function public.orders_fulfilment_timestamps();

update public.orders
set shipped_at = coalesce(shipped_at, updated_at),
    delivered_at = case when status = 'delivered' then coalesce(delivered_at, updated_at) else delivered_at end
where status in ('shipped', 'delivered') and (shipped_at is null or (status = 'delivered' and delivered_at is null));

-- The review cron scans printed orders shipped in the last few weeks and PDF orders
-- whose book_ready email went out in the last few weeks, not yet asked.
create index if not exists orders_review_request_printed_idx
  on public.orders (shipped_at)
  where review_request_sent_at is null and format <> 'digital_pdf';
create index if not exists orders_review_request_pdf_idx
  on public.orders (ready_email_sent_at)
  where review_request_sent_at is null and format = 'digital_pdf';

-- ── 2. Reviews ─────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rating smallint not null,
  body text,
  display_name text not null,
  locale text not null,
  publish_consent boolean not null default false,
  status text not null default 'pending',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_order_key unique (order_id),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_body_check check (body is null or char_length(body) between 1 and 1000),
  constraint reviews_display_name_check check (char_length(btrim(display_name)) between 2 and 40),
  constraint reviews_locale_check check (locale in ('es', 'ca', 'en', 'fr')),
  constraint reviews_status_check check (status in ('pending', 'published', 'hidden')),
  -- Never public without the customer's consent.
  constraint reviews_published_needs_consent check (status <> 'published' or (publish_consent and published_at is not null))
);

comment on table public.reviews is
  'Customer reviews, one per order, written by the server after a signed review link. Service role only; published rows are shown on the site.';

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;

-- Public pages read the newest published reviews.
create index if not exists reviews_published_idx
  on public.reviews (published_at desc)
  where status = 'published';
