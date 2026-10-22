-- ==========================================================
-- Wristband colours per registration
-- Admins assign a wristband colour to registered attendees
-- (e.g. for the Student Leadership Awards); volunteers see it
-- when they scan someone in.
-- Also holds wristbands for people not registered yet, which
-- move onto their registration when they register.
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

-- ----------------------------------------------------------
-- Wristbands for people who haven't registered yet.
-- Stored against an email or student/staff number; when the
-- person registers, the colours move onto their registration.
-- ----------------------------------------------------------

create table if not exists public.event_wristbands (
  event_id uuid not null references public.events (id) on delete cascade,
  identifier text not null,
  name text,
  colors text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, identifier),
  constraint event_wristbands_identifier_lower
    check (identifier = lower(trim(identifier)))
);

alter table public.event_wristbands enable row level security;

drop policy if exists "Admins can manage event wristbands" on public.event_wristbands;
create policy "Admins can manage event wristbands"
  on public.event_wristbands for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Same matching as invite lists: sign-in email, profile email, or
-- student/staff number (also against the part of an email before the @).
create or replace function public.pending_wristband_matches(
  p_event_id uuid,
  p_user_id uuid
)
returns setof public.event_wristbands
language sql
stable
security definer
set search_path = public
as $$
  select w.*
  from public.event_wristbands w
  left join auth.users u on u.id = p_user_id
  left join public.profiles p on p.id = p_user_id
  where w.event_id = p_event_id
    and (
      w.identifier = lower(trim(u.email))
      or w.identifier = lower(trim(p.email))
      or (
        nullif(trim(p.person_number), '') is not null
        and (
          w.identifier = lower(trim(p.person_number))
          or split_part(w.identifier, '@', 1) = lower(trim(p.person_number))
        )
      )
    );
$$;

revoke all on function public.pending_wristband_matches(uuid, uuid)
  from public, anon, authenticated;

-- AFTER trigger: runs only once the registration row is final, so an upsert
-- that turns into an update can't swallow the pending colours.
create or replace function public.apply_pending_wristband()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending text;
  v_merged text;
begin
  if new.status <> 'CONFIRMED'
     or (tg_op = 'UPDATE' and old.status is not distinct from new.status)
  then
    return null;
  end if;

  select string_agg(m.colors, ', ' order by m.created_at)
    into v_pending
    from public.pending_wristband_matches(new.event_id, new.attendee_id) m;
  if v_pending is null then
    return null;
  end if;

  -- Existing colours first, then pending ones, without duplicates.
  select string_agg(c, ', ' order by first_seen)
    into v_merged
    from (
      select trim(c) as c, min(ord) as first_seen
      from unnest(
        string_to_array(concat_ws(',', new.wristband_color, v_pending), ',')
      ) with ordinality as t(c, ord)
      where trim(c) <> ''
      group by trim(c)
    ) s;

  update public.registrations
     set wristband_color = v_merged
   where id = new.id;

  delete from public.event_wristbands w
   using public.pending_wristband_matches(new.event_id, new.attendee_id) m
   where w.event_id = m.event_id
     and w.identifier = m.identifier;

  return null;
end;
$$;

drop trigger if exists registrations_apply_pending_wristband on public.registrations;
create trigger registrations_apply_pending_wristband
  after insert or update of status on public.registrations
  for each row execute function public.apply_pending_wristband();
