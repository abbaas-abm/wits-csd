-- ==========================================================
-- Activity log: everything that happens on the platform
-- Run in the Supabase SQL editor. Safe to run repeatedly.
--
-- Rows come from two places:
--  1. Triggers on the app's tables (below): registrations, check-ins,
--     pledges, event edits, … — whoever or whatever made the change.
--  2. The app's /api/activity route, for sign-in steps the database never
--     sees (code requested, wrong code, signed in, signed out).
--
-- Only admins can read it; nobody can write to it directly. Logging never
-- blocks the change being logged: any error is swallowed with a warning.
-- ==========================================================

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category text not null,          -- sign-in, accounts, registrations, check-ins, engagement, content
  action text not null,            -- e.g. registrations.insert, auth.otp_failed
  actor_id uuid,                   -- who did it (null = system / signed-out visitor)
  subject_id uuid,                 -- who it's about (attendee, pledger, …)
  event_id uuid,
  record_id text,
  email text,                      -- for sign-in steps before an account exists
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_category_idx on public.activity_log (category, created_at desc);
create index if not exists activity_log_actor_idx on public.activity_log (actor_id, created_at desc);
create index if not exists activity_log_subject_idx on public.activity_log (subject_id, created_at desc);
create index if not exists activity_log_event_idx on public.activity_log (event_id, created_at desc);
create index if not exists activity_log_email_idx on public.activity_log (lower(email));

alter table public.activity_log enable row level security;

drop policy if exists "Admins can read the activity log" on public.activity_log;
create policy "Admins can read the activity log"
  on public.activity_log for select
  to authenticated
  using (public.is_admin());

-- ---------- helpers ----------

create or replace function public.activity_category(tbl text)
returns text language sql immutable as $$
  select case
    when tbl in ('profiles', 'push_subscriptions') then 'accounts'
    when tbl in ('registrations', 'event_invites', 'event_wristbands') then 'registrations'
    when tbl = 'attendance' then 'check-ins'
    when tbl in ('pledges', 'reflections', 'feedback', 'qna') then 'engagement'
    else 'content'
  end
$$;

