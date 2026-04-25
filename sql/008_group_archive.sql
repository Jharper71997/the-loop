-- Migration 008: manual archive flag for groups (Loops).
-- Run after 007.
--
-- Once a Loop is over, the admin presses "Archive" to take it out of the
-- Tonight + Loops active pickers. Archived Loops still exist for finance
-- attribution, rider history, and reporting.

alter table public.groups
  add column if not exists archived_at timestamptz;

create index if not exists groups_active_idx
  on public.groups (event_date)
  where archived_at is null;
