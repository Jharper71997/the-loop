-- Migration 042: capture a pickup bar for walk-on tickets.
-- Run in the Supabase SQL editor after 041.
--
-- Normal tickets are per-bar: their ticket_type carries a stop_index, copied
-- onto order_items.stop_index, which the driver/security and capacity math all
-- read. Walk-on tickets have NO bar (ticket_type.stop_index is null), so we
-- never knew where to pick the rider up.
--
-- pickup_stop_index records the bar a walk-on buyer chose at checkout (an index
-- into the night's group.schedule, same space as stop_index). It is kept
-- SEPARATE from stop_index on purpose: stop_index drives per-stop seat capacity,
-- and walk-ons are extra capacity beyond the pre-sold per-bar seats — so we must
-- not let a walk-on count against a bar's seat cap. Anything that needs "where
-- is this rider boarding" uses coalesce(stop_index, pickup_stop_index).

alter table public.order_items
  add column if not exists pickup_stop_index int;
