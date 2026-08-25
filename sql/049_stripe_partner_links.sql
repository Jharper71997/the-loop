-- Migration 049: tie a Stripe customer to the bar or sponsor it pays for.
--
-- The Stripe -> sponsor_payments / bar_payments sync matched partners by
-- guessing at email: sponsors.contact ILIKE the customer email, else
-- bars.contact_email, else bars.notes. On 2026-08-25 that matched 3 of 14
-- active subscriptions.
--
-- It could not have done better. Every one of the 9 Brew bars has a NULL
-- contact_email, so the bar branch could never match anything -- which is why
-- bar_payments held 8 hand-entered rows and nothing since June, while Stripe
-- went on collecting from Archie's, Hideaway, The Angry Ginger, Twin Ravens
-- and Unhinged every month. Half the sponsors have no email in `contact`
-- either (Dream Entertainment is "Ben Horak", Joyas is a phone number).
--
-- Email is the wrong key regardless: it changes, it is free text, and one
-- partner can hold several Stripe customers -- Hideaway currently has two.
-- So: an explicit link table, keyed on the Stripe customer id, which is the
-- thing that actually appears on the invoice.
--
-- The sync prefers a link and falls back to the old email guessing, so an
-- unmapped customer still behaves exactly as it does today.

create table if not exists public.stripe_partner_links (
  stripe_customer_id text primary key,
  partner_type       text not null check (partner_type in ('bar', 'sponsor')),
  bar_slug           text references public.bars(slug) on delete cascade,
  sponsor_id         uuid references public.sponsors(id) on delete cascade,
  email              text,               -- what the customer had when linked, for humans
  note               text,
  created_at         timestamptz not null default now(),

  -- exactly one side, matching partner_type
  constraint stripe_partner_links_one_target check (
    (partner_type = 'bar'     and bar_slug   is not null and sponsor_id is null) or
    (partner_type = 'sponsor' and sponsor_id is not null and bar_slug   is null)
  )
);

create index if not exists stripe_partner_links_bar_idx
  on public.stripe_partner_links (bar_slug);

create index if not exists stripe_partner_links_sponsor_idx
  on public.stripe_partner_links (sponsor_id);

alter table public.stripe_partner_links enable row level security;
