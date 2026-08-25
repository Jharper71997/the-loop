-- Migration 043: "The Loop" (Marines) as a separate product on the Brew Loop
-- engine. Run in the Supabase SQL editor after 042.
--
-- The Loop reuses the whole Brew Loop machinery (groups -> events ->
-- ticket_types -> orders -> shuttle_pings), but it is a DISTINCT product:
-- a Marine-gated daytime shuttle on a fixed "red line" route, priced
-- Single Ride $10 / Day Pass $20, themed as just "The Loop".
--
-- The single biggest risk of adding a second product is that every
-- "next on-sale event" query across the app silently starts picking up
-- Marines loops and leaking them into Brew Loop surfaces (the /events feed,
-- /track, /admin, /leadership, revenue). To prevent that we tag each loop
-- with a `kind` and filter by it everywhere a loop is selected:
--   - Brew Loop queries:  .eq('kind','brew')
--   - The Loop queries:   .eq('kind','marines')
-- Default is 'brew' so all existing rows + queries keep working unchanged.
--
-- `kind` lives on BOTH groups and events (kept in sync at creation by
-- scripts/build-marines-weekend.js) so queries that hit either table can
-- filter without a join.

alter table public.groups
  add column if not exists kind text not null default 'brew'
    check (kind in ('brew','marines'));
create index if not exists groups_kind_idx on public.groups (kind);

alter table public.events
  add column if not exists kind text not null default 'brew'
    check (kind in ('brew','marines'));
create index if not exists events_kind_idx on public.events (kind);

-- Per-rider boarding history for The Loop driver manifest ("where each rider
-- is"). A Day Pass rider hops on and off many times in a day, so a single
-- mutable row can't capture the history — every board/alight is its own row.
-- "On board now" = the rider's latest row for the group is action='board'.
-- This is the Marines analog of route_stop_logs (which is per-stop aggregate);
-- this is per-rider.
create table if not exists public.loop_boardings (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  contact_id    uuid references public.contacts(id) on delete set null,
  order_item_id uuid references public.order_items(id) on delete set null,
  stop_index    int,                                  -- which stop they boarded/left at
  action        text not null default 'board' check (action in ('board','alight')),
  boarded_by_email text,                              -- driver who logged it
  created_at    timestamptz not null default now()
);
create index if not exists loop_boardings_group_idx   on public.loop_boardings (group_id, created_at);
create index if not exists loop_boardings_contact_idx on public.loop_boardings (group_id, contact_id, created_at);

alter table public.loop_boardings enable row level security;
