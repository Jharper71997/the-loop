-- Migration 044: Surf City Loop — third product on the Brew Loop engine.
-- Run in the Supabase SQL editor after 043.
--
-- Surf City Loop (Topsail Island NC) is a SECOND bar-shuttle business, a
-- near-exact copy of Jville Brew Loop (partner bars that pay to be on the
-- route, native ticketing + waivers, live tracking, staff ops). It reuses the
-- whole Brew Loop machinery (groups -> events -> ticket_types -> orders ->
-- shuttle_pings) but is tagged kind='surf' so it never leaks into Brew Loop
-- (or Marines) surfaces. Mirrors how 043 added kind='marines'.
--   - Brew Loop queries:  .eq('kind','brew')
--   - Marines queries:    .eq('kind','marines')
--   - Surf City queries:  .eq('kind','surf')
-- Default stays 'brew' so all existing rows + queries keep working unchanged.
--
-- Unlike Marines (a re-skinned distinct product whose stops are NOT bars),
-- Surf City has its OWN partner bars whose names must never collide with
-- Jville's on the map. So we also scope the bars table per business.

-- 1) Allow 'surf' on the kind CHECK (groups + events). 043 added the CHECK
-- inline (`add column ... check (...)`), which Postgres auto-names
-- `<table>_kind_check`. Rather than guess the name, drop ANY check constraint
-- on the table that references `kind`, then re-add the widened one. Bulletproof
-- regardless of the actual constraint name.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.groups'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop execute format('alter table public.groups drop constraint %I', c); end loop;
end $$;

alter table public.groups
  add constraint groups_kind_check check (kind in ('brew','marines','surf'));

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop execute format('alter table public.events drop constraint %I', c); end loop;
end $$;

alter table public.events
  add constraint events_kind_check check (kind in ('brew','marines','surf'));

-- 2) Scope bars per business. Default 'brew' so every existing bar row keeps
-- showing only on Brew Loop surfaces. Surf City bars carry business='surf'.
-- This is the key fix so a Surf stop named like a Brew bar can never grab the
-- Brew bar's pin (every bars query is now business-scoped in lib/barsServer).
alter table public.bars
  add column if not exists business text not null default 'brew'
    check (business in ('brew','surf'));
create index if not exists bars_business_idx on public.bars (business);

-- 3) Seed the 5 confirmed Surf City partner bars. Coords are left null for now
-- (Topsail addresses TBD) — Surf schedule stops carry inline lat/lng at build
-- time so the live map works without these; fill via /leadership/bars geocode
-- later if a per-bar page pin is wanted. Pricing per memory 2026-06-23:
-- standard partner-stop ~$375/mo; Voodoo + Craft House quoted $350.
insert into public.bars (slug, name, business, status, monthly_fee_cents, payment_method, notes) values
  ('velvet',      'Velvet',      'surf', 'active', 37500, 'check', 'Surf City Loop partner stop. Confirmed.'),
  ('voodoo',      'Voodoo',      'surf', 'active', 35000, 'check', 'Surf City Loop partner stop. Quoted $350. Pending franchise-company sign-off.'),
  ('craft-house', 'Craft House', 'surf', 'active', 35000, 'check', 'Surf City Loop partner stop. Quoted $350.'),
  ('tortugas',    'Tortugas',    'surf', 'active', 37500, 'check', 'Surf City Loop partner stop. Confirmed.'),
  ('backyards',   'Backyards',   'surf', 'active', 37500, 'check', 'Surf City Loop partner stop. Confirmed.')
on conflict (slug) do nothing;

-- 4) Drivers + sponsors stay GLOBAL for v1 (Surf console has no roster surface
-- yet; analytics out of scope). Add a `business` column to those tables in a
-- follow-up migration if Surf ever needs a private driver/sponsor roster.
--
-- 5) Per-rider boarding history reuses the existing loop_boardings table (043);
-- it keys on group_id, which is already business-agnostic. No new table.
