-- Migration 046: Merch store — a real product catalog + cart checkout, kept
-- FULLY SEPARATE from ride `orders` so ride ops / metrics / TT sync never see
-- merch. Run in the Supabase SQL editor after 045.
--
-- Mirrors the 037 add-ons conventions: service-role only (RLS on, no policy =
-- deny-all to anon; the storefront reads the catalog server-side via the service
-- key), and every order line snapshots name + price so historical orders stay
-- correct if the catalog changes later.

-- Catalog -------------------------------------------------------------------
create table if not exists public.merch_products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  image_url    text,                      -- primary image (card + gallery lead)
  image_urls   text[],                    -- full gallery, in display order
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists merch_products_active_idx on public.merch_products (active) where active = true;

-- Optional per-product variants (e.g. tee sizes). A product with no variant
-- rows is sold as-is; a variant with null price_cents inherits the product price.
create table if not exists public.merch_variants (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.merch_products(id) on delete cascade,
  name         text not null,              -- e.g. "M", "L", "XL"
  sku          text,
  price_cents  integer check (price_cents is null or price_cents >= 0),
  active       boolean not null default true,
  sort_order   integer not null default 0
);

create index if not exists merch_variants_product_idx on public.merch_variants (product_id);

-- Orders --------------------------------------------------------------------
create table if not exists public.merch_orders (
  id                        uuid primary key default gen_random_uuid(),
  status                    text not null default 'pending'
                              check (status in ('pending','paid','fulfilled','refunded','canceled')),
  fulfillment_status        text not null default 'unfulfilled'
                              check (fulfillment_status in ('unfulfilled','fulfilled')),
  tracking_number           text,
  buyer_email               text,
  buyer_name                text,
  buyer_phone               text,
  shipping_address          jsonb,     -- Stripe-collected shipping address
  shipping_method           text,      -- "Standard shipping" | "Grab it on the shuttle"
  subtotal_cents            integer not null default 0,
  shipping_cents            integer,
  total_cents               integer,
  client_token              text,      -- idempotency for double-submits
  stripe_checkout_session_id text,
  stripe_payment_intent_id  text,
  stripe_checkout_url       text,
  created_at                timestamptz not null default now(),
  paid_at                   timestamptz,
  fulfilled_at              timestamptz,
  refunded_at               timestamptz
);

create index if not exists merch_orders_session_idx on public.merch_orders (stripe_checkout_session_id);
create index if not exists merch_orders_pi_idx on public.merch_orders (stripe_payment_intent_id);
create index if not exists merch_orders_client_token_idx on public.merch_orders (client_token);

create table if not exists public.merch_order_items (
  id               uuid primary key default gen_random_uuid(),
  merch_order_id   uuid not null references public.merch_orders(id) on delete cascade,
  product_id       uuid references public.merch_products(id) on delete set null,
  variant_id       uuid references public.merch_variants(id) on delete set null,
  name             text not null,        -- snapshot: "Brew Loop Tee — L"
  unit_price_cents integer not null,     -- snapshot at purchase
  quantity         integer not null default 1 check (quantity > 0),
  created_at       timestamptz not null default now()
);

create index if not exists merch_order_items_order_idx on public.merch_order_items (merch_order_id);

-- Deny-all to anon; storefront + checkout use the service key.
alter table public.merch_products    enable row level security;
alter table public.merch_variants    enable row level security;
alter table public.merch_orders      enable row level security;
alter table public.merch_order_items enable row level security;

-- Seed the live catalog (mirrors jvillebrewloop.com/store-2). Prices/images
-- editable later (UPDATE public.merch_products ...).
insert into public.merch_products (slug, name, description, price_cents, image_url, image_urls, sort_order)
values
  ('brew-loop-hoodie', 'Jville Brew Loop Hoodie',  'Heavyweight black hoodie with the gold Brew Loop badge on the chest. Your go-to layer for a night on the Loop.', 5500, '/brand/merch/hoodie-1.png', array['/brand/merch/hoodie-1.png','/brand/merch/hoodie-2.png','/brand/merch/hoodie-3.png','/brand/merch/hoodie-4.png'], 10),
  ('brew-loop-tee',    'Jville Brew Loop T-Shirt', 'Soft black tee with the gold Brew Loop badge. Light enough to wear bar to bar all night.',                       3500, '/brand/merch/tshirt-1.png', array['/brand/merch/tshirt-1.png','/brand/merch/tshirt-2.png','/brand/merch/tshirt-3.png','/brand/merch/tshirt-4.png','/brand/merch/tshirt-5.png'], 20),
  ('brew-loop-patch',  'Jville Brew Loop Patches', 'Embroidered gold-on-black Brew Loop patch with the full badge. Stick it on a jacket, hat, or bag.',              1000, '/brand/merch/patches.png', array['/brand/merch/patches.png'], 30)
on conflict (slug) do nothing;

-- Hoodie + tee size variants (inherit product price via null price_cents).
insert into public.merch_variants (product_id, name, sort_order)
select p.id, v.name, v.sort_order
from public.merch_products p
cross join (values ('S',1),('M',2),('L',3),('XL',4),('2XL',5)) as v(name, sort_order)
where p.slug in ('brew-loop-hoodie', 'brew-loop-tee')
on conflict do nothing;
