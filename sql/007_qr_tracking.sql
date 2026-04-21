-- Migration 007: QR code tracking
-- Run in Supabase SQL Editor after migration 006.
--
-- Two tables drive attribution + check-in + bar/sponsor/waiver shortcuts:
--   qr_codes  — one row per printable/scannable code; target URL, UTM params,
--               optional link to a bar, sponsor, or order_item (for per-ticket
--               check-in QRs).
--   qr_scans  — append-only log; one row per /r/<code> hit. Joined to orders
--               on `resulting_order_id` when a scan ends in a purchase.
--
-- Attribution flow:
--   flyer/coaster/bar print -> /r/<code> -> logs scan, 302s to
--   target_url with UTM params appended -> buyer completes /book ->
--   stripe-webhook stamps orders.metadata.qr_code and sets
--   qr_scans.resulting_order_id on the most recent scan from that session.

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('attribution','checkin','bar','waiver','sponsor')),
  label text,
  target_url text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  bar_id uuid,
  sponsor_id uuid,
  order_item_id uuid references public.order_items(id) on delete cascade,
  png_url text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists qr_codes_kind_idx
  on public.qr_codes (kind, created_at desc);

create index if not exists qr_codes_order_item_idx
  on public.qr_codes (order_item_id)
  where order_item_id is not null;

create table if not exists public.qr_scans (
  id uuid primary key default gen_random_uuid(),
  qr_id uuid not null references public.qr_codes(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  resulting_order_id uuid
);

create index if not exists qr_scans_qr_idx
  on public.qr_scans (qr_id, scanned_at desc);

create index if not exists qr_scans_order_idx
  on public.qr_scans (resulting_order_id)
  where resulting_order_id is not null;

-- Track who checked in. Added on order_items so per-ticket QRs can mark
-- each rider individually at pickup.
alter table public.order_items
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_via text;
