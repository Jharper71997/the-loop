-- Migration 019: Profit First allocation targets.
-- Run after 018.
--
-- Diamond (bookkeeper) uses Profit First methodology. Each quarter income
-- is allocated to five buckets:
--   Profit Reserve  10%
--   Taxes           15%
--   Owner's Pay     15%
--   Operating Exp   30%
--   COGS            30%
--
-- The /leadership/profit-first page renders actual vs target vs variance
-- per bucket. Percentages are stored per (year, quarter) so the targets
-- can drift over time without a deploy.

create table if not exists public.profit_first_targets (
  year         int not null,
  quarter      int not null check (quarter between 1 and 4),
  reserve_pct  numeric not null default 0.10,
  tax_pct      numeric not null default 0.15,
  owner_pct    numeric not null default 0.15,
  opex_pct     numeric not null default 0.30,
  cogs_pct     numeric not null default 0.30,
  notes        text,
  updated_at   timestamptz not null default now(),
  primary key (year, quarter)
);

alter table public.profit_first_targets enable row level security;

-- Seed Q1 + Q2 2026 so the scoreboard renders today and historical
-- variance from Diamond's snapshot lines up. Future quarters get inserted
-- via the leadership UI when allocation strategy changes.
insert into public.profit_first_targets (year, quarter, notes) values
  (2026, 1, 'Initial Profit First allocation per Diamond Q1 snapshot'),
  (2026, 2, 'Q2 — same allocation as Q1 unless adjusted')
on conflict (year, quarter) do nothing;
