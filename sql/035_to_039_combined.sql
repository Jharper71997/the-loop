-- Combined migrations 035–039 — apply together in the Supabase SQL editor.
-- These shipped in code on 2026-06-14 (opportunities build) but were never run
-- against production, which broke native /api/checkout: the order INSERT writes
-- orders.referrer_contact_id (039) and getActivePass() reads loop_passes (035),
-- both of which were missing. All statements are idempotent (IF NOT EXISTS), so
-- re-running an already-applied piece is a harmless no-op.

-- ===== 035: Loop Pass — recurring rider subscription =====
create table if not exists public.loop_passes (
  id                     uuid primary key default gen_random_uuid(),
  contact_id             uuid references public.contacts(id) on delete set null,
  plan                   text not null default 'monthly'
                           check (plan in ('monthly', 'season')),
  status                 text not null default 'active'
                           check (status in ('active', 'past_due', 'canceled')),
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists loop_passes_contact_idx on public.loop_passes (contact_id);
create index if not exists loop_passes_active_idx on public.loop_passes (contact_id) where status = 'active';
alter table public.loop_passes enable row level security;

-- ===== 036: admin loop close-out =====
alter table public.groups
  add column if not exists closed_out_at timestamptz;
update public.groups
  set closed_out_at = now()
  where closed_out_at is null
    and event_date is not null
    and event_date < (current_date - interval '2 days');
create index if not exists groups_open_idx on public.groups (event_date) where closed_out_at is null;

-- ===== 037: Checkout add-ons =====
create table if not exists public.addons (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  integer not null default 0 check (price_cents >= 0),
  kind         text not null default 'extra'
                 check (kind in ('drink_token', 'merch', 'credit', 'vip', 'extra')),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  event_id     uuid references public.events(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists addons_active_idx on public.addons (active) where active = true;
create index if not exists addons_event_idx on public.addons (event_id);
create table if not exists public.order_addons (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  addon_id         uuid references public.addons(id) on delete set null,
  name             text not null,
  unit_price_cents integer not null,
  quantity         integer not null default 1 check (quantity > 0),
  created_at       timestamptz not null default now()
);
create index if not exists order_addons_order_idx on public.order_addons (order_id);
alter table public.addons enable row level security;
alter table public.order_addons enable row level security;
insert into public.addons (name, description, price_cents, kind, sort_order)
values
  ('Brew Loop koozie', 'Keep it cold. Grab yours on the shuttle.',  800,  'merch', 20),
  ('VIP upgrade',      'Front-of-line at pickup + reserved seat.',   1000, 'vip',   40)
on conflict do nothing;

-- ===== 038: Sold-out waitlist =====
create table if not exists public.event_waitlist (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  stop_index     integer,
  ticket_type_id uuid references public.ticket_types(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  party_size     integer not null default 1 check (party_size > 0),
  notified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists event_waitlist_event_idx on public.event_waitlist (event_id);
create index if not exists event_waitlist_stop_idx on public.event_waitlist (event_id, stop_index);
alter table public.event_waitlist enable row level security;

-- ===== 039: Rider referral links =====
alter table public.contacts
  add column if not exists referral_code text;
create unique index if not exists contacts_referral_code_key
  on public.contacts (referral_code) where referral_code is not null;
alter table public.orders
  add column if not exists referrer_contact_id uuid references public.contacts(id) on delete set null;
create index if not exists orders_referrer_idx
  on public.orders (referrer_contact_id) where referrer_contact_id is not null;
