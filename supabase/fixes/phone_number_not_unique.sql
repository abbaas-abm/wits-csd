-- ==========================================================
-- Allow the same contact number on more than one profile
-- (shared office lines, or a person with a student and a
-- personal account). Onboarding otherwise fails with
-- "duplicate key value violates unique constraint
-- profiles_phone_number_key".
-- Run in the Supabase SQL editor. Safe to run repeatedly.
-- ==========================================================

alter table public.profiles
  drop constraint if exists profiles_phone_number_key;
