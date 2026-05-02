-- Migration 018: QuickBooks Online sync state + expense extensions.
-- Run after 017.
--
-- The leadership scoreboard pulls expenses from QB Online (the bookkeeper
-- Diamond posts there) so it stays in sync with the canonical books without
-- doubling her work. This migration adds:
--   1) qb_sync_state — single-row table holding OAuth tokens and last-sync
--      bookkeeping, refreshed by the daily Vercel cron at /api/cron/quickbooks-sync.
--   2) extensions to public.expenses so a QB-imported row preserves enough
--      to dedupe + reconcile (qb_id is unique; qb_account / qb_class /
--      qb_category give us the raw QB taxonomy for later mapping to the
--      Profit First buckets).
--
-- We never write back to QB. Diamond's workflow is unchanged.

create table if not exists public.qb_sync_state (
  id                       int primary key default 1,    -- single-row enforcement via check below
  qb_realm_id              text,
  refresh_token            text,
  access_token             text,
  access_token_expires_at  timestamptz,
  last_synced_at           timestamptz,
  last_sync_status         text,                          -- 'ok' | 'error'
  last_sync_error          text,
  updated_at               timestamptz not null default now(),
  constraint qb_sync_state_singleton check (id = 1)
);

-- Make sure the singleton row exists so /leadership/quickbooks can
-- always upsert without first having to insert.
insert into public.qb_sync_state (id) values (1)
on conflict (id) do nothing;

alter table public.qb_sync_state enable row level security;

-- Extend expenses with QB-side identifiers + raw taxonomy. Existing rows
-- (manual + pre-QB-sync entries) keep these as null.
alter table public.expenses
  add column if not exists qb_id          text,
  add column if not exists qb_account     text,
  add column if not exists qb_class       text,
  add column if not exists qb_category    text,
  add column if not exists qb_synced_at   timestamptz;

create unique index if not exists expenses_qb_id_unique
  on public.expenses (qb_id)
  where qb_id is not null;

create index if not exists expenses_qb_account_idx
  on public.expenses (qb_account)
  where qb_account is not null;
