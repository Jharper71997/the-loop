-- Migration 025: track 1-hour-before-pickup reminders on order_items.
--
-- The cron at /api/cron/ticket-reminder fires every 10 minutes, scoops up
-- any item whose pickup is 60 +/- 5 min from now, and sends an email +
-- SMS reminder. reminder_sent_at stamps the send so we don't double-fire
-- across cron ticks.
--
-- Run in Supabase SQL Editor.

alter table public.order_items
  add column if not exists reminder_sent_at timestamptz;

create index if not exists order_items_reminder_pending_idx
  on public.order_items (reminder_sent_at)
  where reminder_sent_at is null and voided_at is null;
