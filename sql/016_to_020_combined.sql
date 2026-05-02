-- ============================================================================
-- Combined migrations 016-020 — leadership scoreboard schema.
-- Paste this entire file into Supabase SQL Editor and run once.
-- All statements are idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING)
-- so re-running is safe if anything was already applied.
--
-- Order inside this file matches the dependency order:
--   016 bars                  (depends on existing bartenders)
--   017 sponsor + bar payments (depends on bars + sponsors)
--   020 drivers                (depends on existing contacts + events)
--   018 quickbooks sync        (depends on existing expenses)
--   019 profit first targets   (standalone, run last for clean console output)
-- ============================================================================


-- ============================================================================
-- Migration 016: first-class bars table for financial tracking.
-- ============================================================================

create table if not exists public.bars (
  slug              text primary key,
  name              text not null,
  status            text not null default 'prospect',
  monthly_fee_cents int not null default 0,
  payment_method    text default 'check',
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

alter table public.bartenders
  add column if not exists bar_slug text references public.bars(slug);

create index if not exists bartenders_bar_slug_idx on public.bartenders (bar_slug);

insert into public.bars (slug, name, status, monthly_fee_cents, payment_method, notes) values
  ('angry-ginger', 'The Angry Ginger',  'active',   25000, 'check', 'Per Q2 plan: $250/mo'),
  ('shirley-vs',   'Shirley V''s',      'active',   30000, 'check', 'Per Q2 plan: $300/mo'),
  ('archies',      'Archie''s',         'active',   30000, 'check', 'Per Q2 plan: $300/mo'),
  ('guss',         'Gus''s',            'prospect', 30000, 'check', 'Q2 target $300/mo (potential)'),
  ('hideaway',     'Hideaway',          'active',   20000, 'check', 'Per Q2 plan: $200/mo'),
  ('twin-ravens',  'Twin Ravens',       'active',   30000, 'check', 'Per Q2 plan: $300/mo'),
  ('black-rose',   'Black Rose Tavern', 'active',   30000, 'check', 'Per Q2 plan: $300/mo')
on conflict (slug) do nothing;


-- ============================================================================
-- Migration 017: discrete payment records for sponsors and bars.
-- Captures check / cash / Venmo / Cash App income that doesn't show in Stripe.
-- ============================================================================

create table if not exists public.sponsor_payments (
  id              uuid primary key default gen_random_uuid(),
  sponsor_id      uuid not null references public.sponsors(id) on delete cascade,
  amount_cents    int not null,
  paid_for_period date,
  paid_at         timestamptz not null default now(),
  method          text not null default 'check',
  reference       text,
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


-- ============================================================================
-- Migration 020: drivers roster + assignments.
-- Source of truth for "drivers available next weekend" card.
-- ============================================================================

create table if not exists public.drivers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  email         text,
  status        text not null default 'prospect',
  role          text not null default 'driver',
  started_at    date,
  contact_id    uuid references public.contacts(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists drivers_status_idx on public.drivers (status);

alter table public.drivers enable row level security;

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

insert into public.drivers (name, status, role, notes) values
  ('Richard Stephen Flowers', 'active', 'both',    'Co-founder; primary driver on event nights'),
  ('Calhoun',                 'active', 'driver',  'Backup driver per Asana team list'),
  ('Nathan',                  'active', 'both',    'Driver + door security on event nights'),
  ('Willy',                   'active', 'liaison', 'Bar liaison'),
  ('Jacob Harper',            'active', 'liaison', 'Remote — liaison only when in town')
on conflict do nothing;


-- ============================================================================
-- Migration 018: QuickBooks sync state + expense extensions.
-- Future-proofs expenses for an eventual sync. Singleton qb_sync_state row.
-- ============================================================================

create table if not exists public.qb_sync_state (
  id                       int primary key default 1,
  qb_realm_id              text,
  refresh_token            text,
  access_token             text,
  access_token_expires_at  timestamptz,
  last_synced_at           timestamptz,
  last_sync_status         text,
  last_sync_error          text,
  updated_at               timestamptz not null default now(),
  constraint qb_sync_state_singleton check (id = 1)
);

insert into public.qb_sync_state (id) values (1)
on conflict (id) do nothing;

alter table public.qb_sync_state enable row level security;

alter table public.expenses
  add column if not exists qb_id          text,
  add column if not exists qb_account     text,
  add column if not exists qb_class       text,
  add column if not exists qb_category    text,
  add column if not exists qb_synced_at   timestamptz;

create unique index if not exists expenses_qb_id_unique
  on public.expenses (qb_id)
  where qb_id is not null;

create index if not exists expenses_qb_account_idx
  on public.expenses (qb_account)
  where qb_account is not null;


-- ============================================================================
-- Migration 019: Profit First allocation targets.
-- Diamond's 5-bucket methodology, editable per (year, quarter).
-- ============================================================================

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

insert into public.profit_first_targets (year, quarter, notes) values
  (2026, 1, 'Initial Profit First allocation per Diamond Q1 snapshot'),
  (2026, 2, 'Q2 — same allocation as Q1 unless adjusted')
on conflict (year, quarter) do nothing;


-- ============================================================================
-- Done. You should see "Success. No rows returned" in the Results panel.
-- The leadership scoreboard now has all the tables it needs.
-- ============================================================================
