-- "Pack Reyes" (owner decision 2026-10-26, rules in src/lib/second-book.ts): every printed
-- book paid until the printed Reyes cut-off earns ONE single-use code for a second book in
-- softcover at 19,90 € (Stripe promotion code on coupon meapica_second_book_softcover,
-- expires 6 Jan). A book paid with such a code earns none.
--
-- Server-only (service role): RLS on, no policies, no client grants.
-- DEPLOY ORDER: additive (new table). Apply BEFORE deploying the code (the webhook writes it,
-- best-effort: without the table no code is issued and the order goes through).
-- Rollback: drop table if exists public.second_book_codes;

create table if not exists public.second_book_codes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid,
  email text,
  code text not null,
  stripe_promotion_code_id text,
  locale text not null default 'es',
  expires_at timestamptz not null,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint second_book_codes_order_key unique (order_id),
  constraint second_book_codes_code_key unique (code),
  constraint second_book_codes_promotion_code_key unique (stripe_promotion_code_id),
  constraint second_book_codes_code_format check (code ~ '^[A-Z0-9]{4,24}$'),
  constraint second_book_codes_email_normalized check (email is null or (email = lower(btrim(email)) and email <> '')),
  constraint second_book_codes_locale_check check (locale in ('es', 'ca', 'en', 'fr'))
);

comment on table public.second_book_codes is
  'Pack Reyes: single-use 19,90 € softcover code earned by a paid printed book order. Service role only.';
comment on column public.second_book_codes.stripe_promotion_code_id is
  'promo_… on coupon meapica_second_book_softcover; null until created in Stripe (retried by the next call).';

create index if not exists second_book_codes_user_idx on public.second_book_codes (user_id);
create index if not exists second_book_codes_email_idx on public.second_book_codes (email);

alter table public.second_book_codes enable row level security;
revoke all on table public.second_book_codes from anon, authenticated;
