-- Atomic, immutable swipe decisions and one canonical match per reciprocal pair.
begin;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks(blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy user_blocks_own_read on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()) and (select public.account_session_allowed()));
create policy user_blocks_own_insert on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id and (select public.account_session_allowed()));
create policy user_blocks_own_delete on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()) and (select public.account_session_allowed()));

-- Keep direct Data API access aligned with the app's confirmed-session and MFA checks.
alter policy profiles_read on public.profiles
  using ((select public.account_session_allowed()));
alter policy profiles_insert on public.profiles
  with check ((select auth.uid()) = id and (select public.account_session_allowed()));
alter policy profiles_update on public.profiles
  using ((select auth.uid()) = id and (select public.account_session_allowed()))
  with check ((select auth.uid()) = id and (select public.account_session_allowed()));
alter policy skills_read on public.skills
  using ((select public.account_session_allowed()));
alter policy user_skills_read on public.user_skills
  using ((select public.account_session_allowed()));
alter policy user_skills_insert on public.user_skills
  with check ((select auth.uid()) = user_id and (select public.account_session_allowed()));
alter policy user_skills_update on public.user_skills
  using ((select auth.uid()) = user_id and (select public.account_session_allowed()))
  with check ((select auth.uid()) = user_id and (select public.account_session_allowed()));
alter policy user_skills_delete on public.user_skills
  using ((select auth.uid()) = user_id and (select public.account_session_allowed()));
alter policy swipes_read on public.swipes
  using ((select auth.uid()) = actor_id and (select public.account_session_allowed()));
alter policy matches_read on public.matches
  using ((select auth.uid()) in (user_a, user_b) and (select public.account_session_allowed()));
alter policy messages_read on public.messages
  using ((select public.account_session_allowed()) and exists (
    select 1 from public.matches m where m.id = messages.match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
  ));
alter policy messages_insert on public.messages
  with check ((select auth.uid()) = sender_id and (select public.account_session_allowed()) and exists (
    select 1 from public.matches m where m.id = messages.match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
  ));

-- Small database-backed counters keep API rate limits consistent across app instances.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table app_private.action_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action)
);
revoke all on app_private.action_rate_limits from public, anon, authenticated;

create or replace function public.consume_action_limit(p_action text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_window timestamptz;
  v_limit integer;
  v_count integer;
begin
  if v_actor is null or not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if p_action in ('swipe', 'message') then
    v_window := date_trunc('minute', now());
    v_limit := case p_action when 'swipe' then 60 else 20 end;
  elsif p_action = 'session' then
    v_window := date_trunc('day', now());
    v_limit := 10;
  else
    raise invalid_parameter_value using message = 'Unsupported rate limit action';
  end if;

  insert into app_private.action_rate_limits(user_id, action, window_start, request_count)
  values (v_actor, p_action, v_window, 1)
  on conflict (user_id, action) do update
    set window_start = excluded.window_start,
        request_count = case
          when app_private.action_rate_limits.window_start = excluded.window_start
            then app_private.action_rate_limits.request_count + 1
          else 1
        end
  returning request_count into v_count;
  return v_count <= v_limit;
end;
$$;
revoke all on function public.consume_action_limit(text) from public, anon, authenticated;

-- A previous manual setup used the same arguments with a different return type.
drop function if exists public.record_swipe(uuid, text);

create function public.record_swipe(p_target_id uuid, p_decision text)
returns table (matched boolean, match_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_low uuid;
  v_high uuid;
  v_stored_decision text;
  v_reverse_decision text;
  v_match_id uuid;
begin
  if v_actor is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if p_target_id is null or p_decision is null or p_decision not in ('like', 'pass') then
    raise invalid_parameter_value using message = 'Invalid swipe';
  end if;
  if not public.consume_action_limit('swipe') then
    raise sqlstate 'P0001' using message = 'Action rate limit exceeded';
  end if;
  if v_actor = p_target_id then
    raise invalid_parameter_value using message = 'Cannot swipe on yourself';
  end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id = v_actor and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = v_actor)) then
    raise no_data_found using message = 'Profile unavailable';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor)
     or not exists (select 1 from public.profiles p where p.id = p_target_id) then
    raise no_data_found using message = 'Profile unavailable';
  end if;

  v_low := least(v_actor, p_target_id);
  v_high := greatest(v_actor, p_target_id);
  -- Both directions use one transaction-scoped lock before reading either swipe.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_low::text || ':' || v_high::text, 0)
  );

  -- The first decision wins. Replays are idempotent and cannot silently undo a match.
  insert into public.swipes(actor_id, target_id, decision)
  values (v_actor, p_target_id, p_decision)
  on conflict (actor_id, target_id) do nothing;

  select s.decision into v_stored_decision
  from public.swipes s where s.actor_id = v_actor and s.target_id = p_target_id;

  if v_stored_decision = 'like' then
    select s.decision into v_reverse_decision
    from public.swipes s where s.actor_id = p_target_id and s.target_id = v_actor;

    if v_reverse_decision = 'like' then
      insert into public.matches(user_a, user_b)
      values (v_low, v_high)
      on conflict (user_a, user_b) do nothing
      returning id into v_match_id;

      if v_match_id is null then
        select m.id into v_match_id from public.matches m
        where m.user_a = v_low and m.user_b = v_high;
      end if;
    end if;
  end if;

  return query select v_match_id is not null, v_match_id;
end;
$$;

revoke all on function public.record_swipe(uuid, text) from public, anon, authenticated;
grant execute on function public.record_swipe(uuid, text) to authenticated;

-- Direct table inserts are also rate limited, not only requests through the app API.
create or replace function public.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if not public.consume_action_limit('message') then
    raise sqlstate 'P0001' using message = 'Action rate limit exceeded';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_message_rate() from public, anon, authenticated;
create trigger messages_action_rate_limit
before insert on public.messages
for each row execute function public.limit_message_rate();

create or replace function public.send_match_message(p_match_id uuid, p_body text)
returns table (id uuid, match_id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_message public.messages%rowtype;
begin
  if v_actor is null or not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if p_match_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise invalid_parameter_value using message = 'Invalid message';
  end if;
  if not exists (select 1 from public.matches m where m.id = p_match_id and v_actor in (m.user_a, m.user_b)
    and not exists (select 1 from public.user_blocks b
      where (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
         or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))) then
    raise no_data_found using message = 'Match unavailable';
  end if;
  insert into public.messages(match_id, sender_id, body)
  values (p_match_id, v_actor, btrim(p_body)) returning * into v_message;
  return query select v_message.id, v_message.match_id, v_message.sender_id, v_message.body, v_message.created_at;
end;
$$;
revoke all on function public.send_match_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_match_message(uuid, text) to authenticated;

commit;
