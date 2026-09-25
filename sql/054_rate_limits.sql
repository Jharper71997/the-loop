-- Brew Loop — Postgres-backed rate limiting
--
-- The app's existing limiters (/api/my-tickets, /api/marines/my-tickets,
-- POST /api/chat) are module-level JavaScript Maps. On Vercel that is per
-- lambda instance and resets on every cold start, so the advertised "10 per
-- minute" is really "10 per minute per warm instance" — not a control. The
-- public endpoints it was meant to protect are the ones that hand out
-- boarding-pass codes, send metered SMS, and hold shuttle seats.
--
-- Fixed-window counter behind a security-definer RPC, so anon callers never
-- touch the table directly. Fail-open by design: lib/rateLimit.js treats any
-- error as "allowed", because a limiter problem must never block a sale.
--
-- Idempotent, safe to re-run. Apply in the Supabase SQL editor.

create table if not exists rate_limits (
  bucket       text        not null,
  key          text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (bucket, key, window_start)
);

alter table rate_limits enable row level security;
-- No policies on purpose: only the security-definer RPC and the service role
-- touch this table.

create or replace function check_rate_limit(
  p_bucket text,
  p_key text,
  p_max int,
  p_window_secs int
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  w timestamptz := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_secs) * p_window_secs
  );
  c int;
begin
  insert into rate_limits (bucket, key, window_start, count)
  values (p_bucket, p_key, w, 1)
  on conflict (bucket, key, window_start)
    do update set count = rate_limits.count + 1
  returning count into c;

  -- Prune this key's stale windows on the way through so the table self-cleans.
  delete from rate_limits
   where bucket = p_bucket and key = p_key and window_start < w;

  return c <= p_max;
end; $$;
