-- Migration 038: Sold-out waitlist — capture overflow demand per event/stop.
-- Run in the Supabase SQL editor after 037.
--
-- When a stop is sold out, riders join a waitlist instead of bouncing. The
-- list quantifies demand we couldn't serve (a renewal/expansion signal for the
-- per-bar dashboard) and lets us reach back out if a seat frees up.
-- Service-role only (writes go through /api/waitlist with the service key);
-- RLS ON with no policy = deny-all to the anon key.

create table if not exists public.event_waitlist (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  stop_index     integer,                                   -- which stop/bar (nullable)
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  party_size     integer not null default 1 check (party_size > 0),
  notified_at    timestamptz,                               -- set when we reach back out
  created_at     timestamptz not null default now()
);

create index if not exists event_waitlist_event_idx on public.event_waitlist (event_id);
create index if not exists event_waitlist_stop_idx on public.event_waitlist (event_id, stop_index);

alter table public.event_waitlist enable row level security;
