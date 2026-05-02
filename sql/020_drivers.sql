-- Migration 020: drivers roster + assignments.
-- Run after 019.
--
-- Until now drivers exist only as shuttle_pings.is_active (migration 009)
-- and a free-text contractor name on expenses. The leadership scoreboard
-- needs a roster so card #12 ("Drivers available next weekend") can render.
--
-- Q2 task: find more drivers (Hoenish, Kelvin). Today the roster is
-- effectively Richard + Calhoun + Nathan with the latter two on backup.
-- This table is the source of truth from now on.

create table if not exists public.drivers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  status        text not null default 'prospect',  -- prospect | active | paused | inactive
  role          text not null default 'driver',    -- driver | liaison | both
  started_at    date,
  contact_id    uuid references public.contacts(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers (status);

alter table public.drivers enable row level security;

-- Optional per-event assignments — not required for v1 scoreboard
-- (which just counts active drivers), but lets v2 schedule who's
-- driving Friday vs. Saturday.
create table if not exists public.driver_assignments (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  assigned_at timestamptz not null default now(),
  notes       text
);

create index if not exists driver_assignments_event_idx
  on public.driver_assignments (event_id);
create index if not exists driver_assignments_driver_idx
  on public.driver_assignments (driver_id);

alter table public.driver_assignments enable row level security;

-- Seed current known drivers/liaisons per the team list in the Asana
-- weekly meeting "Needing back up drivers / Liaison" task. Names are
-- placeholders until Richard fills in phones + emails.
insert into public.drivers (name, status, role, notes) values
  ('Richard Stephen Flowers', 'active', 'both',    'Co-founder; primary driver on event nights'),
  ('Calhoun',                 'active', 'driver',  'Backup driver per Asana team list'),
  ('Nathan',                  'active', 'both',    'Driver + door security on event nights'),
  ('Willy',                   'active', 'liaison', 'Bar liaison'),
  ('Jacob Harper',            'active', 'liaison', 'Remote — liaison only when in town')
on conflict do nothing;
