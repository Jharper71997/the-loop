-- Migration 048: put the 1-hour pickup reminder on a real schedule.
--
-- The route (app/api/cron/ticket-reminder) has existed since May but nothing
-- has ever called it: the */10 entry was pulled from vercel.json because the
-- Vercel Hobby plan only allows daily crons, and a sub-daily entry there makes
-- every subsequent deploy fail silently. So the schedule lives here instead,
-- in pg_cron, which does not care what plan Vercel is on.
--
-- Idempotent and self-contained: it re-applies the pieces of 025 and 029 that
-- production turned out to be missing, so this one file is the whole
-- "turn it on".
--
-- Run in the Supabase SQL Editor. Replace __EXTERNAL_CRON_SECRET__ with the
-- value of the EXTERNAL_CRON_SECRET env var in Vercel before running.

-- 1. (from 025) Stamp column, so a seat is only ever reminded once. ----------
alter table public.order_items
  add column if not exists reminder_sent_at timestamptz;

create index if not exists order_items_reminder_pending_idx
  on public.order_items (reminder_sent_at)
  where reminder_sent_at is null and voided_at is null;

-- 2. (from 029) Leadership toggles, in case that migration never ran. --------
create table if not exists public.automation_settings (
  key          text primary key,
  enabled      boolean      not null default true,
  label        text         not null,
  description  text,
  category     text         not null default 'other',
  updated_at   timestamptz  not null default now(),
  updated_by   text
);

create index if not exists automation_settings_category_idx
  on public.automation_settings (category);

alter table public.automation_settings enable row level security;

drop policy if exists automation_settings_service_all on public.automation_settings;
create policy automation_settings_service_all on public.automation_settings
  for all to service_role using (true) with check (true);

insert into public.automation_settings (key, enabled, label, description, category) values
  ('booking_confirmation_buyer_sms',   true,  'Buyer SMS',               'Sends the booking confirmation SMS to the order''s buyer phone.',                               'booking_confirmation'),
  ('booking_confirmation_buyer_email', true,  'Buyer email',             'Sends the booking confirmation email to the order''s buyer email.',                             'booking_confirmation'),
  ('booking_confirmation_buyer_push',  true,  'Buyer push notification', 'Sends a web-push notification to the buyer''s subscribed devices.',                             'booking_confirmation'),
  ('booking_confirmation_rider_sms',   true,  'Per-rider SMS',           'Sends an individual SMS to each rider on the order with their personal /tickets/<code> link.',  'booking_confirmation'),
  ('booking_confirmation_rider_email', true,  'Per-rider email',         'Sends an individual email to each rider on the order with their personal /tickets/<code> link.', 'booking_confirmation'),
  ('booking_confirmation_rider_push',  true,  'Per-rider push',          'Sends a web-push notification to each rider with a subscribed device.',                          'booking_confirmation'),
  ('waiver_nudge_cron',                false, 'Daily waiver-nudge cron', 'Texts every unsigned rider for today''s Loop a link to /waiver/<id>.',                            'waivers'),
  ('ride_feedback_cron',               false, 'Morning-after feedback survey', 'Texts + emails last night''s riders a link to /feedback/<token>.',                          'feedback')
on conflict (key) do nothing;

-- 3. The reminder's own switch. ON — running this migration IS the act of
--    turning it on. Flip it at /leadership/automations to stop it later
--    without a deploy.
insert into public.automation_settings (key, enabled, label, description, category) values
  ('ticket_reminder_cron', true, '1-hour pickup reminder',
   'SMS + email to each rider about an hour before their own stop time, with their QR and the live track link.',
   'reminders')
on conflict (key) do update set enabled = true;

-- 4. The schedule itself. ----------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-running the migration replaces the job rather than stacking duplicates.
select cron.unschedule('ticket-reminder')
  where exists (select 1 from cron.job where jobname = 'ticket-reminder');

-- Target the vercel.app alias rather than jvillebrewloop.com: the apex is a
-- DNS record that has pointed at Squarespace before and may again, while the
-- alias always follows this project's production deployment.
--
-- Every 10 min, all day. The route itself is the filter — it returns in a few
-- ms unless a paid seat's stop time is 55-70 minutes out, which only happens
-- on ride nights.
select cron.schedule(
  'ticket-reminder',
  '*/10 * * * *',
  $job$
  select net.http_get(
    url     := 'https://the-loop-eight.vercel.app/api/cron/ticket-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer __EXTERNAL_CRON_SECRET__'),
    timeout_milliseconds := 55000
  );
  $job$
);

-- Check it afterwards:
--   select jobid, jobname, schedule, active from cron.job;
--   select status, return_message, start_time from cron.job_run_details
--     order by start_time desc limit 10;
