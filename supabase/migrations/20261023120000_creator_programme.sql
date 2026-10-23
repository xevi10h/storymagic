-- Creator programme, owner decisions 2026-10-22 / 2026-10-23 (rules in src/lib/creators.ts):
--   * orders.promotion_code_id / promotion_code / discount_cents: the promotion code a paid
--     Checkout Session used (attribution, written by the Stripe webhook).
--   * creators: invite-only creators (operator registers email + handle + their audience
--     promotion code <NAME>10 from /admin/creators). Signing in with that email = the panel.
--   * creator_commissions: one row per order paid with a creator's audience code (unique
--     order_id = webhook idempotency). 10 % of the amount paid without VAT; recomputed on
--     refunds. Pending until orders.status = 'delivered', then available.
--   * creator_withdrawals: what leaves the balance. 'payout' = bank transfer requested by the
--     creator (min 20 €, reserved while 'requested', the operator marks it 'paid' or
--     'cancelled'); 'credit' = X € of balance turned into a single-use 2X € discount code.
--   * creator_withdraw(): the ONLY way to insert a withdrawal. Locks the creator row, replays
--     an already-used request key (double click) and refuses more than the available balance,
--     so two concurrent requests can never spend the same euros.
--
-- Everything is server-only (service role): RLS on, no policies, no client grants. The
-- creator reads their own rows through GET /api/creator, which matches the verified login
-- email. Payout rows hold IBAN, holder name and NIF: never exposed to other users.
--
-- DEPLOY ORDER: additive only. Apply it BEFORE deploying the code: the Stripe webhook writes
-- the new orders columns and creator_commissions on every promotion-code order and refund.
-- Rollback:
--   drop function if exists public.creator_withdraw(uuid, text, integer, uuid, text, text, text, text);
--   drop table if exists public.creator_withdrawals;
--   drop table if exists public.creator_commissions;
--   drop table if exists public.creators;
--   alter table public.orders drop column if exists promotion_code_id,
--     drop column if exists promotion_code, drop column if exists discount_cents;

-- ── 1. Order attribution ──────────────────────────────────────────────────────

alter table public.orders
  add column if not exists promotion_code_id text,
  add column if not exists promotion_code text,
  add column if not exists discount_cents integer;

comment on column public.orders.promotion_code_id is 'promo_… applied to the paid Checkout Session (null = none).';
comment on column public.orders.promotion_code is 'Customer-facing text of that promotion code (e.g. LARA10).';
comment on column public.orders.discount_cents is 'Checkout total_details.amount_discount, in cents (VAT included).';

-- ── 2. Creators ───────────────────────────────────────────────────────────────

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  handle text not null,
  promo_code text not null,
  stripe_promotion_code_id text not null,
  created_at timestamptz not null default now(),
  constraint creators_email_key unique (email),
  constraint creators_promo_code_key unique (promo_code),
  constraint creators_promotion_code_key unique (stripe_promotion_code_id),
  constraint creators_email_normalized check (email = lower(btrim(email)) and email like '%_@_%'),
  constraint creators_promo_code_format check (promo_code ~ '^[A-Z0-9]{4,24}$'),
  constraint creators_handle_format check (handle ~ '^[a-z0-9._]{1,30}$')
);

comment on table public.creators is
  'Invite-only creators: the login email that opens the creator panel and their audience promotion code. Service role only.';

alter table public.creators enable row level security;
revoke all on table public.creators from anon, authenticated;

-- ── 3. Commissions ────────────────────────────────────────────────────────────

create table if not exists public.creator_commissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_total_cents integer not null,
  amount_tax_cents integer not null default 0,
  amount_refunded_cents integer not null default 0,
  commission_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_commissions_order_key unique (order_id),
  constraint creator_commissions_amounts check (
    amount_total_cents >= 0 and amount_tax_cents >= 0 and amount_refunded_cents >= 0 and commission_cents >= 0
  )
);

comment on table public.creator_commissions is
  'One row per order paid with a creator audience code (unique order_id). State comes from orders.status: delivered = available. Service role only.';
comment on column public.creator_commissions.commission_cents is
  '10 % of (amount_total - amount_tax - VAT share of amount_refunded), recomputed on every charge.refunded.';

create index if not exists creator_commissions_creator_idx on public.creator_commissions (creator_id);

alter table public.creator_commissions enable row level security;
revoke all on table public.creator_commissions from anon, authenticated;

-- ── 4. Withdrawals (payouts + 2x credit codes) ───────────────────────────────

