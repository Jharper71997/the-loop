-- Migration 052: name on an open-link feedback response.
--
-- 051 opened /feedback to anyone, which also meant responses could arrive with
-- nobody attached — and a hand-raiser who ticks "booking the whole shuttle"
-- with no way to call them back is not a lead, it is a rumour. So the open form
-- now requires a first name and a cell before it will submit, and the route
-- resolves that pair onto a real contacts row (contact_id) using the same
-- phone-first dedupe as checkout.
--
-- ride_feedback.phone already existed from 047 and was never written to; this
-- adds the name beside it so a response reads on its own, even if the contact
-- merge later folds two rows together.

alter table public.ride_feedback
  add column if not exists first_name text;

comment on column public.ride_feedback.first_name is
  'Rider-typed name. Required on open-link (source=link) responses, absent on token responses where the ticket already names them.';
