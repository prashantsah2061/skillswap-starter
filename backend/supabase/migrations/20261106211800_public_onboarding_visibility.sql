-- Publish profiles only after their owner saves both sides of a skill exchange.
begin;

alter table public.profiles
  add column if not exists visible boolean not null default false,
  add column if not exists onboarded boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.publish_my_public_profile()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_actor) then
    raise no_data_found using message = 'Save your public profile first';
  end if;
  if not exists (select 1 from public.user_skills s where s.user_id = v_actor and s.direction = 'teach')
     or not exists (select 1 from public.user_skills s where s.user_id = v_actor and s.direction = 'learn') then
    raise invalid_parameter_value using message = 'Choose at least one skill to teach and one to learn';
  end if;

  update public.profiles
  set visible = true, onboarded = true, updated_at = now()
  where id = v_actor;
  return true;
end;
$$;
revoke all on function public.publish_my_public_profile() from public, anon, authenticated;
grant execute on function public.publish_my_public_profile() to authenticated;

-- Swipe RPCs also enforce publication, even when called outside the app UI.
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
  if not exists (select 1 from public.profiles p where p.id = v_actor and p.visible and p.onboarded)
     or not exists (select 1 from public.profiles p where p.id = p_target_id and p.visible and p.onboarded) then
    raise no_data_found using message = 'Profile unavailable';
  end if;

  v_low := least(v_actor, p_target_id);
  v_high := greatest(v_actor, p_target_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_low::text || ':' || v_high::text, 0)
  );

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

commit;
