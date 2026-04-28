-- 011_checkout_idempotency.sql
--
-- Adds client_token + cached checkout URL on orders so /api/checkout can be
-- replayed safely when the rider double-taps the Pay button or the request
-- retries from a flaky network. Without this, every POST creates a new order
-- + new Stripe Checkout session, which leaves stale pending rows + duplicate
-- emails from Stripe.

alter table public.orders
  add column if not exists client_token text,
  add column if not exists stripe_checkout_url text;

-- Per-event idempotency: one order per (event_id, client_token). NULL is
-- allowed (legacy orders pre-dating this column).
create unique index if not exists orders_event_client_token_unique
  on public.orders (event_id, client_token)
  where client_token is not null;

-- Used by the capacity check to count active pendings without scanning all
-- pending orders ever.
create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at);
