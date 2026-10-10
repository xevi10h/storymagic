-- Growth features, owner decisions 2026-10-09 (rules in src/lib/promo-codes.ts):
--   * referral_codes: one personal referral code per paid book order (a Stripe promotion
--     code on coupon meapica_referral_10). Printed as a QR on the book's last inner page,
--     shown in the order emails and the library.
--   * referral_rewards: the single-use 10 € code a referrer earns when a NEW customer pays
--     a printed book with their code. Exactly one per referred order (unique), email
--     claimed exactly once through email_sent_at.
--   * gift_vouchers: gift vouchers for one format (single-purpose voucher), one row per paid
--     Checkout Session (unique: Stripe retries the webhook), redeemed by a single-use code
--     on a 100 %-off coupon restricted to that format.
--
-- All three are server-only (service role): RLS on, no policies, no client grants.
--
-- DEPLOY ORDER: additive only (new tables). Apply it BEFORE deploying the code: the Stripe
-- webhook writes these tables (referral codes are created best-effort, but a voucher sale
-- retries until its row exists).
-- Rollback:
--   drop table if exists public.referral_rewards;
--   drop table if exists public.referral_codes;
--   drop table if exists public.gift_vouchers;

-- ── 1. Referral codes ─────────────────────────────────────────────────────────

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid,
  email text,
  stripe_customer_id text,
  code text not null,
  stripe_promotion_code_id text,
  locale text not null default 'es',
  created_at timestamptz not null default now(),
  constraint referral_codes_order_key unique (order_id),
  constraint referral_codes_code_key unique (code),
  constraint referral_codes_promotion_code_key unique (stripe_promotion_code_id),
  constraint referral_codes_code_format check (code ~ '^[A-Z0-9]{4,24}$'),
  constraint referral_codes_email_normalized check (email is null or (email = lower(btrim(email)) and email <> '')),
  constraint referral_codes_locale_check check (locale in ('es', 'ca', 'en', 'fr'))
);

comment on table public.referral_codes is
  'Personal referral code of a paid book order (10 € off a printed book for a friend). Service role only.';
comment on column public.referral_codes.email is
  'Normalised buyer email of the order (reward recipient; self-referral check).';
comment on column public.referral_codes.stripe_promotion_code_id is
  'promo_… on coupon meapica_referral_10; null until created in Stripe (retried by the next call).';

create index if not exists referral_codes_user_idx on public.referral_codes (user_id);

alter table public.referral_codes enable row level security;
revoke all on table public.referral_codes from anon, authenticated;

-- ── 2. Referral rewards ───────────────────────────────────────────────────────

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  referred_order_id uuid not null references public.orders(id) on delete cascade,
  referrer_email text not null,
  code text not null,
  stripe_promotion_code_id text,
  locale text not null default 'es',
  expires_at timestamptz not null,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referral_rewards_referred_order_key unique (referred_order_id),
  constraint referral_rewards_code_key unique (code),
  constraint referral_rewards_promotion_code_key unique (stripe_promotion_code_id),
  constraint referral_rewards_code_format check (code ~ '^[A-Z0-9]{4,24}$'),
  constraint referral_rewards_email_normalized check (referrer_email = lower(btrim(referrer_email)) and referrer_email <> ''),
  constraint referral_rewards_locale_check check (locale in ('es', 'ca', 'en', 'fr'))
);

comment on table public.referral_rewards is
  'Single-use 10 € code earned by a referrer, one per referred order (unique = webhook idempotency). Service role only.';
comment on column public.referral_rewards.email_sent_at is
  'Exactly-once claim of the reward email (released if the send fails).';

create index if not exists referral_rewards_code_idx on public.referral_rewards (referral_code_id);

alter table public.referral_rewards enable row level security;
revoke all on table public.referral_rewards from anon, authenticated;

-- ── 3. Gift vouchers ──────────────────────────────────────────────────────────

create table if not exists public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  format text not null,
  amount_cents integer not null,
  buyer_email text not null,
  buyer_name text,
  stripe_checkout_session_id text not null,
  stripe_payment_id text,
  stripe_invoice_id text,
  stripe_promotion_code_id text,
  locale text not null default 'es',
  recipient_name text,
  message text,
  expires_at timestamptz,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz,
  refunded_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gift_vouchers_code_key unique (code),
  constraint gift_vouchers_session_key unique (stripe_checkout_session_id),
  constraint gift_vouchers_promotion_code_key unique (stripe_promotion_code_id),
  constraint gift_vouchers_code_format check (code ~ '^[A-Z0-9]{4,24}$'),
  constraint gift_vouchers_format_check check (format in ('hardcover', 'softcover', 'digital_pdf')),
  constraint gift_vouchers_amount_check check (amount_cents > 0),
  constraint gift_vouchers_locale_check check (locale in ('es', 'ca', 'en', 'fr')),
  constraint gift_vouchers_recipient_length check (recipient_name is null or char_length(recipient_name) <= 40),
  constraint gift_vouchers_message_length check (message is null or char_length(message) <= 240)
);

comment on table public.gift_vouchers is
  'Gift vouchers for one book format (single-purpose voucher, VAT charged at sale). One row per paid Checkout Session. Service role only.';
comment on column public.gift_vouchers.expires_at is
  'Null: vouchers never expire (owner decision 2026-10-10). If a dated campaign ever sets it, it is also the Stripe promotion code expires_at.';
comment on column public.gift_vouchers.redeemed_order_id is
  'Order paid with the voucher code (set by the Stripe webhook, first redemption wins).';
comment on column public.gift_vouchers.email_sent_at is
  'Exactly-once claim of the voucher email to the buyer (released if the send fails).';

create index if not exists gift_vouchers_payment_idx on public.gift_vouchers (stripe_payment_id);

alter table public.gift_vouchers enable row level security;
revoke all on table public.gift_vouchers from anon, authenticated;
