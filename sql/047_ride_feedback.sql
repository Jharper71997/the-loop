-- Migration 047: post-ride feedback survey.
--
-- The morning after a Loop, every rider who actually boarded gets one SMS +
-- email with a link to /feedback/<token>. Three screens, front-loaded so the
-- answer we care about most is the one that costs the least:
--   1. Overall 1-5. One tap, saved on tap.
--   2. The ride itself — driver / bars / timing, favorite stop, ride again,
--      one open box.
--   3. Optional and skippable — who they came with, how they found us, what
--      else they'd buy, email.
-- The thank-you screen then asks for a Google review and hands them their
-- referral link.
--
-- Two moving parts:
--   1. order_items.feedback_token  — per-ticket URL token (also the dedupe key,
--      since one ticket = one rider = one response).
--      order_items.feedback_sent_at — stamped by /api/cron/ride-feedback so a
--      re-run never double-texts.
--   2. ride_feedback — one row per submitted survey.
--
-- Note on the Google review CTA: it is shown to EVERY rider regardless of
-- rating. Only routing happy riders to Google ("review gating") violates
-- Google's review policy and gets the reviews filtered. Low ratings instead
-- lead with a private "what went wrong" box and raise a notifications row.

-- 1. Per-ticket token + send stamp.
alter table public.order_items
  add column if not exists feedback_token   text,
  add column if not exists feedback_sent_at timestamptz;

create unique index if not exists order_items_feedback_token_uniq
  on public.order_items (feedback_token)
  where feedback_token is not null;

-- 2. Responses.
create table if not exists public.ride_feedback (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items(id) on delete cascade,
  order_id       uuid references public.orders(id)  on delete set null,
  event_id       uuid references public.events(id)  on delete set null,
  group_id       uuid references public.groups(id)  on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,

  -- Screen 1: the one number we manage against.
  rating         int  check (rating between 1 and 5),

  -- Screen 2: the three things we can actually change between weekends, rated
  -- separately so a 3-star night tells us WHICH part was the 3.
  driver_rating  int  check (driver_rating between 1 and 5),
  bars_rating    int  check (bars_rating between 1 and 5),
  timing_rating  int  check (timing_rating between 1 and 5),
  favorite_bar   text,
  ride_again     text check (ride_again in ('yes', 'maybe', 'no')),
  comment        text,

  -- Screen 3: who they are and what else they'd buy. Optional and skippable —
  -- this is the marketing half, and it must never cost us the rating above.
  group_type     text,
  heard_about    text,
  interests      text[] not null default '{}',

  -- Rider-supplied contact, captured only when we don't already have it (most
  -- Ticket Tailor orders arrive with the buyer's email and nothing per-rider).
  email          text,
  phone          text,
  marketing_opt_in boolean not null default false,

  -- Stamped when the rider taps through to the Google review page. Lets us see
  -- review-intent conversion without guessing from the Google listing.
  review_clicked_at timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One response per ticket. The API upserts on this so a rider who reopens the
-- link edits their answer instead of creating a duplicate.
create unique index if not exists ride_feedback_item_uniq
  on public.ride_feedback (order_item_id);

create index if not exists ride_feedback_group_idx
  on public.ride_feedback (group_id);
create index if not exists ride_feedback_created_idx
  on public.ride_feedback (created_at desc);

alter table public.ride_feedback enable row level security;

-- Server-only, same as orders/order_items. The public survey page writes
-- through /api/feedback using the service role after validating the token.
drop policy if exists ride_feedback_service_all on public.ride_feedback;
create policy ride_feedback_service_all on public.ride_feedback
  for all to service_role using (true) with check (true);

-- 3. Leadership toggle. Defaults FALSE — the cron is inert until someone flips
-- it at /leadership/automations, same as the waiver nudge.
insert into public.automation_settings (key, enabled, label, description, category) values
  ('ride_feedback_cron', false, 'Morning-after feedback survey',
   'Texts + emails every rider who boarded last night''s Loop a link to /feedback/<token>: overall rating, driver/bars/timing, favorite stop, ride-again, one open box, then a Google review ask.',
   'feedback')
on conflict (key) do nothing;
