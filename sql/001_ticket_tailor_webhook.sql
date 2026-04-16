-- Migration 001: wire Ticket Tailor webhook into contacts + groups
-- Run this in Supabase SQL Editor.

-- 1. Link a group to the Ticket Tailor event it represents.
alter table public.groups
  add column if not exists tt_event_id text,
  add column if not exists event_date date,
  add column if not exists current_stop text,
  add column if not exists notes text;

create unique index if not exists groups_tt_event_id_key
  on public.groups (tt_event_id)
  where tt_event_id is not null;

-- 2. Contacts: dedupe riders by phone (primary) or email.
alter table public.contacts
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists sms_consent boolean default false,
  add column if not exists last_tt_order_id text,
  add column if not exists last_ticket_id text;

-- Normalize existing phones to something we can index, then enforce uniqueness.
-- If you have historical rows with duplicate/empty phones, resolve those first
-- or drop these unique indexes and rely on application-level dedupe.
create unique index if not exists contacts_phone_key
  on public.contacts (phone)
  where phone is not null and phone <> '';

create unique index if not exists contacts_email_key
  on public.contacts (email)
  where email is not null and email <> '';

-- 3. Prevent duplicate (contact, group) memberships.
create unique index if not exists group_members_unique
  on public.group_members (group_id, contact_id);

-- 4. Keep a raw log of every webhook delivery for debugging / replay.
create table if not exists public.webhook_events (
  id bigserial primary key,
  source text not null,
  event_type text,
  external_id text,
  payload jsonb not null,
  status text not null default 'received',
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists webhook_events_source_received_at_idx
  on public.webhook_events (source, received_at desc);

create index if not exists webhook_events_external_id_idx
  on public.webhook_events (external_id);
