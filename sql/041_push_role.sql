-- Migration 041: tag push subscriptions with a role so staff devices (not just
-- riders) can receive pushes. Run after 040.
--
-- Rider subscriptions keep role = null (targeted by contact_id as before).
-- A security device subscribes with role = 'security' and contact_id = null, so
-- new rider chat messages can push to whoever's working the door.

alter table public.push_subscriptions
  add column if not exists role text;

create index if not exists push_subscriptions_role_idx
  on public.push_subscriptions (role) where role is not null;
