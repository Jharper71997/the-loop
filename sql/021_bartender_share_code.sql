-- Migration 021: bartender share_code (typeable at /book checkout)
-- Run in Supabase SQL Editor.
--
-- Bartenders don't want to hand out their phone or paste a referral link.
-- They want to say "type BRITTANY at checkout". share_code is that field:
-- the lowercased, alphanumeric form of their first name. Collisions across
-- the roster get a -2/-3 suffix the same way slug collisions do.
--
-- The lookup at checkout is case-insensitive against this column; it resolves
-- to bartenders.slug, which is the existing qr_code attribution key on
-- orders.metadata.qr_code.

alter table public.bartenders
  add column if not exists share_code text,
  add column if not exists email      text,
  add column if not exists phone      text;

create unique index if not exists bartenders_share_code_lower_idx
  on public.bartenders (lower(share_code))
  where share_code is not null;

-- Backfill every existing row whose share_code is null. base = lowercased,
-- alphanumeric-only display_name. Within each base bucket we ORDER BY
-- created_at so the earliest signup gets the bare name and later ones get
-- -2, -3, etc.
with ranked as (
  select
    slug,
    display_name,
    regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g') as base,
    row_number() over (
      partition by regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g')
      order by created_at, slug
    ) as rn
  from public.bartenders
  where share_code is null
)
update public.bartenders b
set share_code = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
from ranked r
where b.slug = r.slug
  and r.base <> '';
