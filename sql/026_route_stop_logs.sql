-- Migration 026: per-stop route log (replaces the paper driver tracker).
-- Run after 025.
--
-- Drivers used to fill out a paper Excel sheet for every bar stop on a Loop
-- night (~25 stops = 5 partner bars x 5 cycles, ~75 min/lap). Nothing about
-- the night was captured digitally beyond shuttle_pings (GPS) and door scans.
--
-- This table is the digital version of that sheet. 25 rows are pre-generated
-- per night by lib/routeStopLogs.generateStopsForEvent(); the driver fills
-- actual_arrival_at / riders_on / riders_off / riders_remaining / notes live
-- on /admin/driver. Leadership reads it under /leadership/drivers/route-log.
--
-- Delay is NOT stored. It's derived at read time as actual - scheduled.
--
-- Service-role only. The driver and leadership APIs both use supabaseAdmin();
-- no end-user RLS policies are needed.

create table if not exists public.route_stop_logs (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  stop_index          int  not null check (stop_index >= 1),
  cycle_index         int  not null check (cycle_index >= 1),
  bar_position        int  not null check (bar_position >= 1),
  bar_name            text not null,
  bar_slug            text,
  scheduled_at        timestamptz not null,
  actual_arrival_at   timestamptz,
  riders_on           int check (riders_on  >= 0),
  riders_off          int check (riders_off >= 0),
  riders_remaining    int check (riders_remaining >= 0),
  notes               text,
  logged_by_email     text,
  logged_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (event_id, stop_index)
);

create index if not exists route_stop_logs_event_idx
  on public.route_stop_logs (event_id, stop_index);

alter table public.route_stop_logs enable row level security;
