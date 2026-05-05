-- Migration 024: add address + geocoding to bars table.
--
-- Until now, bar lat/lng lived in a static lib/bars.js array, which meant
-- adding a new bar required a code change + deploy before its pin would
-- show on /track. With this migration, leadership can add a bar through
-- /leadership/bars/new (with address + auto-geocoding), and /track will
-- pin it automatically.
--
-- Run in Supabase SQL Editor.

alter table public.bars
  add column if not exists address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists blurb text;

create index if not exists bars_lat_lng_idx
  on public.bars (lat, lng)
  where lat is not null and lng is not null;

-- Backfill the 8 static partner-bar entries from lib/bars.js so /track and
-- /bars don't lose pins after the cutover. Idempotent: only updates rows
-- whose lat/lng are still null.
update public.bars set
  address = '1202 Gum Branch Rd, Jacksonville, NC 28540',
  lat = 34.7794209, lng = -77.4162900
where slug = 'angry-ginger' and lat is null;

update public.bars set
  address = '619 New Bridge St, Jacksonville, NC 28540',
  lat = 34.7498633, lng = -77.4241820
where slug = 'shirley-vs' and lat is null;

update public.bars set
  address = '1811 Lejeune Blvd, Jacksonville, NC 28546',
  lat = 34.7426855, lng = -77.3769174
where slug = 'archies' and lat is null;

update public.bars set
  address = '111 Carver Dr, Jacksonville, NC 28544',
  lat = 34.7208574, lng = -77.3213354
where slug = 'guss' and lat is null;

update public.bars set
  address = '505 Ramsey Rd, Jacksonville, NC 28546',
  lat = 34.8107971522, lng = -77.387112993023
where slug = 'hideaway' and lat is null;

update public.bars set
  address = '127 Wilmington Hwy, Jacksonville, NC 28540',
  lat = 34.7515567, lng = -77.4509465
where slug = 'twin-ravens' and lat is null;

update public.bars set
  address = '175 Freedom Way #10, Jacksonville, NC 28544',
  lat = 34.7185799, lng = -77.3244393
where slug = 'black-rose' and lat is null;

-- Seed Unhinged so it exists in the financial roster too. Free addition;
-- status starts 'active' since they're a route stop this weekend.
insert into public.bars (slug, name, status, monthly_fee_cents, payment_method, address, lat, lng, blurb, notes)
values (
  'unhinged',
  'Unhinged Bar and Grill',
  'active',
  0,
  'check',
  '2532 Onslow Dr, Jacksonville, NC 28540',
  34.7639074,
  -77.4184690,
  'Bar and grill on Onslow Drive, newest stop on the Loop.',
  'Added 2026-05-05 for weekend launch. Confirm payment terms with Richard.'
)
on conflict (slug) do update set
  address = excluded.address,
  lat     = excluded.lat,
  lng     = excluded.lng,
  blurb   = coalesce(public.bars.blurb, excluded.blurb);
