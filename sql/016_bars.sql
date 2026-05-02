-- Migration 016: first-class bars table for financial tracking.
-- Run after 015.
--
-- The static directory in lib/bars.js stays as the canonical public-facing
-- source (slug, name, blurb, lat/lng). This table adds the financial layer:
-- monthly fee, payment method, status, contact info. Joined to lib/bars.js
-- by slug.
--
-- bartenders.bar is a free-text field today (migration 010). We add bar_slug
-- as the structured FK alongside it; bartenders.bar stays for backwards
-- compatibility with the leaderboard ingest.

create table if not exists public.bars (
  slug              text primary key,
  name              text not null,
  status            text not null default 'prospect',  -- prospect | active | paused | inactive
  monthly_fee_cents int not null default 0,
  payment_method    text default 'check',              -- stripe | check | cash | venmo | cashapp | other
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  started_at        date,
  paused_at         date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists bars_status_idx on public.bars (status);

alter table public.bars enable row level security;

-- Add structured bar reference to bartenders. bartenders.bar (text) stays
-- because the leaderboard ingest already reads from it; new code should
-- use bar_slug.
alter table public.bartenders
  add column if not exists bar_slug text references public.bars(slug);

create index if not exists bartenders_bar_slug_idx on public.bartenders (bar_slug);

-- Seed from the static directory in lib/bars.js. Matches the 8 partner bars
-- per memory (excluding the placeholder partner-8). Status starts 'prospect'
-- and gets bumped to 'active' as Richard records the first payment.
insert into public.bars (slug, name, status, monthly_fee_cents, payment_method, notes) values
  ('angry-ginger', 'The Angry Ginger',  'active', 25000, 'check', 'Per Q2 plan: $250/mo'),
  ('shirley-vs',   'Shirley V''s',      'active', 30000, 'check', 'Per Q2 plan: $300/mo'),
  ('archies',      'Archie''s',         'active', 30000, 'check', 'Per Q2 plan: $300/mo'),
  ('guss',         'Gus''s',            'prospect', 30000, 'check', 'Q2 target $300/mo (potential)'),
  ('hideaway',     'Hideaway',          'active', 20000, 'check', 'Per Q2 plan: $200/mo'),
  ('twin-ravens',  'Twin Ravens',       'active', 30000, 'check', 'Per Q2 plan: $300/mo'),
  ('black-rose',   'Black Rose Tavern', 'active', 30000, 'check', 'Per Q2 plan: $300/mo')
on conflict (slug) do nothing;
