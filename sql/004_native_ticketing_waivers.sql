-- Migration 004: native ticketing + Singenuity-style waivers
-- Run this in Supabase SQL Editor.
--
-- Adds first-class events / ticket_types / orders / order_items so The Loop
-- can sell rides directly via Stripe Checkout, plus waiver_versions /
-- waiver_signatures for legally signed liability releases.

-- 1. Versioned waiver template. Bump version when legal text changes.
create table if not exists public.waiver_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  body_md text not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2. Signed waiver records. One row per (contact, version). Reusable across
-- bookings as long as the version is current.
create table if not exists public.waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  waiver_version_id uuid not null references public.waiver_versions(id),
  full_name_typed text not null,
  signature_image text,
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  signed_for_contact_id uuid references public.contacts(id),
  order_id uuid,
  unique (contact_id, waiver_version_id)
);

create index if not exists waiver_signatures_contact_idx
  on public.waiver_signatures (contact_id);

-- 3. Fast-path columns on contacts.
alter table public.contacts
  add column if not exists has_signed_waiver boolean not null default false,
  add column if not exists waiver_signed_at timestamptz,
  add column if not exists waiver_version int;

-- 4. Sales-side event. groups stays as the dispatch/ops view.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  name text not null,
  event_date date not null,
  pickup_time time,
  description text,
  status text not null default 'on_sale',
  capacity int,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_event_date_idx
  on public.events (event_date);

-- 5. Ticket types per event.
create table if not exists public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  price_cents int not null,
  capacity int,
  stop_index int,
  active boolean not null default true,
  sort_order int not null default 0
);

create index if not exists ticket_types_event_idx
  on public.ticket_types (event_id);

-- 6. Native orders.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  total_cents int not null,
  status text not null default 'pending',
  buyer_email text,
  buyer_phone text,
  buyer_name text,
  party_size int not null default 1,
  metadata jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create index if not exists orders_event_idx
  on public.orders (event_id);
create index if not exists orders_status_idx
  on public.orders (status);

-- 7. Line items: one per ticket purchased.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_type_id uuid references public.ticket_types(id),
  contact_id uuid references public.contacts(id),
  rider_first_name text,
  rider_last_name text,
  rider_email text,
  rider_phone text,
  unit_price_cents int not null,
  stop_index int,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx
  on public.order_items (order_id);

-- 8. Seed an initial waiver version so checkout has something to sign against.
-- Edit the body_md after running this migration to put real legal text.
insert into public.waiver_versions (version, body_md)
select 1,
$$# Jville Brew Loop — Liability Waiver

By signing below I acknowledge the following:

1. I am at least 21 years of age.
2. I voluntarily assume the risks associated with using a shuttle service that transports passengers between licensed drinking establishments.
3. I release Jville Brew Loop LLC, its drivers, contractors, and partner venues from any liability for personal injury, property damage, or other loss arising out of my use of the shuttle service, except for damages caused by gross negligence or willful misconduct.
4. I agree to behave respectfully toward the driver and other riders. The driver may refuse service or remove any rider at any time.
5. I understand that pickup and drop-off times are estimates and may change.

Typing my full name below constitutes my electronic signature and has the same legal effect as a handwritten signature.$$
where not exists (select 1 from public.waiver_versions);
