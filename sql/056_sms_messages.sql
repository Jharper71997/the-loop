-- Migration 056: SimpleTexting message sync (two-way inbox).
--
-- Until now the app could send texts but never saw anything come back. Rider
-- replies ("Hi, I'm at twin ravens tavern"), STOPs and carrier delivery results
-- only existed inside SimpleTexting's own UI. This stores every message in
-- both directions so staff can read and answer threads at /admin/messages.
--
-- Three writers, all service role, all idempotent on provider_message_id:
--   1. lib/sms.js sendSms()               -> outbound rows as we send them
--   2. /api/simpletexting-webhook         -> inbound, outgoing, delivery,
--                                            non-delivered, unsubscribe
--   3. /api/cron/sms-sync                 -> backfill + safety-net poll of
--                                            GET /v2/api/messages and contacts
--
-- Numbering note: 054_rate_limits and 055_sms_log live on the unmerged
-- security/hardening-2026-09-21 branch. This file takes 056 so the two never
-- collide. It does not depend on either.
--
-- SECURITY: these tables hold rider phone numbers and the text of private
-- conversations. RLS is ON with NO policies, so the anon and authenticated
-- keys read nothing; every read goes through server code on the service key
-- after a leadership check. Grants to anon/authenticated are revoked too, in
-- case RLS is ever switched off by hand. See project security audit
-- 2026-09-20: four tables were anon-readable because RLS was never enabled.
--
-- Idempotent, safe to re-run. Apply in the Supabase SQL editor.

create table if not exists public.sms_messages (
  id                  uuid        primary key default gen_random_uuid(),
  provider            text        not null default 'simpletexting',
  -- SimpleTexting message id (hex). Null only for sends that never reached
  -- the provider (blocked / failed), which are still worth showing in a thread.
  provider_message_id text,
  direction           text        not null check (direction in ('in', 'out')),
  contact_phone       text        not null,            -- E.164, +19105551234
  account_phone       text,                            -- our sending number, E.164
  contact_id          uuid        references public.contacts(id) on delete set null,
  body                text,
  media               jsonb,                           -- SimpleTexting mediaItems array
  category            text,                            -- SMS | MMS | EXTENDED_SMS
  reference_type      text,                            -- API | INB (their inbox) | OOT ...
  -- received (in) | sent | delivered | undelivered | blocked | failed (out)
  status              text,
  status_detail       text,
  carrier             text,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  sent_by             text,                            -- staff email for inbox replies
  source              text,                            -- app | webhook | poll
  provider_ts         timestamptz not null default now(),
  read_at             timestamptz,                     -- inbound only; null = unread
  raw                 jsonb,                           -- trimmed provider payload, no secrets
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- A plain (non-partial) unique constraint so PostgREST upserts can target it.
-- Postgres treats NULLs as distinct, so blocked/failed rows without a provider
-- id never collide with each other.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sms_messages_provider_message_id_key'
  ) then
    alter table public.sms_messages
      add constraint sms_messages_provider_message_id_key unique (provider_message_id);
  end if;
end $$;

-- Thread view: all messages for one number, newest first.
create index if not exists sms_messages_thread_idx
  on public.sms_messages (contact_phone, provider_ts desc);

-- Thread list + unread badges.
create index if not exists sms_messages_recent_idx
  on public.sms_messages (provider_ts desc);
create index if not exists sms_messages_unread_idx
  on public.sms_messages (contact_phone)
  where direction = 'in' and read_at is null;

create index if not exists sms_messages_contact_idx
  on public.sms_messages (contact_id)
  where contact_id is not null;

alter table public.sms_messages enable row level security;
revoke all on public.sms_messages from anon, authenticated;

-- Opt-out state per phone number, mirrored from SimpleTexting (UNSUBSCRIBE
-- webhook + contact subscriptionStatus). Kept separately from
-- contacts.sms_consent on purpose:
--   * a number can text STOP without ever being a contact in our database;
--   * sms_consent = false only means "did not tick the box" for automated
--     texts, which is not the same as having texted STOP. The inbox blocks
--     replies on THIS table, not on sms_consent.
-- A STOP also flips sms_consent to false on every contact with that phone.
-- A later START (re-subscribe) clears opted_out here but never sets
-- sms_consent back to true: consent is only ever granted by the rider ticking
-- the box.
create table if not exists public.sms_opt_outs (
  phone               text        primary key,         -- E.164
  opted_out           boolean     not null default true,
  source              text,                            -- webhook | poll | reply_blocked
  provider_contact_id text,
  changed_at          timestamptz not null default now()
);

alter table public.sms_opt_outs enable row level security;
revoke all on public.sms_opt_outs from anon, authenticated;

-- One row per conversation for the inbox list. security_invoker makes the
-- view run with the caller's rights, so RLS on sms_messages still applies and
-- anon gets nothing here either.
create or replace view public.sms_threads
with (security_invoker = true) as
select
  t.contact_phone,
  t.provider_ts   as last_at,
  t.body          as last_body,
  t.direction     as last_direction,
  t.status        as last_status,
  c.contact_id,
  coalesce(u.unread, 0)::int as unread
from (
  select distinct on (contact_phone)
    contact_phone, provider_ts, body, direction, status
  from public.sms_messages
  order by contact_phone, provider_ts desc
) t
left join lateral (
  select m.contact_id
  from public.sms_messages m
  where m.contact_phone = t.contact_phone and m.contact_id is not null
  order by m.provider_ts desc
  limit 1
) c on true
left join lateral (
  select count(*) as unread
  from public.sms_messages m
  where m.contact_phone = t.contact_phone
    and m.direction = 'in'
    and m.read_at is null
) u on true;

revoke all on public.sms_threads from anon, authenticated;

comment on table public.sms_messages is
  'Two-way SimpleTexting message log. Service role only (RLS on, no policies). Written by lib/sms.js, /api/simpletexting-webhook and /api/cron/sms-sync.';
comment on table public.sms_opt_outs is
  'Per-phone STOP state mirrored from SimpleTexting. Blocks inbox replies. Never grants consent.';
