-- Migration 044: The Loop (Marines) — DoD ID (EDIPI) on verification + profile.
-- Run in the Supabase SQL editor after 043, BEFORE deploying the code that
-- writes dod_id (the verify API errors if the column is missing).
--
-- dod_id = the 10-digit DoD ID / EDIPI off the rider's military ID. Collected
-- once on the verify form. Stored on the verification record (so the approver
-- can match it to the card) AND on the contact, so it's linked to the rider's
-- profile and never re-collected on later rides.

alter table public.military_verifications
  add column if not exists dod_id text;

alter table public.contacts
  add column if not exists dod_id text;
