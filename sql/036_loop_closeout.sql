-- Migration 036: admin loop close-out.
-- Run in the Supabase SQL editor after 035.
--
-- The admin surfaces (Tonight dashboard, driver page, contacts/tickets/waivers,
-- messaging) used to hide a loop once its event_date passed "today", which made
-- Friday's loop vanish at midnight while the night was still running. They now
-- key off closed_out_at instead: a loop stays OPEN (visible everywhere on the
-- admin side, regardless of date) until staff press "Close out loop", which
-- stamps closed_out_at. Rider-facing pages keep their own (4 AM) time cutoff.

alter table public.groups
  add column if not exists closed_out_at timestamptz;

-- Backfill: close out anything more than 2 days old so the now-date-agnostic
-- admin views don't surface a backlog of historical loops on first deploy.
update public.groups
  set closed_out_at = now()
  where closed_out_at is null
    and event_date is not null
    and event_date < (current_date - interval '2 days');

-- Fast "which loops are still open?" lookup.
create index if not exists groups_open_idx
  on public.groups (event_date) where closed_out_at is null;
