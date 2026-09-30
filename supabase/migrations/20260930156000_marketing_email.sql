-- Commercial email to existing customers (LSSI art. 21.2 + 22.1), owner decisions 2026-09-30:
--   * the purchase panel offers an opt-out at collection ("No quiero recibir ofertas…"),
--     stored per order in orders.marketing_opt_out;
--   * email_suppressions is the list of addresses that must never receive commercial
--     content again (unsubscribe link, one-click List-Unsubscribe, or the checkout opt-out);
--   * one "PDF → papel" reminder per PDF order, 7 days after its book_ready email,
--     claimed exactly once through orders.upsell_reminder_sent_at.
--
-- orders.marketing_opt_out is NULL for orders placed before the opt-out existed: the
-- opportunity to object at collection was not offered, so they never get commercial
-- content by email (the code treats only an explicit `false` as "may receive offers").
--
-- DEPLOY ORDER: additive only (nullable columns, new table, partial index): apply it
-- BEFORE deploying the code, which reads and writes these columns.
-- Rollback:
--   drop index if exists public.orders_upsell_reminder_due_idx;
--   drop table if exists public.email_suppressions;
--   alter table public.orders drop column if exists upsell_reminder_sent_at, drop column if exists marketing_opt_out;

alter table public.orders
  add column if not exists marketing_opt_out boolean,
  add column if not exists upsell_reminder_sent_at timestamptz;

comment on column public.orders.marketing_opt_out is
  'Buyer ticked "no offers by email" at checkout (true), did not (false), or ordered before the opt-out existed (null = never send commercial email).';
comment on column public.orders.upsell_reminder_sent_at is
  'Exactly-once claim of the PDF-to-print reminder email (cron /api/cron/upsell-reminders).';

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null,
  source text,
  created_at timestamptz not null default now(),
  constraint email_suppressions_email_key unique (email),
  constraint email_suppressions_email_normalized check (email = lower(btrim(email)) and email <> ''),
  constraint email_suppressions_reason_check check (reason in ('unsubscribed', 'checkout_opt_out'))
);

comment on table public.email_suppressions is
  'Addresses (lowercase, trimmed) that never receive commercial email content. Service role only.';

-- Service role only: no policies, and no grants for the client roles.
alter table public.email_suppressions enable row level security;
revoke all on table public.email_suppressions from anon, authenticated;

-- The reminder cron scans PDF orders whose ready email went out 7-10 days ago.
create index if not exists orders_upsell_reminder_due_idx
  on public.orders (ready_email_sent_at)
  where format = 'digital_pdf' and upsell_reminder_sent_at is null and marketing_opt_out = false;
