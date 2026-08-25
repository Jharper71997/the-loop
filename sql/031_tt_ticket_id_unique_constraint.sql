-- Migration 031: order_items.tt_ticket_id unique CONSTRAINT (for upsert ON CONFLICT)
--
-- Migration 008 created a *partial* unique index on order_items.tt_ticket_id
-- with `WHERE tt_ticket_id IS NOT NULL`. That prevents duplicate rows fine,
-- but PostgREST's .upsert(..., { onConflict: 'tt_ticket_id' }) requires a
-- proper unique CONSTRAINT — partial indexes can't be inferred without
-- specifying the WHERE predicate, which supabase-js doesn't expose.
--
-- Symptom: ticket-tailor-webhook fails for every TT order with
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- so TT sales stop mirroring into order_items. The Loop's per-stop capacity
-- check then loses visibility into TT sales and oversells past the shared cap.
--
-- Fix: drop the partial index, add a real unique CONSTRAINT. Postgres treats
-- multiple NULLs as distinct by default, so native (non-TT) order_items with
-- null tt_ticket_id stay valid.
--
-- Safety: if there are already duplicate non-null tt_ticket_id rows from a
-- pre-008 backfill, the ADD CONSTRAINT will fail. Run the duplicate-check
-- query first and clean up before applying the constraint.

-- Step 1 (read-only check) — should return ZERO rows. If it doesn't, dedupe
-- before running step 2.
--
--   select tt_ticket_id, count(*)
--   from public.order_items
--   where tt_ticket_id is not null
--   group by tt_ticket_id
--   having count(*) > 1;

-- Step 2 — apply.
drop index if exists public.order_items_tt_ticket_uniq;

alter table public.order_items
  add constraint order_items_tt_ticket_id_key
  unique (tt_ticket_id);
