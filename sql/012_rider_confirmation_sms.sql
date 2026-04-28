-- 012_rider_confirmation_sms.sql
--
-- Tracks the last time we sent a per-rider booking confirmation SMS, so a
-- replay of finalizeBooking (e.g. webhook retried by Stripe) does not double-
-- text the rider. Compared against orders.paid_at to know whether the rider
-- has already been notified for this purchase.

alter table public.contacts
  add column if not exists last_confirmation_sent_at timestamptz;
