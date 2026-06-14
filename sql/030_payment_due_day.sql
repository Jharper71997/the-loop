-- Migration 030: per-entity billing day for sponsors + bars.
-- Run after 029.
--
-- Until now the leadership income view assumed all monthly payments are due
-- by end-of-month. Richard collects on different days for different
-- sponsors/bars (some on the 1st, some on a contract anniversary, etc).
-- payment_due_day stores the day-of-month (1-31) each entity is supposed to
-- pay by; the income page computes the actual next due date from it
-- (clamped to the last day of the month for short months).
--
-- NULL means "no billing day set" → fall back to end of current month.

alter table public.sponsors
  add column if not exists payment_due_day smallint
  check (payment_due_day is null or (payment_due_day between 1 and 31));

alter table public.bars
  add column if not exists payment_due_day smallint
  check (payment_due_day is null or (payment_due_day between 1 and 31));
