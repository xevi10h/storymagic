-- Customer notifications for bad outcomes + dispute hold (2026-09-30).
--
-- Every *_email_sent_at column is an exactly-once claim (same pattern as
-- confirmation_email_sent_at / ready_email_sent_at): the sender sets it with a
-- conditional UPDATE ... WHERE col IS NULL and clears it again if the send fails.
--
-- Apply BEFORE deploying the code that reads these columns (the dashboard API,
-- the cron and the webhooks select them).

alter table public.orders
  -- charge.refunded (full refund): "we've refunded you"
  add column if not exists refund_email_sent_at timestamptz,
  -- checkout.session.async_payment_failed: "your payment didn't go through"
  add column if not exists cancel_email_sent_at timestamptz,
  -- not shipped GELATO_STUCK_PRODUCING_HOURS after purchase: "it's running late"
  add column if not exists delay_email_sent_at timestamptz,
  -- Gelato failed / returned: "there's a problem, we'll contact you"
  add column if not exists problem_email_sent_at timestamptz,
  -- postcode in Canarias / Ceuta / Melilla: "we need another address"
  add column if not exists excluded_area_email_sent_at timestamptz,
  -- shipped email went out without a tracking code; this one carries it
  add column if not exists tracking_email_sent_at timestamptz,
  -- charge.dispute.created
  add column if not exists disputed_at timestamptz,
  -- Non-null = fulfilment paused by us (e.g. 'dispute'): never generated, never
  -- sent to print until an operator clears it.
  add column if not exists fulfilment_hold_reason text;

comment on column public.orders.refunded_at is
  'Full refund recorded. A goodwill refund on a shipped/delivered order keeps its status (history) and only sets this.';
comment on column public.orders.fulfilment_hold_reason is
  'Fulfilment paused by us (e.g. dispute). Cron + pipeline skip the order while set; clear it to resume.';
