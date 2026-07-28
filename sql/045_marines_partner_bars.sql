-- Migration 045: The Loop (Marines) partner bars.
-- Run in the Supabase SQL editor after 044.
--
-- The Loop (Camp Lejeune / Jacksonville NC) is now a full Surf-style product
-- (rider + admin clone of Brew/Surf) instead of the old day-pass / ID-verify
-- build. It gets its OWN partner stops, scoped business='marines' so a Loop
-- stop can never collide with a Brew/Surf bar on the map (every bars query is
-- business-scoped in lib/barsServer). groups.kind / events.kind already allow
-- 'marines' (043 / 044), so there is no kind-CHECK change here.

-- 1) Widen the bars.business CHECK to include 'marines'. 044 added the column
-- with an inline check (auto-named bars_business_check). Drop ANY check on the
-- table that references `business`, then re-add the widened one — name-agnostic,
-- same bulletproof pattern 044 used for kind.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.bars'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%business%'
  loop execute format('alter table public.bars drop constraint %I', c); end loop;
end $$;

alter table public.bars
  add constraint bars_business_check check (business in ('brew','surf','marines'));

-- 2) Seed The Loop partner stops. PLACEHOLDERS — confirm the real Camp Lejeune
-- stop list + addresses with Jacob. Coords left null (builder-picked stops carry
-- inline lat/lng so the live map works without these); fill later if a per-stop
-- page pin is wanted. Names mirror lib/bars.js MARINES_BARS.
insert into public.bars (slug, name, business, status, notes) values
  ('dragon-brew', 'Dragon Brew', 'marines', 'active', 'The Loop (Marines) partner stop. Placeholder — confirm.'),
  ('good-times',  'Good Times',  'marines', 'active', 'The Loop (Marines) partner stop. Placeholder — confirm.')
on conflict (slug) do nothing;
