-- Migration 017: discrete payment records for sponsors and bars.
-- Run after 016.
--
-- Today sponsors.amount_paid is a single rolling total. That works for a
-- summary but we lose history (when did they pay, how, for which month).
-- Adding sponsor_payments + bar_payments lets us:
--   1) record check / cash / Venmo / Cash App income that doesn't show in
--      Stripe (Richard collects most monthly fees this way),
--   2) attribute revenue to the period it covers, not the date received,
--   3) drive monthly bar/sponsor recap reports (v2).
--
-- sponsors.amount_paid stays as-is for now; we'll backfill from
-- sponsor_payments rollups in v2.

create table if not exists public.sponsor_payments (
  id              uuid primary key default gen_random_uuid(),
  sponsor_id      uuid not null references public.sponsors(id) on delete cascade,
  amount_cents    int not null,
  paid_for_period date,                                  -- which month/period this payment covers
  paid_at         timestamptz not null default now(),    -- when we received it
  method          text not null default 'check',         -- stripe | check | cash | venmo | cashapp | other
  reference       text,                                  -- check #, Venmo handle, Stripe charge id, etc.
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists sponsor_payments_sponsor_idx
  on public.sponsor_payments (sponsor_id, paid_at desc);

create index if not exists sponsor_payments_period_idx
  on public.sponsor_payments (paid_for_period desc);

alter table public.sponsor_payments enable row level security;

create table if not exists public.bar_payments (
  id              uuid primary key default gen_random_uuid(),
  bar_slug        text not null references public.bars(slug) on delete cascade,
  amount_cents    int not null,
  paid_for_period date,
  paid_at         timestamptz not null default now(),
  method          text not null default 'check',
  reference       text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists bar_payments_bar_idx
  on public.bar_payments (bar_slug, paid_at desc);

create index if not exists bar_payments_period_idx
  on public.bar_payments (paid_for_period desc);

alter table public.bar_payments enable row level security;
