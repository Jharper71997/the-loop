-- Migration 029: automation_settings — DB-driven on/off toggles for the
-- Loop's automated sends + crons, so leadership can flip them from
-- /leadership/automations without a redeploy.
--
-- Each row is a stable string key referenced by the relevant code path.
-- enabled defaults to true (= keep the historical default) so introducing
-- a new key is a no-op until someone flips it.

create table if not exists public.automation_settings (
  key          text primary key,
  enabled      boolean      not null default true,
  label        text         not null,
  description  text,
  category     text         not null default 'other',
  updated_at   timestamptz  not null default now(),
  updated_by   text
);

-- Seed the keys the app currently honors. Insert-not-update so re-running
-- the migration doesn't blow away leadership's manual flips.
insert into public.automation_settings (key, enabled, label, description, category) values
  ('booking_confirmation_buyer_sms',   true,  'Buyer SMS',                'Sends the booking confirmation SMS to the order''s buyer phone.',                                'booking_confirmation'),
  ('booking_confirmation_buyer_email', true,  'Buyer email',              'Sends the booking confirmation email to the order''s buyer email.',                              'booking_confirmation'),
  ('booking_confirmation_buyer_push',  true,  'Buyer push notification',  'Sends a web-push notification to the buyer''s subscribed devices.',                              'booking_confirmation'),
  ('booking_confirmation_rider_sms',   true,  'Per-rider SMS',            'Sends an individual SMS to each rider on the order with their personal /tickets/<code> link.',  'booking_confirmation'),
  ('booking_confirmation_rider_email', true,  'Per-rider email',          'Sends an individual email to each rider on the order with their personal /tickets/<code> link.','booking_confirmation'),
  ('booking_confirmation_rider_push',  true,  'Per-rider push',           'Sends a web-push notification to each rider with a subscribed device.',                          'booking_confirmation'),
  ('waiver_nudge_cron',                false, 'Daily waiver-nudge cron',  'Texts every unsigned rider for today''s Loop a link to /waiver/<id>. Currently not wired in vercel.json.', 'waivers')
on conflict (key) do nothing;

create index if not exists automation_settings_category_idx
  on public.automation_settings (category);

alter table public.automation_settings enable row level security;

-- Service role (server) reads + writes; no anon access.
drop policy if exists automation_settings_service_all on public.automation_settings;
create policy automation_settings_service_all on public.automation_settings
  for all to service_role using (true) with check (true);
