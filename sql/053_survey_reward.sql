-- Migration 053: the 50%-off code paid out for completing the feedback survey.
--
-- The offer: previous riders get emailed asking them to fill out /feedback, and
-- everyone who finishes gets a confirmation email carrying the code SURVEY.
--
-- Three rules are load-bearing and are enforced in lib/surveyReward.js, not
-- here. They are written down because the obvious "improvements" all break the
-- Google review policy and cost the listing:
--
--   1. The code is paid for the FEEDBACK, never for a review. It is granted on
--      submit and is in no way conditional on review_clicked_at.
--   2. It is granted at EVERY rating, 1 star through 5. Paying only happy
--      riders is review gating twice over.
--   3. It is delivered by EMAIL, so it never shares a screen with the Google
--      button (see the header comment on bl-review-email.js).
--
-- reward_sent_at doubles as the dedupe key AND the claim lock: the sender
-- stamps it with a conditional update (`where reward_sent_at is null`) and only
-- sends if that update actually touched a row. The survey POSTs several times
-- per rider, so an unguarded send mails the code once per tap.

alter table public.ride_feedback
  add column if not exists reward_code    text,
  add column if not exists reward_sent_at timestamptz;

create index if not exists ride_feedback_reward_idx
  on public.ride_feedback (reward_sent_at desc)
  where reward_sent_at is not null;

comment on column public.ride_feedback.reward_code is
  'Discount code emailed for completing the survey. Paid for feedback only, at every rating, never for a Google review.';
comment on column public.ride_feedback.reward_sent_at is
  'Claim lock + dedupe for the reward email. Stamped conditionally; a send only follows a stamp that actually took.';

-- Kill switch at /leadership/automations. Defaults TRUE, unlike the cron
-- toggles: this is a reply to a rider who just finished the survey after being
-- promised a code, not something that starts messaging people on its own.
-- Turning it off while the offer email is in the wild means those riders get
-- nothing, so the description says so on the toggle itself.
insert into public.automation_settings (key, enabled, label, description, category) values
  ('survey_reward_email', true, 'Survey reward code email',
   'Emails the 50% off code to every rider who completes /feedback. Paid for the feedback only, at every star rating, never for a Google review. Turn this OFF only after the offer email has stopped going out, or riders who were promised a code will get nothing.',
   'feedback')
on conflict (key) do nothing;
