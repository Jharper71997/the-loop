-- 015 — Repair orphan event rows produced by the pre-fix Loop edit flow.
--
-- Background: before the route.js POST handler accepted body.event.group_id,
-- saving the "Edit event and tickets" tab on a Loop with no paired event
-- silently created an `events` row with group_id: null. Each retry made
-- another orphan. This migration is a two-pass cleanup — Pass A is a
-- read-only audit (run first, eyeball the output), Pass B is the write
-- (commented out by default; uncomment after reviewing audit output).

-- ---------------------------------------------------------------------------
-- Pass A — audit. Run all THREE queries and read every row.
-- ---------------------------------------------------------------------------

-- A1: Orphan events (group_id is null) and their candidate Loops.
select
  e.id              as orphan_event_id,
  e.name            as event_name,
  e.event_date,
  e.status,
  e.created_at,
  g.id              as candidate_group_id,
  g.name            as group_name,
  exists (
    select 1 from events e2 where e2.group_id = g.id
  )                 as group_already_has_event,
  exists (
    select 1 from orders o where o.event_id = e.id
  )                 as has_orders,
  (select count(*) from ticket_types tt where tt.event_id = e.id) as ticket_type_count
from events e
left join groups g
  on g.name = e.name
 and g.event_date = e.event_date
where e.group_id is null
order by e.event_date desc, e.created_at desc;

-- A2: Loops with MORE THAN ONE event linked. The admin page picks the newest
-- by created_at — anything else linked here is a duplicate that should be
-- deleted (only after confirming it has no real data).
select
  g.id              as group_id,
  g.name            as group_name,
  g.event_date,
  e.id              as event_id,
  e.name            as event_name,
  e.status,
  e.created_at,
  (select count(*) from ticket_types tt where tt.event_id = e.id) as ticket_type_count,
  (select count(*) from orders o where o.event_id = e.id and o.status = 'paid') as paid_orders
from groups g
join events e on e.group_id = g.id
where g.id in (
  select group_id from events where group_id is not null
  group by group_id having count(*) > 1
)
order by g.event_date desc, g.id, e.created_at desc;

-- A3: Quick total-orphan count (sanity check).
select count(*) as orphan_event_count from events where group_id is null;

-- Notes for review:
--   - has_orders = true            → real revenue. Do NOT auto-touch. Investigate manually.
--   - group_already_has_event=true → the Loop is already wired up; the orphan is
--                                    safe to delete after confirming visually.
--   - candidate_group_id is null   → no Loop matches by (name, event_date); leave alone.

-- ---------------------------------------------------------------------------
-- Pass B — write. Uncomment and run AFTER auditing Pass A.
-- ---------------------------------------------------------------------------
-- begin;
--
-- -- 1) Attach the newest orphan per (name, event_date) to its matching Loop,
-- --    but only when the Loop has no event yet AND the orphan has no orders.
-- with attachable as (
--   select distinct on (e.name, e.event_date)
--     e.id as orphan_id,
--     g.id as group_id
--   from events e
--   join groups g
--     on g.name = e.name
--    and g.event_date = e.event_date
--   where e.group_id is null
--     and not exists (select 1 from events e2 where e2.group_id = g.id)
--     and not exists (select 1 from orders  o  where o.event_id  = e.id)
--   order by e.name, e.event_date, e.created_at desc
-- )
-- update events
--    set group_id = a.group_id
--   from attachable a
--  where events.id = a.orphan_id;
--
-- -- 2) Delete leftover order-less orphans whose target Loop is now wired up
-- --    (older duplicates from repeated failed save attempts).
-- delete from events e
--  where e.group_id is null
--    and not exists (select 1 from orders o where o.event_id = e.id)
--    and exists (
--      select 1 from groups g
--        join events e2 on e2.group_id = g.id
--       where g.name = e.name and g.event_date = e.event_date
--    );
--
-- commit;
