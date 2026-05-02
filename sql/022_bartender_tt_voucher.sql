-- Migration 022: Ticket Tailor voucher id per bartender
-- Run in Supabase SQL Editor.
--
-- When a bartender signs up, the app calls Ticket Tailor's API to create a
-- 0%-off voucher whose code matches the bartender's share_code. Customers
-- buying through TT can then type that code in TT's "promo credit or voucher
-- code" field at checkout, and the leaderboard credits the order to that
-- bartender.
--
-- tt_voucher_id is the id TT returns when the voucher is created. Stored so
-- we can update / disable it later (e.g. if a bartender goes inactive).

alter table public.bartenders
  add column if not exists tt_voucher_id text;
