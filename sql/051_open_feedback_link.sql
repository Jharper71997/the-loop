-- Migration 051: open (tokenless) feedback link at /feedback.
--
-- 047 built the morning-after survey, but every response has to arrive through
-- a per-ticket token minted by /api/cron/ride-feedback. That covers riders the
-- system knows boarded; it does not cover the link Jacob wants to paste into a
-- group text, print on a card, or hang as a QR on the bus.
--
-- So: same four screens, same Google review ask, but the row is keyed on a
-- token the browser mints instead of a ticket. Anonymous by default — the rider
-- can still leave an email on screen 3.
--
-- Two consequences worth naming:
--   * order_item_id becomes nullable. Open-link rows have no ticket, so they
--     also have no event_id / group_id / contact_id. The leadership report
--     counts them separately rather than folding them into response rate.
--   * public_token gets a FULL unique index, not a partial one. PostgREST's
--     upsert emits `ON CONFLICT (public_token)` with no WHERE clause, which
--     cannot infer a partial index. NULLs are distinct in a unique index, so
--     every token-minted row coexists happily with a NULL here.

alter table public.ride_feedback
  alter column order_item_id drop not null;

alter table public.ride_feedback
  add column if not exists public_token text,
  add column if not exists source       text not null default 'survey';

create unique index if not exists ride_feedback_public_token_uniq
  on public.ride_feedback (public_token);

create index if not exists ride_feedback_source_idx
  on public.ride_feedback (source);

comment on column public.ride_feedback.source is
  'survey = morning-after per-ticket link (047). link = open /feedback link, no ticket attached.';
