-- Resumable, idempotent order fulfilment (audit 2026-09-27, P0 #3/#4/#8).
--
-- Adds checkpoint + lease columns so /api/stories/[id]/complete can be re-run
-- safely: each invocation continues where the previous one stopped (per-scene
-- checkpoint), a killed function is detected by an expired lease (resume, not
-- restart), Gelato submission is claimed + recorded (no duplicate print orders),
-- and failures are retried with backoff and escalated to the operator.
--
-- Additive only (no status values changed, no data rewritten). Safe to apply on
-- the live project before deploying the code that uses it.

-- ── Per-scene checkpoint ──────────────────────────────────────────────────────
alter table public.story_illustrations
  -- Which stage/model produced the stored image, e.g. 'final:fal:fal-ai/flux-2-flex'.
  -- NULL = produced by the preview (cheap) stage or legacy code.
  add column if not exists render_stage text,
  add column if not exists rendered_at timestamptz;

-- ── Story completion lease + progress ────────────────────────────────────────
alter table public.stories
  add column if not exists completion_lease_until timestamptz,
  add column if not exists completion_lease_owner text,
  -- Consecutive completion runs without success (incl. runs killed mid-way).
  add column if not exists completion_attempts integer not null default 0,
  add column if not exists completion_next_attempt_at timestamptz,
  add column if not exists completion_last_error text,
  add column if not exists final_qa_pass integer not null default 0,
  add column if not exists final_qa_done_at timestamptz,
  add column if not exists final_generated_at timestamptz;

-- ── Order fulfilment state ───────────────────────────────────────────────────
alter table public.orders
  -- Buyer email from Stripe Checkout (guests are anonymous auth users with no email).
  add column if not exists customer_email text,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists ready_email_sent_at timestamptz,
  -- Print files built + validated for THIS order (cover geometry depends on format).
  add column if not exists print_interior_path text,
  add column if not exists print_cover_path text,
  add column if not exists print_files_validated_at timestamptz,
  -- Gelato submission bookkeeping. gelato_submit_started_at set + gelato_order_id NULL
  -- means "outcome unknown" (function died mid-call): the next attempt searches Gelato
  -- by orderReferenceId before creating, because Gelato does not dedupe it.
  add column if not exists gelato_submit_attempts integer not null default 0,
  add column if not exists gelato_submit_started_at timestamptz,
  add column if not exists gelato_next_attempt_at timestamptz,
  add column if not exists gelato_last_error text,
  -- Raw last fulfillmentStatus reported by Gelato (incl. canceled/failed/returned).
  add column if not exists gelato_status text,
  -- Set when the operator was alerted that this order needs manual action.
  add column if not exists fulfilment_alerted_at timestamptz;

-- One local order per Gelato order (hard guard against double-recording).
create unique index if not exists orders_gelato_order_id_key
  on public.orders (gelato_order_id)
  where gelato_order_id is not null;

-- Cron sweep: paid orders not yet at Gelato.
create index if not exists orders_paid_unsubmitted_idx
  on public.orders (created_at)
  where status = 'paid' and gelato_order_id is null;

-- ── Operator alert dedupe ────────────────────────────────────────────────────
create table if not exists public.ops_alerts (
  key text primary key,
  last_sent_at timestamptz not null default now(),
  count integer not null default 1
);

alter table public.ops_alerts enable row level security;
-- No policies: only the service role (which bypasses RLS) can read/write.

-- Atomically claim the right to send alert `p_key`: returns true at most once per
-- `p_window_seconds`. Used to cap operator emails (e.g. provider out of credits).
create or replace function public.claim_ops_alert(p_key text, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  insert into public.ops_alerts as a (key, last_sent_at, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set last_sent_at = now(), count = a.count + 1
    where a.last_sent_at < now() - make_interval(secs => p_window_seconds)
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_ops_alert(text, integer) from public, anon, authenticated;
grant execute on function public.claim_ops_alert(text, integer) to service_role;
