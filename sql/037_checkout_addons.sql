-- Migration 037: Checkout add-ons — incremental AOV at native checkout.
-- Run in the Supabase SQL editor after 036.
--
-- `addons` is the catalog (drink token, merch, "next loop" credit, VIP upgrade).
-- `order_addons` records what a buyer actually selected, with a price snapshot
-- so historical orders stay correct if the catalog price later changes.
-- Both are service-role only (the booking page reads them server-side via the
-- service key); RLS is ON with no policy = deny-all to the anon key.

create table if not exists public.addons (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  integer not null default 0 check (price_cents >= 0),
  kind         text not null default 'extra'
                 check (kind in ('drink_token', 'merch', 'credit', 'vip', 'extra')),
  active       boolean not null default true,
  sort_order   integer not null default 0,
  -- null event_id = offered on every event; set it to scope an add-on to one loop.
  event_id     uuid references public.events(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists addons_active_idx on public.addons (active) where active = true;
create index if not exists addons_event_idx on public.addons (event_id);

create table if not exists public.order_addons (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  addon_id         uuid references public.addons(id) on delete set null,
  name             text not null,            -- snapshot of addon name at purchase
  unit_price_cents integer not null,         -- snapshot of price at purchase
  quantity         integer not null default 1 check (quantity > 0),
  created_at       timestamptz not null default now()
);

create index if not exists order_addons_order_idx on public.order_addons (order_id);

alter table public.addons enable row level security;
alter table public.order_addons enable row level security;

-- Seed only add-ons that are on-policy and fulfillable today: both are honored
-- operationally at pickup, neither markets alcohol (Brew Loop can't) nor
-- discounts the ride. Prices are editable later (UPDATE public.addons ...).
-- The 'drink_token' / 'credit' kinds remain in the CHECK above for future use,
-- but are intentionally NOT seeded — a drink perk would be alcohol marketing,
-- and ride credit needs a redemption flow that isn't built yet.
insert into public.addons (name, description, price_cents, kind, sort_order)
values
  ('Brew Loop koozie', 'Keep it cold. Grab yours on the shuttle.',  800,  'merch', 20),
  ('VIP upgrade',      'Front-of-line at pickup + reserved seat.',   1000, 'vip',   40)
on conflict do nothing;
