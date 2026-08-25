-- Migration 028: weekend shift schedule for drivers + door security.
-- Run after 027.
--
-- Leadership manages who's working Friday vs Saturday for drivers and
-- security. Admin/staff page renders read-only. We push each shift to a
-- shared Google Calendar so the people working it can subscribe on their
-- phone instead of opening The Loop.
--
-- One row = one person, one night, one role. We don't model start/end
-- times — Brew Loop nights run roughly 6 PM to 1 AM and that's implicit.
-- Google Calendar events are stored as all-day on shift_date.

-- Allow the existing drivers roster to also represent door security so
-- one shift table can reference it. Existing rows keep their roles.
alter table public.drivers
  drop constraint if exists drivers_role_check;
-- (no prior CHECK constraint existed — the column was free text — but
-- the drop-if-exists keeps this idempotent in case one was added.)

create table if not exists public.staff_shifts (
  id              uuid primary key default gen_random_uuid(),
  shift_date      date not null,
  night           text not null check (night in ('fri', 'sat')),
  role            text not null check (role in ('driver', 'security')),
  driver_id       uuid references public.drivers(id) on delete set null,
  person_name     text not null,                  -- denormalized snapshot
  notes           text,
  gcal_event_id   text,                           -- set after GCal push
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists staff_shifts_date_idx
  on public.staff_shifts (shift_date);
create index if not exists staff_shifts_role_idx
  on public.staff_shifts (role);

alter table public.staff_shifts enable row level security;
