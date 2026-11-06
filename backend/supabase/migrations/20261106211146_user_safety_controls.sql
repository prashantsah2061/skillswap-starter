-- Blocking, member reports, and discovery/conversation enforcement.
begin;

create or replace function public.get_hidden_user_ids()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id from public.user_blocks b
  where b.blocker_id = (select auth.uid()) and (select public.account_session_allowed())
  union
  select b.blocker_id from public.user_blocks b
  where b.blocked_id = (select auth.uid()) and (select public.account_session_allowed());
$$;
revoke all on function public.get_hidden_user_ids() from public, anon, authenticated;
grant execute on function public.get_hidden_user_ids() to authenticated;

create or replace function public.get_my_blocked_profiles()
returns table (user_id uuid, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.display_name, b.created_at
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid()) and (select public.account_session_allowed())
  order by b.created_at desc, b.blocked_id;
$$;
revoke all on function public.get_my_blocked_profiles() from public, anon, authenticated;
grant execute on function public.get_my_blocked_profiles() to authenticated;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe', 'impersonation', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index user_reports_reported_time_idx on public.user_reports(reported_id, created_at desc);
alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon, authenticated;
grant select, insert on public.user_reports to authenticated;
create policy user_reports_insert_own on public.user_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid()) and reporter_id <> reported_id
    and (select public.account_session_allowed())
    and (match_id is null or exists (
      select 1 from public.matches m where m.id = user_reports.match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
        and user_reports.reported_id in (m.user_a, m.user_b)
    ))
  );
create policy user_reports_reporter_or_admin_read on public.user_reports for select to authenticated
  using (
    (reporter_id = (select auth.uid()) and (select public.account_session_allowed()))
    or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' and (select public.account_session_allowed()))
  );

-- The database owns the daily report quota, including direct Data API inserts.
create or replace function public.limit_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.account_session_allowed() then
    raise insufficient_privilege using message = 'Verified session required';
  end if;
  if not public.consume_action_limit('report') then
    raise sqlstate 'P0001' using message = 'Action rate limit exceeded';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_report_rate() from public, anon, authenticated;
create trigger user_reports_action_rate_limit
before insert on public.user_reports
for each row execute function public.limit_report_rate();

-- A block removes both members from each other's visible member data and conversations.
alter policy profiles_read on public.profiles
  using ((select public.account_session_allowed()) and not exists (
    select 1 from public.get_hidden_user_ids() hidden where hidden.user_id = profiles.id
  ));
alter policy user_skills_read on public.user_skills
  using ((select public.account_session_allowed()) and not exists (
    select 1 from public.get_hidden_user_ids() hidden where hidden.user_id = user_skills.user_id
  ));
alter policy matches_read on public.matches
  using ((select auth.uid()) in (user_a, user_b) and (select public.account_session_allowed()) and not exists (
    select 1 from public.get_hidden_user_ids() hidden
    where hidden.user_id = case when (select auth.uid()) = matches.user_a then matches.user_b else matches.user_a end
  ));
alter policy messages_read on public.messages
  using ((select public.account_session_allowed()) and exists (
    select 1 from public.matches m where m.id = messages.match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
      and not exists (select 1 from public.get_hidden_user_ids() hidden
        where hidden.user_id = case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end)
  ));
alter policy messages_insert on public.messages
  with check ((select auth.uid()) = sender_id and (select public.account_session_allowed()) and exists (
    select 1 from public.matches m where m.id = messages.match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
      and not exists (select 1 from public.get_hidden_user_ids() hidden
        where hidden.user_id = case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end)
  ));
alter policy skill_sessions_member_read on public.skill_sessions
  using ((select public.account_session_allowed()) and exists (
    select 1 from public.matches m where m.id = skill_sessions.match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
      and not exists (select 1 from public.get_hidden_user_ids() hidden
        where hidden.user_id = case when (select auth.uid()) = m.user_a then m.user_b else m.user_a end)
  ));

-- Extend the internal database-enforced daily quota list for reports.
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
  elsif p_action in ('session', 'report') then
    v_window := date_trunc('day', now());
    v_limit := case p_action when 'session' then 10 else 5 end;
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

commit;
