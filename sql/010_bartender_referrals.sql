-- Migration 010: bartender referral leaderboard
-- Run this in Supabase SQL Editor.
--
-- Bartenders self-register at /bartender-signup; the slug becomes their
-- Ticket Tailor referral_tag (e.g. "flying-irishman-jacob"). The leaderboard
-- reads orders from the TT API and joins display_name + bar from this table.

create table if not exists public.bartenders (
  slug          text primary key,
  display_name  text not null,
  bar           text not null,
  qr_image_url  text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists bartenders_active_idx
  on public.bartenders (active)
  where active;
