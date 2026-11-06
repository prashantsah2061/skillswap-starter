-- Persist simple skill-exchange sessions and authorize every transition in SQL.
begin;

create table public.skill_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('proposed', 'confirmed', 'reschedule_requested', 'cancelled', 'completed')),
  scheduled_at timestamptz not null,
  proposed_at timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'reschedule_requested') = (proposed_at is not null))
);

create index skill_sessions_match_time_idx on public.skill_sessions(match_id, scheduled_at desc, id desc);
alter table public.skill_sessions enable row level security;
revoke all on public.skill_sessions from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.skill_sessions to authenticated;
create policy skill_sessions_member_read on public.skill_sessions for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = skill_sessions.match_id and (select auth.uid()) in (m.user_a, m.user_b)
  ) and (select public.account_session_allowed()));

create or replace function public.act_on_skill_session(
  p_action text,
  p_match_id uuid default null,
  p_session_id uuid default null,
  p_scheduled_at timestamptz default null,
  p_duration_minutes integer default null,
  p_notes text default null
) returns setof public.skill_sessions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_session public.skill_sessions%rowtype;
begin
  if v_actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if not public.consume_action_limit('session') then
    raise sqlstate 'P0001' using message = 'Action rate limit exceeded';
  end if;

  if p_action = 'propose' then
    if p_match_id is null or p_session_id is not null or p_scheduled_at is null
       or p_scheduled_at <= now() or p_duration_minutes is null
       or p_duration_minutes not between 15 and 240
       or char_length(coalesce(p_notes, '')) > 1000 then
      raise invalid_parameter_value using message = 'Invalid session proposal';
    end if;
    if not exists (
      select 1 from public.matches m where m.id = p_match_id
        and v_actor in (m.user_a, m.user_b)
        and not exists (select 1 from public.user_blocks b
          where (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
             or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
    ) then
      raise no_data_found using message = 'Match unavailable';
    end if;
    return query insert into public.skill_sessions(match_id, created_by, proposed_by, status, scheduled_at, duration_minutes, notes)
      values (p_match_id, v_actor, v_actor, 'proposed', p_scheduled_at, p_duration_minutes, btrim(coalesce(p_notes, '')))
      returning *;
    return;
  end if;

  if p_session_id is null then
    raise invalid_parameter_value using message = 'Session ID required';
  end if;
  select s.* into v_session from public.skill_sessions s where s.id = p_session_id for update;
  if not found or not exists (
    select 1 from public.matches m where m.id = v_session.match_id
      and v_actor in (m.user_a, m.user_b)
      and not exists (select 1 from public.user_blocks b
        where (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
           or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
  ) then
    raise no_data_found using message = 'Session unavailable';
  end if;

  if p_action = 'accept' then
    if v_session.proposed_by = v_actor or v_session.status not in ('proposed', 'reschedule_requested') then
      raise invalid_parameter_value using message = 'Session proposal cannot be accepted';
    end if;
    if v_session.status = 'reschedule_requested' then
      return query update public.skill_sessions s set status = 'confirmed', scheduled_at = v_session.proposed_at,
        proposed_at = null, updated_at = now()
        where s.id = p_session_id returning *;
    else
      return query update public.skill_sessions s set status = 'confirmed', updated_at = now()
        where s.id = p_session_id returning *;
    end if;
  elsif p_action = 'reschedule' then
    if v_session.status <> 'confirmed' or p_scheduled_at is null or p_scheduled_at <= now() then
      raise invalid_parameter_value using message = 'Session cannot be rescheduled';
    end if;
    return query update public.skill_sessions s set status = 'reschedule_requested', proposed_at = p_scheduled_at,
      proposed_by = v_actor, updated_at = now() where s.id = p_session_id returning *;
  elsif p_action = 'cancel' then
    if v_session.status not in ('proposed', 'confirmed', 'reschedule_requested') then
      raise invalid_parameter_value using message = 'Session cannot be cancelled';
    end if;
    return query update public.skill_sessions s set status = 'cancelled', proposed_at = null,
      updated_at = now() where s.id = p_session_id returning *;
  elsif p_action = 'complete' then
    if v_session.status <> 'confirmed' or v_session.scheduled_at > now() then
      raise invalid_parameter_value using message = 'Session is not ready to complete';
    end if;
    return query update public.skill_sessions s set status = 'completed', updated_at = now()
      where s.id = p_session_id returning *;
  else
    raise invalid_parameter_value using message = 'Unsupported session action';
  end if;
end;
$$;

revoke all on function public.act_on_skill_session(text, uuid, uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.act_on_skill_session(text, uuid, uuid, timestamptz, integer, text) to authenticated;

commit;
