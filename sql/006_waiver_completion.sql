-- Migration 006: waiver reminder bookkeeping
-- Run in Supabase SQL Editor after migration 005.
--
-- Supports:
--   * lib/waiver.js:textUnsignedForGroup — dedupes waiver-reminder SMS so we
--     don't re-text the same rider every time the admin hits the button or
--     the webhook fires.
--   * /groups/[id] Waivers panel "Text unsigned" action.
--   * ticket-tailor-webhook path for legacy TT purchases that never pass
--     through the inline /book waiver.

alter table public.contacts
  add column if not exists waiver_sms_sent_at timestamptz,
  add column if not exists waiver_sms_count int not null default 0;

alter table public.groups
  add column if not exists waivers_required boolean not null default true;

create index if not exists contacts_unsigned_idx
  on public.contacts (has_signed_waiver, waiver_sms_sent_at)
  where has_signed_waiver = false;
