-- Commerce readiness (2026-09-28): refunds, tokenised download links, withdrawal
-- consent (art. 103 LGDCU), Stripe invoices, and no client-side order inserts.

-- 1. Statuses: 'cancelled' (Checkout expired — the webhook wrote it, but the check
--    rejected it, so Stripe retried forever) and 'refunded'.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'producing', 'shipped', 'delivered', 'cancelled', 'refunded'));

-- 2. New columns.
alter table public.orders
  add column if not exists download_token uuid not null default gen_random_uuid(),
  add column if not exists withdrawal_consent_at timestamptz,
  add column if not exists withdrawal_consent_version text,
  add column if not exists stripe_invoice_id text,
  add column if not exists invoice_url text,
  add column if not exists refunded_at timestamptz;

create unique index if not exists orders_download_token_key on public.orders (download_token);
-- Full (not partial) unique index so /api/checkout can upsert ON CONFLICT (NULLs stay distinct).
create unique index if not exists orders_stripe_checkout_session_id_key
  on public.orders (stripe_checkout_session_id);
create index if not exists orders_stripe_payment_id_idx
  on public.orders (stripe_payment_id) where stripe_payment_id is not null;

-- 3. Interim (until 20260928120100 drops it): the old checkout inserts with the
--    user's session, so keep INSERT but only for a fresh 'pending' row — a client
--    can no longer insert a 'paid' order that the cron would fulfil for free.
drop policy if exists "Users can insert own orders" on public.orders;
create policy "Users can insert own orders" on public.orders
  for insert
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and gelato_order_id is null
    and stripe_payment_id is null
  );
