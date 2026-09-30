-- Global daily ceiling on paid AI previews (cost-abuse protection).
--
-- A bot can mint unlimited anonymous users, so per-user rate limits alone do not
-- bound spend. POST /api/stories/[id]/generate claims one slot per preview it
-- starts (src/lib/preview-cap-server.ts); once the day's cap (env DAILY_PREVIEW_CAP,
-- default 300, 0 = off) is full, new previews get 503 `daily_cap_reached` until
-- 00:00 UTC. Paid-order completion never goes through here.
--
-- Until this migration is applied the app falls back to counting today's
-- `generate_story` rows in rate_limits (approximate, not atomic).
--
-- Rollback: drop function public.claim_daily_preview(date, integer);
--           drop table public.daily_preview_counts;

create table if not exists public.daily_preview_counts (
  day date primary key,               -- UTC day
  count integer not null default 0,   -- previews started that day
  updated_at timestamptz not null default now()
);

alter table public.daily_preview_counts enable row level security;
revoke all on table public.daily_preview_counts from anon, authenticated;
-- No policies: only the service role (bypasses RLS) reads or writes it.

-- Atomically take one slot of day `p_day` if fewer than `p_cap` are taken.
-- Returns the slot number (1..p_cap) or NULL when the cap is already full.
-- INSERT … ON CONFLICT DO UPDATE locks the day's row, so concurrent callers are
-- serialised and the count can never pass p_cap.
create or replace function public.claim_daily_preview(p_day date, p_cap integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot integer;
begin
  if p_cap is null or p_cap < 1 then
    return null;
  end if;
  insert into public.daily_preview_counts as c (day, count, updated_at)
  values (p_day, 1, now())
  on conflict (day) do update
    set count = c.count + 1, updated_at = now()
    where c.count < p_cap
  returning c.count into slot;
  return slot;
end;
$$;

revoke all on function public.claim_daily_preview(date, integer) from public, anon, authenticated;
grant execute on function public.claim_daily_preview(date, integer) to service_role;
