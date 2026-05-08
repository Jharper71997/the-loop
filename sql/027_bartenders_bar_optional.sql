-- Migration 027: bar is optional on bartenders
-- Run this in Supabase SQL Editor.
--
-- The "bartender contest" is now the Brew Loop Sales Contest, open to anyone
-- who wants to sell tickets — not just bar staff. Sellers who aren't with a
-- partner bar can sign up without picking one. The `bar` column stays so
-- existing rows keep their affiliation; we just drop the NOT NULL.

alter table public.bartenders
  alter column bar drop not null;