-- A record without bulky or secret fields, for showing what was affected.
create or replace function public.activity_trim(j jsonb)
returns jsonb language sql immutable as $$
  select coalesce(
    jsonb_object_agg(
      key,
      case when length(value::text) > 160
        then to_jsonb(left(value #>> '{}', 157) || '…')
        else value end
    ),
    '{}'::jsonb
  )
  from jsonb_each(j)
  where key not in ('keys', 'endpoint', 'created_at', 'updated_at')
    and key not like '%\_key' and key not like '%\_url'
$$;

-- Caller's IP and browser, from the API request that caused the change.
create or replace function public.activity_request()
returns jsonb language plpgsql stable as $$
declare
  h jsonb;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    h := null;
  end;
  if h is null then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'ip', coalesce(
      h->>'cf-connecting-ip',
      nullif(trim(split_part(h->>'x-forwarded-for', ',', 1)), ''),
      h->>'x-real-ip'
    ),
    'ua', h->>'user-agent'
  );
end $$;

-- ---------- row trigger (most tables) ----------

create or replace function public.log_row_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  changes jsonb;
  req jsonb;
  subj text;
  ev text;
begin
  begin
    rec := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

    if TG_OP = 'UPDATE' then
      select jsonb_object_agg(
               n.key,
               case
                 when n.key like '%\_url' or n.key like '%\_key'
                   or length(n.value::text) > 160 or length(o.value::text) > 160
                   then jsonb_build_object('changed', true)
                 else jsonb_build_object('from', o.value, 'to', n.value)
               end)
        into changes
        from jsonb_each(rec) n
        join jsonb_each(to_jsonb(OLD)) o using (key)
       where n.value is distinct from o.value
         and n.key not in ('updated_at', 'keys', 'endpoint');
      -- Nothing worth recording changed (e.g. only a timestamp).
      if changes is null then
        return null;
      end if;
    end if;

    subj := coalesce(
      rec->>'attendee_id',
      rec->>'user_id',
      case when TG_TABLE_NAME = 'profiles' then rec->>'id' end
    );
    ev := coalesce(
      rec->>'event_id',
      case when TG_TABLE_NAME = 'events' then rec->>'id' end
    );
    req := public.activity_request();

    insert into public.activity_log
      (category, action, actor_id, subject_id, event_id, record_id, email,
       ip, user_agent, details)
    values (
      public.activity_category(TG_TABLE_NAME),
      TG_TABLE_NAME || '.' || lower(TG_OP),
      auth.uid(),
      subj::uuid,
      ev::uuid,
      coalesce(rec->>'id', rec->>'identifier'),
      rec->>'email',
      req->>'ip',
      req->>'ua',
      case when TG_OP = 'UPDATE'
        then jsonb_build_object('changes', changes, 'record', public.activity_trim(rec))
        else jsonb_build_object('record', public.activity_trim(rec))
      end
    );
  exception when others then
    raise warning 'activity log (%.%) failed: %', TG_TABLE_NAME, TG_OP, sqlerrm;
  end;
  return null;
end $$;

-- ---------- gallery trigger ----------
-- Photos are uploaded one at a time, so a batch from the same person within
-- 15 minutes is folded into one "added N photos" row instead of hundreds.

create or replace function public.log_gallery_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  act text;
  ev uuid;
  kind text;
  existing bigint;
  req jsonb;
begin
  begin
    rec := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
    -- Reordering albums rewrites every row; that folds into one row too.
    act := 'event_gallery_images.' || lower(TG_OP);
    ev := (rec->>'event_id')::uuid;
    kind := case when rec->>'media_type' = 'video' then 'videos' else 'photos' end;

    select id into existing
      from public.activity_log
     where action = act
       and event_id = ev
       and actor_id is not distinct from auth.uid()
       and created_at > now() - interval '15 minutes'
     order by id desc
     limit 1;

    if existing is not null then
      update public.activity_log
         set created_at = now(),
             details = jsonb_set(
               jsonb_set(details, '{count}',
                 to_jsonb(coalesce((details->>'count')::int, 0) + 1)),
               array[kind],
               to_jsonb(coalesce((details->>kind)::int, 0) + 1))
       where id = existing;
    else
      req := public.activity_request();
      insert into public.activity_log
        (category, action, actor_id, event_id, ip, user_agent, details)
      values (
        'content', act, auth.uid(), ev, req->>'ip', req->>'ua',
        jsonb_build_object(
          'count', 1,
          'photos', case when kind = 'photos' then 1 else 0 end,
          'videos', case when kind = 'videos' then 1 else 0 end,
          'started_at', now()
        )
      );
    end if;
  exception when others then
    raise warning 'activity log (gallery) failed: %', sqlerrm;
  end;
  return null;
end $$;

-- ---------- attach triggers ----------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'push_subscriptions',
    'registrations', 'event_invites', 'event_wristbands',
    'attendance',
    'pledges', 'reflections', 'feedback', 'qna',
    'events', 'announcements', 'speakers', 'event_program_blocks', 'event_featured'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists activity_log_trg on public.%I', t);
      execute format(
        'create trigger activity_log_trg after insert or update or delete on public.%I
           for each row execute function public.log_row_activity()', t);
    end if;
  end loop;
end $$;

drop trigger if exists activity_log_trg on public.event_gallery_images;
create trigger activity_log_trg
  after insert or update or delete on public.event_gallery_images
  for each row execute function public.log_gallery_activity();

-- ---------- backfill history (only on first run) ----------

do $$
begin
  if exists (select 1 from public.activity_log) then
    return;
  end if;

  insert into public.activity_log (created_at, category, action, subject_id, record_id, email, details)
  select created_at, 'accounts', 'profiles.insert', id, id::text, email,
         jsonb_build_object('backfilled', true, 'record', public.activity_trim(to_jsonb(p)))
    from public.profiles p;

  insert into public.activity_log (created_at, category, action, subject_id, event_id, record_id, details)
  select created_at, 'registrations', 'registrations.insert', attendee_id, event_id, id::text,
         jsonb_build_object('backfilled', true, 'record', public.activity_trim(to_jsonb(r)))
    from public.registrations r;

  insert into public.activity_log (created_at, category, action, actor_id, subject_id, event_id, record_id, details)
  select created_at, 'check-ins', 'attendance.insert', volunteer_id, attendee_id, event_id, id::text,
         jsonb_build_object('backfilled', true)
    from public.attendance;

  insert into public.activity_log (created_at, category, action, subject_id, event_id, record_id, details)
  select created_at, 'engagement', 'pledges.insert', user_id, event_id, id::text,
         jsonb_build_object('backfilled', true)
    from public.pledges;

  insert into public.activity_log (created_at, category, action, subject_id, event_id, record_id, details)
  select created_at, 'engagement', 'reflections.insert', user_id, event_id, id::text,
         jsonb_build_object('backfilled', true)
    from public.reflections;

  insert into public.activity_log (created_at, category, action, subject_id, event_id, record_id, details)
  select created_at, 'engagement', 'feedback.insert', attendee_id, event_id, id::text,
         jsonb_build_object('backfilled', true, 'record', jsonb_build_object('rating', rating))
    from public.feedback;

  insert into public.activity_log (created_at, category, action, subject_id, event_id, record_id, details)
  select created_at, 'engagement', 'qna.insert', user_id, event_id, id::text,
         jsonb_build_object('backfilled', true)
    from public.qna;

  insert into public.activity_log (created_at, category, action, event_id, record_id, details)
  select created_at, 'content', 'announcements.insert', event_id, id::text,
         jsonb_build_object('backfilled', true, 'record', public.activity_trim(to_jsonb(a)))
    from public.announcements a;

  insert into public.activity_log (created_at, category, action, event_id, record_id, details)
  select created_at, 'content', 'events.insert', id, id::text,
         jsonb_build_object('backfilled', true, 'record', jsonb_build_object('title', title))
    from public.events;

  insert into public.activity_log (created_at, category, action, event_id, details)
  select max(created_at), 'content', 'event_gallery_images.insert', event_id,
         jsonb_build_object(
           'backfilled', true,
           'count', count(*),
           'photos', count(*) filter (where media_type = 'image'),
           'videos', count(*) filter (where media_type = 'video'))
    from public.event_gallery_images
   group by event_id;
end $$;
