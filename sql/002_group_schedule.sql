-- Migration 002: per-group stop schedule + per-rider stop override.
-- Run this in Supabase SQL Editor.

-- 1. Schedule on the group: ordered list of stops with start times.
--    Shape: [{ "name": "Angry Ginger", "start_time": "19:30" }, ...]
alter table public.groups
  add column if not exists schedule jsonb;

-- 2. Per-rider override of which stop they're at.
--    NULL = follow the group's current stop (derived from clock + schedule).
--    0-based index into schedule array.
alter table public.group_members
  add column if not exists current_stop_index int;
