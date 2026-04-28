-- Migration 008: Ticket Tailor → order_items
-- Run in Supabase SQL Editor after migration 007.
--
-- TT buyers historically only got a row in `orders` (via lib/ticketTailor.js
-- upsertTtOrder). They never had `order_items` rows, which meant the per-ticket
-- check-in QRs (qr_codes.kind='checkin' with order_item_id FK) only existed
-- for native Stripe buyers. As of this migration we mirror every TT
-- issued_ticket into order_items so both channels share a single
-- check-in / scan / SMS codepath via lib/booking.js finalizeBooking().
--
-- The tt_ticket_id column makes ingestion idempotent: webhook + manual
-- backfill can both fire for the same TT order without duplicating rows.

alter table public.order_items
  add column if not exists tt_ticket_id text;

create unique index if not exists order_items_tt_ticket_uniq
  on public.order_items (tt_ticket_id)
  where tt_ticket_id is not null;
