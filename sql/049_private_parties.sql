-- Migration 049: private parties ("book the whole shuttle").
--
-- A private party is NOT a new kind of thing. It is an ordinary event that is
-- (a) hidden from every public listing and (b) reachable only through a secret
-- token in the URL. Everything downstream — Stripe checkout, the waiver, the
-- $0 guest claim links, the boarding pass, the driver manifest, the finance
-- roll-up — already keys off events/orders and therefore works unchanged.
--
-- Before this, a charter had to be status='on_sale' to be bookable, and
-- on_sale is exactly what /events lists. So every private charter we sold sat
-- on the public events page next to the Friday loops until its date passed.
-- is_private is the flag that separates "bookable" from "advertised".

-- 1. The two columns that make an event private.
alter table public.events
  add column if not exists is_private boolean not null default false,
  add column if not exists access_token text;

-- Unique only where present, so the millions of normal events with a NULL
-- token don't collide with each other.
create unique index if not exists events_access_token_key
  on public.events (access_token)
  where access_token is not null;

create index if not exists events_is_private_idx
  on public.events (is_private);

-- 2. Inbound requests from a public /parties page.
--
--    DORMANT as of 2026-08-27: Jacob cut the public parties page the day this
--    shipped — private nights are sold by a link we hand out, never advertised
--    — so nothing writes to this table any more. Left in place rather than
--    dropped: it is already applied, it costs nothing empty, and it is the
--    schema we would want back if a request form ever returns. Do not build
--    anything that reads it expecting rows.
create table if not exists public.party_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text,
  phone          text,
  requested_date date,
  party_size     int,
  occasion       text,
  notes          text,
  status         text not null default 'new'
                   check (status in ('new','quoted','booked','lost')),
  event_id       uuid references public.events(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists party_requests_status_idx
  on public.party_requests (status, created_at desc);

-- 3. Backfill: the Jul 18 charter was built the manual way, before this flag
--    existed. Anything still named like a charter and not yet flagged gets
--    marked private so it stops showing publicly. Safe to re-run.
update public.events
   set is_private = true
 where is_private = false
   and (name ilike '%private charter%' or name ilike '%private party%');
