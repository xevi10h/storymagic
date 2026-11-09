-- Abandoned checkout inside the reminder consent (2026-11-09).
--
-- preview_reminders.checkout_abandoned_at: set by the Stripe webhook when a Checkout
-- Session of the story expires unpaid (checkout.session.expired; sessions live 1 h, see
-- /api/checkout). The reminder cron then sends the NEXT reminder of the sequence right
-- away, worded as "your order was left half-way" (src/lib/marketing/preview-reminders.ts).
-- It never adds an email: the sequence stays at most 3 emails per story, and only parents
-- who ticked the "remind me" box (express consent, LSSI 21.1) are written to. Stripe's own
-- recovery emails / promotional consent are not available to a Spanish business.
--
-- DEPLOY ORDER: additive (nullable column). Apply BEFORE deploying the code: the webhook
-- and the reminder cron read and write it.
-- Rollback: alter table public.preview_reminders drop column if exists checkout_abandoned_at;

alter table public.preview_reminders
  add column if not exists checkout_abandoned_at timestamptz;

comment on column public.preview_reminders.checkout_abandoned_at is
  'Last time a Checkout Session of this story expired unpaid. A reminder sent after it (last_sent_at > checkout_abandoned_at) has already covered it.';
