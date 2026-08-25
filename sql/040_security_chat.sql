-- Migration 040: Customer ↔ security live chat (per-rider DM).
-- Run in the Supabase SQL editor after 039.
--
-- One thread per rider, keyed by contact_id. The rider sends from their boarding
-- pass (/tickets/<code>, identity proven by the unguessable code); security
-- replies from /admin/security. order_id/event_id are stamped for tonight-
-- scoping + display. Service-role only (rider API resolves identity via the
-- ticket code, security API behind auth); RLS ON with no policy = deny-all.

create table if not exists public.security_messages (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  event_id    uuid references public.events(id) on delete set null,
  sender      text not null check (sender in ('rider', 'security')),
  body        text not null,
  read_at     timestamptz,                       -- when the other side read it
  created_at  timestamptz not null default now()
);

create index if not exists security_messages_contact_idx
  on public.security_messages (contact_id, created_at);
create index if not exists security_messages_recent_idx
  on public.security_messages (created_at desc);

alter table public.security_messages enable row level security;
