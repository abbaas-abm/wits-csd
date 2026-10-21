-- ==========================================================
-- Invite-only events
-- An event with invite_only = true only accepts registrations
-- from people whose sign-in email is on its invite list.
-- Enforced by a trigger on registrations, so it cannot be
-- bypassed from the client.
-- Run in the Supabase SQL editor. Safe to run repeatedly.
-- ==========================================================

alter table public.events
  add column if not exists invite_only boolean not null default false;

create table if not exists public.event_invites (
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now(),
  primary key (event_id, email),
  constraint event_invites_email_lower check (email = lower(trim(email)))
);

-- Row Level Security: only admins can see or manage invite lists.
alter table public.event_invites enable row level security;

drop policy if exists "Admins can manage event invites" on public.event_invites;
create policy "Admins can manage event invites"
  on public.event_invites for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Is this user on the event's invite list? Matches their sign-in email, the
-- email on their profile, or their student/staff number against the part of
-- an invite email before the @ (e.g. 1234567@students.wits.ac.za), so people
-- who signed up with a personal email still match.
create or replace function public.user_on_invite_list(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_invites i
    left join auth.users u on u.id = p_user_id
    left join public.profiles p on p.id = p_user_id
    where i.event_id = p_event_id
      and (
        i.email = lower(trim(u.email))
        or i.email = lower(trim(p.email))
        or (
          nullif(trim(p.person_number), '') is not null
          and split_part(i.email, '@', 1) = lower(trim(p.person_number))
        )
      )
  );
$$;

-- Internal helper: don't let clients probe other users' invite status.
revoke all on function public.user_on_invite_list(uuid, uuid)
  from public, anon, authenticated;

-- Is the signed-in user allowed to register? (true for open events)
create or replace function public.is_invited(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not coalesce((select invite_only from public.events where id = p_event_id), false)
    or public.user_on_invite_list(p_event_id, auth.uid());
$$;

grant execute on function public.is_invited(uuid) to authenticated;

-- Block confirmed registrations for invite-only events from anyone not invited.
create or replace function public.enforce_event_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only check when a registration becomes confirmed, so routine updates
  -- (e.g. saving the attendee tag URL) on existing rows are unaffected.
  if new.status = 'CONFIRMED'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and coalesce((select invite_only from public.events where id = new.event_id), false)
     and not public.user_on_invite_list(new.event_id, new.attendee_id)
  then
    raise exception 'NOT_INVITED: this event is by invitation only'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_enforce_invite on public.registrations;
create trigger registrations_enforce_invite
  before insert or update of status on public.registrations
  for each row execute function public.enforce_event_invite();
