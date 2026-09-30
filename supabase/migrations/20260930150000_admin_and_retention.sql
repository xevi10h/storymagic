-- Operator panel (/admin) + GDPR data lifecycle (2026-09-30).
--
-- Additive. Apply BEFORE deploying the code that uses it: the fulfilment cron
-- selects orders.fulfilment_requeued_at, the pipeline reads gelato_reprint_count.
-- Every new table is service-role only: RLS on, no policies, no grants to
-- anon/authenticated.

-- ── 1. Orders survive account erasure ────────────────────────────────────────
-- Paid orders are accounting records (6 years, art. 30 Código de Comercio) and
-- are KEPT when a customer erases their account; the erasure routine sets
-- user_id / story_id to NULL itself. The FKs become ON DELETE SET NULL in the
-- security migration; dropping NOT NULL here is idempotent with it and is what
-- the explicit UPDATE needs.
alter table public.orders alter column user_id drop not null;
alter table public.orders alter column story_id drop not null;

-- ── 2. Operator re-queue + reprint ───────────────────────────────────────────
-- fulfilment_requeued_at: an operator re-queued the order from /admin. The cron's
--   auto-processing window (48 h) is measured from greatest(created_at, this), so
--   an order of any age can be sent (again) to Gelato.
-- gelato_reprint_count: number of reprints. Gelato does not dedupe
--   orderReferenceId and the submitter adopts any live order with our reference,
--   so a reprint uses a new reference: meapica-{id}-r{n}.
alter table public.orders
  add column if not exists fulfilment_requeued_at timestamptz,
  add column if not exists gelato_reprint_count integer not null default 0;

create index if not exists orders_requeued_idx
  on public.orders (fulfilment_requeued_at) where fulfilment_requeued_at is not null;
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ── 3. Order status history ──────────────────────────────────────────────────
create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  gelato_status text,
  changed_at timestamptz not null default now()
);
create index if not exists order_status_history_order_idx
  on public.order_status_history (order_id, changed_at);
alter table public.order_status_history enable row level security;
revoke all on public.order_status_history from anon, authenticated;

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, gelato_status)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, new.gelato_status);
  end if;
  return new;
end;
$$;
revoke all on function public.log_order_status_change() from public, anon, authenticated;

drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();

-- Seed: one row per existing order with its current status (history starts today).
insert into public.order_status_history (order_id, from_status, to_status, gelato_status, changed_at)
select o.id, null, o.status, o.gelato_status, coalesce(o.updated_at, o.created_at)
from public.orders o
where not exists (select 1 from public.order_status_history h where h.order_id = o.id);

-- ── 4. Operator audit log (/admin actions) ───────────────────────────────────
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  order_id uuid,
  story_id uuid,
  ok boolean not null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_log_order_idx on public.admin_audit_log (order_id, created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- ── 5. Erasure register (art. 5.2 / 17 RGPD accountability) ──────────────────
-- Proof that an erasure happened and what was kept (paid orders), without the
-- erased data: the user id (a random uuid no remaining row points to), counts,
-- and the ids of the anonymised orders. No email, no names.
create table if not exists public.account_erasures (
  id bigint generated always as identity primary key,
  erased_at timestamptz not null default now(),
  user_id uuid not null,
  trigger text not null check (trigger in ('self_service', 'guest_purge', 'admin')),
  was_anonymous boolean not null,
  counts jsonb not null default '{}'::jsonb,
  kept_order_ids uuid[] not null default '{}'
);
create index if not exists account_erasures_user_idx on public.account_erasures (user_id);
alter table public.account_erasures enable row level security;
revoke all on public.account_erasures from anon, authenticated;
