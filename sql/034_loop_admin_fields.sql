-- Migration 034: The Loop — richer verification fields for the ops dashboard.
-- Run in the Supabase SQL editor after 033.
--   unit / rank   — collected on the verify form, shown in admin
--   admin_note    — internal note staff can add to a rider
--   flagged       — internal flag (e.g. VIP / banned / watch)

alter table public.military_verifications
  add column if not exists unit text,
  add column if not exists rank text,
  add column if not exists admin_note text,
  add column if not exists flagged boolean not null default false;
