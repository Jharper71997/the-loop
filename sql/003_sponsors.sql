-- Migration 003: sponsors table.
-- Run this in Supabase SQL Editor.

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  tier text,
  amount_committed numeric,
  amount_paid numeric default 0,
  status text default 'prospect', -- prospect, committed, paid, inactive
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sponsors_status_idx on public.sponsors (status);
