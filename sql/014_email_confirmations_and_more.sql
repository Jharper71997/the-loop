-- 014_email_confirmations_and_more.sql
--
-- Bundle of additive schema changes for: email confirmations, self-serve
-- resend, failure alerts, ticket voiding, push notifications, and the
-- send-friends claim-link flow. All ALTERs use IF NOT EXISTS so re-running
-- is safe.

-- Email confirmations (Step 2 + 3)
alter table public.contacts
  add column if not exists last_confirmation_email_sent_at timestamptz;

-- Self-serve resend rate limit (Step 3)
alter table public.orders
  add column if not exists last_resend_at timestamptz;

-- Failure alerts (Step 4)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null default 'error',
  subject text,
  body text,
  context jsonb,
  created_at timestamptz default now(),
  notified_at timestamptz,
  resolved_at timestamptz
);
create index if not exists notifications_unnotified_idx
  on public.notifications (created_at) where notified_at is null;
create index if not exists notifications_unresolved_idx
  on public.notifications (created_at desc) where resolved_at is null;

-- Void tickets (Step 6)
alter table public.order_items
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists void_reason text;
create index if not exists order_items_active_idx
  on public.order_items (order_id) where voided_at is null;

-- Push notifications (Step 9)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_pushed_at timestamptz
);
create index if not exists push_subscriptions_contact_idx
  on public.push_subscriptions (contact_id);

alter table public.contacts
  add column if not exists last_push_sent_at timestamptz;

-- Send-friends claim links (Step 10)
alter table public.order_items
  add column if not exists claim_token text unique,
  add column if not exists claimed_at timestamptz;
create index if not exists order_items_unclaimed_idx
  on public.order_items (claim_token) where claimed_at is null;
