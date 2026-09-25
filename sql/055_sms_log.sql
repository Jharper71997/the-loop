-- Brew Loop — outbound SMS audit log
--
-- /api/send-sms accepted an arbitrary `to` and an arbitrary body from any
-- admin-tier account (which includes seasonal 1099 drivers and door staff),
-- with no length cap, no daily ceiling, and no record of what was sent. After
-- an incident — a bill, a complaint, a carrier suspension — there was nothing
-- to look at.
--
-- The body is stored truncated rather than in full: enough to tell what went
-- out without turning this into a second copy of every rider conversation.
--
-- Idempotent, safe to re-run. Apply in the Supabase SQL editor.

create table if not exists sms_log (
  id          uuid        primary key default gen_random_uuid(),
  sent_at     timestamptz not null default now(),
  actor_email text,                       -- who triggered it
  to_phone    text        not null,
  body_excerpt text,                      -- first 160 chars
  body_length int,
  outcome     text        not null,       -- 'sent' | 'skipped' | 'failed'
  detail      text
);

create index if not exists sms_log_sent_idx on sms_log (sent_at desc);
create index if not exists sms_log_actor_idx on sms_log (actor_email, sent_at desc);

alter table sms_log enable row level security;
-- No policies: service-role reads/writes only, same as the other staff tables.
