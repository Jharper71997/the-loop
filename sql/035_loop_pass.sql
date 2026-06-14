-- Migration 035: Loop Pass — recurring rider subscription.
-- Run in the Supabase SQL editor after 034.
--
-- A Loop Pass is a Stripe subscription tied to a contact. The pass row is the
-- local mirror of that subscription, kept current by the Stripe webhook
-- (checkout.session.completed + customer.subscription.* events). All access is
-- service-role only (the app never reads this table from the browser), so RLS
-- is ON with no policy = deny-all to the anon key.

create table if not exists public.loop_passes (
  id                     uuid primary key default gen_random_uuid(),
  contact_id             uuid references public.contacts(id) on delete set null,
  plan                   text not null default 'monthly'
                           check (plan in ('monthly', 'season')),
  status                 text not null default 'active'
                           check (status in ('active', 'past_due', 'canceled')),
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists loop_passes_contact_idx
  on public.loop_passes (contact_id);

-- Fast "does this contact have a live pass?" lookup at booking time.
create index if not exists loop_passes_active_idx
  on public.loop_passes (contact_id) where status = 'active';

alter table public.loop_passes enable row level security;
