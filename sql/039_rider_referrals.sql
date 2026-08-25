-- Migration 039: Rider referral links — leaderboard-only (no cash, no discount).
-- Run in the Supabase SQL editor after 038.
--
-- Every rider can get a personal referral link (/invite/<code>). When a friend
-- books off that link, the order is stamped with the referrer's contact id.
-- A rider leaderboard ranks referrers by confirmed (paid) referrals. There is
-- deliberately NO monetary reward — this mirrors the bartender contest, keeping
-- it consistent with the Brew Loop no-discount stance.

-- Per-contact referral code. Generated on demand by the app (lib/riderReferral)
-- the first time a rider opens their link; unique so /invite/<code> resolves to
-- exactly one rider.
alter table public.contacts
  add column if not exists referral_code text;

create unique index if not exists contacts_referral_code_key
  on public.contacts (referral_code)
  where referral_code is not null;

-- Which rider sent this booking. Distinct from orders.metadata.qr_code (that's
-- the bartender/QR attribution); a booking can have both a bartender code and a
-- rider referrer.
alter table public.orders
  add column if not exists referrer_contact_id uuid references public.contacts(id) on delete set null;

create index if not exists orders_referrer_idx
  on public.orders (referrer_contact_id)
  where referrer_contact_id is not null;
