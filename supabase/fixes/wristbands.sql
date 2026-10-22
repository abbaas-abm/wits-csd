-- ==========================================================
-- Wristband colours per registration
-- Admins assign a wristband colour to registered attendees
-- (e.g. for the Student Leadership Awards); volunteers see it
-- when they scan someone in.
-- Run in the Supabase SQL editor. Safe to run repeatedly.
-- ==========================================================

alter table public.registrations
  add column if not exists wristband_color text;

-- Admins set and change colours from the event editor.
drop policy if exists "Admins can update registrations" on public.registrations;
create policy "Admins can update registrations"
  on public.registrations for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
