-- 013_waiver_resign_floor.sql
--
-- Lets us bump the waiver text (typo fix, formatting tweak) without forcing
-- every prior signer to re-sign. A signature for any version >= the highest
-- `requires_resign=true` version counts as valid.
--
-- Default false: bumping a version is treated as a non-material edit. Admin
-- flips this true only when the legal change requires fresh consent.

alter table public.waiver_versions
  add column if not exists requires_resign boolean not null default false;
