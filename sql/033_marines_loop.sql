-- Migration 033: Marines Loop — military verification gate
-- Run in the Supabase SQL editor after 032.
--
-- The Marines Loop is a separate daytime hop-on/off shuttle (base <-> sponsor
-- stops) that flips to a night safe-ride. Riders must be verified military
-- BEFORE they can buy a pass. The verification METHOD is not yet decided
-- (SheerID / ID.me / manual) — this models it method-agnostically: a
-- `military_verified` flag on the contact, fed by `military_verifications`
-- rows. We can launch with method='manual' (approve in the dashboard) and
-- swap in an automated provider later with no schema change.

alter table public.contacts
  add column if not exists military_verified boolean not null default false,
  add column if not exists military_verified_at timestamptz,
  add column if not exists military_branch text;

create table if not exists public.military_verifications (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  branch text,
  status text not null default 'pending',   -- pending | approved | rejected
  method text not null default 'manual',     -- manual | sheerid | idme
  note text,                                  -- rider note / proof reference / provider payload id
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create index if not exists military_verifications_status_idx
  on public.military_verifications (status);
create index if not exists military_verifications_contact_idx
  on public.military_verifications (contact_id);
