-- Migration 050: how a private party is priced.
--
-- 049 shipped one shape: the organizer buys a "Whole shuttle" seat at a flat
-- quoted price and everyone else rides on a $0 guest seat. That is right when
-- one person is paying for the night (a company, a groom's party).
--
-- It is wrong for the other half of the business: a group who all want to come
-- but each pay their own way. That party wants the ordinary public flow — a
-- per-head price, several separate purchases against the same link, and the
-- option for one person to buy a few seats and sign for those riders.
--
-- Both are private parties. The only difference is how the money is split, so
-- the mode is a property of the event, not a different kind of thing.
--
--   flat        one paid organizer seat + $0 guest seats  (049's shape)
--   per_person  a single priced seat, bought as many times as needed
--
-- Existing parties are 'flat', which is what they were built as.
alter table public.events
  add column if not exists party_pricing text not null default 'flat'
    check (party_pricing in ('flat', 'per_person'));

-- Only meaningful on private events; a public loop ignores it entirely.
comment on column public.events.party_pricing is
  'Private parties only: flat = organizer buys the whole shuttle, per_person = each rider buys a seat.';
