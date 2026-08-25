-- Migration 032: add tt_barcode to order_items so the staff scanner can
-- accept the QR codes Ticket Tailor emails to customers.
--
-- TT issued_tickets have a short alphanumeric `barcode` (e.g. "ww64NQx")
-- encoded into the QR/barcode image on the customer's ticket. We store it
-- alongside tt_ticket_id so /api/checkin can look up the order_item by
-- whatever the scanner reads.
--
-- Nullable: native Loop order_items never have a TT barcode. Unique partial
-- index keeps lookups fast and prevents accidental duplicate mirrors.

alter table public.order_items
  add column if not exists tt_barcode text;

create unique index if not exists order_items_tt_barcode_uniq
  on public.order_items (tt_barcode)
  where tt_barcode is not null;