create table if not exists public.creator_withdrawals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete restrict,
  kind text not null,
  amount_cents integer not null,
  status text not null,
  request_key uuid not null,
  -- payout
  iban text,
  holder_name text,
  tax_id text,
  paid_at timestamptz,
  -- credit: the discount is always twice the balance spent
  discount_cents integer generated always as (case when kind = 'credit' then amount_cents * 2 end) stored,
  code text,
  stripe_promotion_code_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_withdrawals_request_key unique (creator_id, request_key),
  constraint creator_withdrawals_code_key unique (code),
  constraint creator_withdrawals_promotion_code_key unique (stripe_promotion_code_id),
  constraint creator_withdrawals_amount_check check (amount_cents > 0),
  constraint creator_withdrawals_paid_at_check check ((status = 'paid') = (paid_at is not null)),
  constraint creator_withdrawals_kind_check check (
    (kind = 'payout'
      and status in ('requested', 'paid', 'cancelled')
      and amount_cents >= 2000 -- CREATOR_PAYOUT_MIN_CENTS
      and iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
      and char_length(holder_name) between 3 and 80
      and tax_id ~ '^[A-Z0-9]{9}$'
      and code is null and stripe_promotion_code_id is null)
    or
    (kind = 'credit'
      and status = 'issued'
      and code ~ '^[A-Z0-9]{4,24}$'
      and iban is null and holder_name is null and tax_id is null)
  )
);

comment on table public.creator_withdrawals is
  'Balance leaving a creator: payout (bank transfer, reserved while requested) or credit (single-use 2x discount code). Insert only through creator_withdraw(). Service role only.';
comment on column public.creator_withdrawals.request_key is
  'Client idempotency key: a double click sends the same key and gets the same row back.';
comment on column public.creator_withdrawals.stripe_promotion_code_id is
  'Credit: promo_… on its own coupon meapica_creator_credit_<id>; null until created in Stripe (retried by the next panel load).';

create index if not exists creator_withdrawals_creator_idx on public.creator_withdrawals (creator_id);

alter table public.creator_withdrawals enable row level security;
revoke all on table public.creator_withdrawals from anon, authenticated;

-- ── 5. The double-spend guard ─────────────────────────────────────────────────

create or replace function public.creator_withdraw(
  p_creator_id uuid,
  p_kind text,
  p_amount_cents integer,
  p_request_key uuid,
  p_code text default null,
  p_iban text default null,
  p_holder_name text default null,
  p_tax_id text default null
)
returns public.creator_withdrawals
language plpgsql
set search_path = ''
as $$
declare
  v_row public.creator_withdrawals;
  v_available bigint;
begin
  -- Serialise every withdrawal of this creator: a concurrent request waits here and then
  -- sees the balance the first one left.
  perform 1 from public.creators where id = p_creator_id for update;
  if not found then
    raise exception 'creator_not_found';
  end if;

  -- Same request key = the same click delivered twice: return what it created.
  select * into v_row from public.creator_withdrawals where creator_id = p_creator_id and request_key = p_request_key;
  if found then
    return v_row;
  end if;

  -- Same rule as creatorBalance() in src/lib/creators.ts.
  select coalesce((
           select sum(c.commission_cents)
           from public.creator_commissions c
           join public.orders o on o.id = c.order_id
           where c.creator_id = p_creator_id and o.status = 'delivered'
         ), 0)
       - coalesce((
           select sum(w.amount_cents)
           from public.creator_withdrawals w
           where w.creator_id = p_creator_id and w.status <> 'cancelled'
         ), 0)
    into v_available;

  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > v_available then
    raise exception 'insufficient_balance';
  end if;

  insert into public.creator_withdrawals (creator_id, kind, amount_cents, status, request_key, code, iban, holder_name, tax_id)
  values (
    p_creator_id,
    p_kind,
    p_amount_cents,
    case when p_kind = 'credit' then 'issued' else 'requested' end,
    p_request_key,
    p_code,
    p_iban,
    p_holder_name,
    p_tax_id
  )
  returning * into v_row;
  return v_row;
end;
$$;

comment on function public.creator_withdraw(uuid, text, integer, uuid, text, text, text, text) is
  'Insert a payout request or a credit code if the creator''s available balance covers it (row lock + idempotent request key). Service role only.';

revoke all on function public.creator_withdraw(uuid, text, integer, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.creator_withdraw(uuid, text, integer, uuid, text, text, text, text) to service_role;
