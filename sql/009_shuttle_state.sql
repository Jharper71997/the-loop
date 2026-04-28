-- Migration 009: native shuttle GPS tracking
-- Run in Supabase SQL Editor after migration 008.
--
-- Replaces the old Zenbus/Zenduit iframe at /track. The shuttle tablet logs
-- in to /driver, hits "Start route", and the page POSTs the current geolocation
-- to /api/shuttle/ping every ~10 seconds. Public /track polls
-- /api/shuttle/current (which returns the most recent row from the last 5
-- minutes) and renders the position on a Leaflet map.
--
-- Append-only — every ping is a row. Lets us draw a faint trail later if we
-- want to. is_active=false on the most recent row signals "off duty".

create table if not exists public.shuttle_pings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  speed_mph double precision,
  heading double precision,
  is_active boolean not null default true,
  recorded_at timestamptz not null default now()
);

create index if not exists shuttle_pings_recorded_idx
  on public.shuttle_pings (recorded_at desc);
