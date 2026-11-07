-- Add optional discovery context and tighten public reads without exposing
-- unfinished, suspended, or mutually blocked profiles.
begin;

-- Keep application-side discovery exclusions complete even when the project
-- Data API row limit is lower than a user's number of block relationships.
create or replace function public.get_hidden_user_ids_page(p_offset integer, p_limit integer)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_offset is null or p_offset < 0 or p_offset > 100000
     or p_limit is null or p_limit not between 1 and 500 then
    raise invalid_parameter_value using message = 'Invalid hidden-user page';
  end if;
  if auth.uid() is null or not public.account_session_allowed() then return; end if;
  return query
    select hidden.user_id from public.get_hidden_user_ids() hidden
    order by hidden.user_id offset p_offset limit p_limit;
end;
$$;
revoke all on function public.get_hidden_user_ids_page(integer, integer) from public, anon, authenticated;
grant execute on function public.get_hidden_user_ids_page(integer, integer) to authenticated;

alter table public.profiles
  add column if not exists meeting_preference text
    check (meeting_preference in ('online', 'in_person', 'either')),
  add column if not exists suspended_at timestamptz;
alter table public.user_skills
  add column if not exists goal_level text
    check (goal_level in ('beginner', 'intermediate', 'advanced'));

grant update(meeting_preference) on public.profiles to authenticated;
grant update(goal_level) on public.user_skills to authenticated;

-- These app-specific session policies are permissive. Remove them if a
-- previous dashboard/manual setup added them; the scoped policies below remain.
drop policy if exists active_session on public.profiles;
drop policy if exists active_session on public.skills;
drop policy if exists active_session on public.user_skills;
drop policy if exists active_session on public.swipes;
drop policy if exists active_session on public.matches;
drop policy if exists active_session on public.messages;
drop policy if exists active_session on public.user_blocks;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
using ((select public.account_session_allowed()) and (
    id = (select auth.uid()) or (
    visible and onboarded and suspended_at is null and not exists (
      select 1 from public.get_hidden_user_ids() hidden where hidden.user_id = profiles.id
    )
  )
));

drop policy if exists user_skills_read on public.user_skills;
create policy user_skills_read on public.user_skills for select to authenticated
using ((select public.account_session_allowed()) and (
  user_id = (select auth.uid()) or exists (
    select 1 from public.profiles p where p.id = user_skills.user_id
      and p.visible and p.onboarded and p.suspended_at is null
      and not exists (select 1 from public.get_hidden_user_ids() hidden where hidden.user_id = p.id)
  )
));

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated
using ((select public.account_session_allowed()) and (select auth.uid()) in (user_a, user_b)
  and not exists (select 1 from public.get_hidden_user_ids() hidden
    where hidden.user_id = case when (select auth.uid()) = matches.user_a then matches.user_b else matches.user_a end));

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
using ((select public.account_session_allowed()) and exists (
  select 1 from public.matches m where m.id = messages.match_id
    and (select auth.uid()) in (m.user_a, m.user_b)
    and not exists (select 1 from public.get_hidden_user_ids() hidden
      where hidden.user_id = case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end)
));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
with check ((select auth.uid()) = sender_id and (select public.account_session_allowed()) and exists (
  select 1 from public.matches m where m.id = messages.match_id
    and (select auth.uid()) in (m.user_a, m.user_b)
    and not exists (select 1 from public.get_hidden_user_ids() hidden
      where hidden.user_id = case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end)
));

-- The first decision wins except that the actor may intentionally revisit a
-- skipped profile and upgrade pass to like. Likes and retries stay idempotent.
create or replace function public.record_swipe(p_target_id uuid, p_decision text)
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
  if v_actor is null or not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if p_target_id is null or p_decision is null or p_decision not in ('like', 'pass') then
    raise invalid_parameter_value using message = 'Invalid swipe';
  end if;
  if not public.consume_action_limit('swipe') then
    raise sqlstate 'P0001' using message = 'Action rate limit exceeded';
  end if;
  if v_actor = p_target_id then raise invalid_parameter_value using message = 'Cannot swipe on yourself'; end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id = v_actor and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = v_actor)) then
    raise no_data_found using message = 'Profile unavailable';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.visible and p.onboarded and p.suspended_at is null)
     or not exists (select 1 from public.profiles p where p.id = p_target_id and p.visible and p.onboarded and p.suspended_at is null) then
    raise no_data_found using message = 'Profile unavailable';
  end if;

  v_low := least(v_actor, p_target_id);
  v_high := greatest(v_actor, p_target_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_low::text || ':' || v_high::text, 0));

  insert into public.swipes(actor_id, target_id, decision)
  values (v_actor, p_target_id, p_decision)
  on conflict (actor_id, target_id) do update set decision = 'like'
    where public.swipes.decision = 'pass' and excluded.decision = 'like';

  select s.decision into v_stored_decision from public.swipes s
  where s.actor_id = v_actor and s.target_id = p_target_id;
  if v_stored_decision = 'like' then
    select s.decision into v_reverse_decision from public.swipes s
    where s.actor_id = p_target_id and s.target_id = v_actor;
    if v_reverse_decision = 'like' then
      insert into public.matches(user_a, user_b) values (v_low, v_high)
      on conflict (user_a, user_b) do nothing returning id into v_match_id;
      if v_match_id is null then
        select m.id into v_match_id from public.matches m where m.user_a = v_low and m.user_b = v_high;
      end if;
    end if;
  end if;
  return query select v_match_id is not null, v_match_id;
end;
$$;

revoke all on function public.record_swipe(uuid, text) from public, anon, authenticated;
grant execute on function public.record_swipe(uuid, text) to authenticated;

commit;
