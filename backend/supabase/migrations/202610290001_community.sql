begin;
-- account_profiles owns shared text. profiles contains only discovery-safe copies.
alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles add check (char_length(btrim(display_name)) between 1 and 80);
alter table public.profiles add column city text not null default '' check(length(city)<=80),
 add column visible boolean not null default false,
 add column onboarded boolean not null default false,
 add column updated_at timestamptz not null default now();
create table public.skill_categories(id text primary key, name text not null unique);
alter table public.skills add column category_id text references public.skill_categories(id) on delete restrict;
create index skills_category_idx on public.skills(category_id);
create index profiles_discovery_idx on public.profiles(id) where visible and onboarded;
create schema if not exists private;
revoke all on schema private from public;
create function private.sync_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name,city,bio) values(new.user_id,new.display_name,new.city,new.bio)
 on conflict(id) do update set display_name=excluded.display_name,city=excluded.city,bio=excluded.bio,updated_at=now();
 return new;
end $$;
revoke all on function private.sync_member() from public,anon,authenticated;
create trigger account_member_sync after insert or update on public.account_profiles for each row execute function private.sync_member();
-- Preserve private account edits; adopt existing member text only when no account exists.
insert into public.account_profiles(user_id,display_name,city,bio)
 select id,display_name,city,bio from public.profiles on conflict(user_id) do nothing;
insert into public.profiles(id,display_name,city,bio)
 select user_id,display_name,city,bio from public.account_profiles
 on conflict(id) do update set display_name=excluded.display_name,city=excluded.city,bio=excluded.bio;
-- Existing account ensure now also repairs a missing discoverable member.
create or replace function public.ensure_my_account_profile() returns setof public.account_profiles
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 insert into public.account_profiles(user_id,display_name)
 select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),'New member'),80)
 from auth.users where id=auth.uid() on conflict(user_id) do nothing;
 insert into public.profiles(id,display_name,city,bio) select user_id,display_name,city,bio from public.account_profiles where user_id=auth.uid() on conflict(id) do nothing;
 return query select * from public.account_profiles where user_id=auth.uid();
end $$;
revoke insert,update on public.profiles from authenticated;
revoke update(display_name,bio) on public.profiles from authenticated;
-- Restrictive policies preserve confirmed email, revocation and MFA on EVERY data table.
do $$ declare t text; begin
 foreach t in array array['profiles','skills','user_skills','swipes','matches','messages','skill_categories'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy active_session on public.%I as restrictive for all to authenticated using ((select public.account_session_allowed())) with check ((select public.account_session_allowed()))',t);
 end loop;
end $$;
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or (visible and onboarded) or exists(select 1 from public.matches m where (select auth.uid()) in(m.user_a,m.user_b) and profiles.id in(m.user_a,m.user_b)));
drop policy user_skills_read on public.user_skills;
create policy user_skills_read on public.user_skills for select to authenticated using(exists(select 1 from public.profiles p where p.id=user_skills.user_id));
revoke all on public.skill_categories from anon,authenticated;
grant select on public.skill_categories to authenticated;
create policy categories_read on public.skill_categories for select to authenticated using(true);
-- Atomic profile + skills save; IDs, levels, duplicates enforced in DB.
create function public.save_member(p_name text,p_city text,p_bio text,p_visible boolean,p_skills jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 perform public.ensure_my_account_profile();
 if p_skills is null or jsonb_typeof(p_skills)<>'array' or jsonb_array_length(p_skills)>100 then raise exception 'Invalid skill selections'; end if;
 update public.account_profiles set display_name=btrim(p_name),city=btrim(p_city),bio=btrim(p_bio) where user_id=auth.uid();
 delete from public.user_skills where user_id=auth.uid();
 insert into public.user_skills(user_id,skill_id,direction,level)
 select auth.uid(),x.skill_id,x.direction,x.level from jsonb_to_recordset(p_skills) as x(skill_id uuid,direction text,level text);
 update public.profiles set visible=p_visible,onboarded=true,updated_at=now() where id=auth.uid();
end $$;
-- Lock both members in canonical order: reciprocal decisions serialize even on first swipe.
create function public.record_swipe(p_target uuid,p_decision text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_target=auth.uid() or p_decision not in('like','pass') or p_decision is null then raise exception 'Invalid decision'; end if;
 perform id from public.profiles where id in(auth.uid(),p_target) order by id for update;
 if not exists(select 1 from public.profiles where id=p_target and visible and onboarded) then raise exception 'Member unavailable'; end if;
 insert into public.swipes(actor_id,target_id,decision) values(auth.uid(),p_target,p_decision)
 on conflict(actor_id,target_id) do update set decision=excluded.decision,created_at=now();
 if p_decision='like' and exists(select 1 from public.swipes where actor_id=p_target and target_id=auth.uid() and decision='like') then
 insert into public.matches(user_a,user_b) values(least(auth.uid(),p_target),greatest(auth.uid(),p_target)) on conflict(user_a,user_b) do nothing;
 end if;
 select id into result from public.matches where user_a=least(auth.uid(),p_target) and user_b=greatest(auth.uid(),p_target);
 return result;
end $$;
-- Preserve legacy rows while enforcing full whitespace/length checks on new writes.
alter table public.messages add constraint messages_nonblank check (body ~ '[^[:space:]]' and length(body)<=2000) not valid;
-- Retry IDs are supplied once per send. Messages cannot be modified after sending.
revoke insert on public.messages from authenticated;
revoke insert(match_id,sender_id,body) on public.messages from authenticated;
create function public.send_message(p_match uuid,p_id uuid,p_body text) returns public.messages
language plpgsql security definer set search_path='' as $$
declare result public.messages; begin
 if not public.account_session_allowed() or not exists(select 1 from public.matches where id=p_match and auth.uid() in(user_a,user_b)) then raise insufficient_privilege using message='Unauthorized'; end if;
 insert into public.messages(id,match_id,sender_id,body) values(p_id,p_match,auth.uid(),btrim(p_body)) on conflict(id) do nothing;
 select * into result from public.messages where id=p_id and match_id=p_match and sender_id=auth.uid() and body=btrim(p_body);
 if result.id is null then raise exception 'Retry ID conflicts with another message'; end if;
 return result;
end $$;
create table public.conversation_reads(
 match_id uuid references public.matches(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade,
 read_at timestamptz not null, last_message_id uuid references public.messages(id) on delete set null,primary key(match_id,user_id));
create index conversation_reads_message_idx on public.conversation_reads(last_message_id);
create index conversation_reads_user_idx on public.conversation_reads(user_id);
alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon,authenticated;
grant select on public.conversation_reads to authenticated;
create policy reads_own on public.conversation_reads for select to authenticated using(user_id=(select auth.uid()) and (select public.account_session_allowed()));
create function public.mark_read(p_match uuid,p_message uuid) returns void language plpgsql security definer set search_path='' as $$
declare through_at timestamptz; begin
 if not public.account_session_allowed() or not exists(select 1 from public.matches where id=p_match and auth.uid() in(user_a,user_b)) then raise insufficient_privilege using message='Unauthorized'; end if;
 select created_at into through_at from public.messages where id=p_message and match_id=p_match;
 if through_at is null then raise exception 'Message unavailable'; end if;
 insert into public.conversation_reads(match_id,user_id,read_at,last_message_id) values(p_match,auth.uid(),through_at,p_message)
 on conflict(match_id,user_id) do update set read_at=excluded.read_at,last_message_id=excluded.last_message_id
 where (excluded.read_at,excluded.last_message_id)>(public.conversation_reads.read_at,coalesce(public.conversation_reads.last_message_id,'00000000-0000-0000-0000-000000000000'::uuid));
end $$;
create table public.sessions(
 id uuid primary key default gen_random_uuid(),match_id uuid not null references public.matches(id) on delete cascade,
 proposer_id uuid not null references public.profiles(id) on delete cascade,
 topic text not null check(length(btrim(topic)) between 1 and 160 and topic ~ '[^[:space:]]'),
 starts_at timestamptz not null check(isfinite(starts_at)),duration_minutes integer not null check(duration_minutes between 1 and 480),
 notes text not null default '' check(length(notes)<=2000),
 meeting_url text not null default '' check(meeting_url='' or (length(meeting_url)<=2000 and meeting_url ~ '^https://[^[:space:]]+$')),
 status text not null default 'pending' check(status in('pending','accepted','declined','cancelled','completed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index sessions_match_idx on public.sessions(match_id,starts_at);
create index sessions_proposer_idx on public.sessions(proposer_id);
alter table public.sessions enable row level security;
revoke all on public.sessions from anon,authenticated;
grant select on public.sessions to authenticated;
create policy sessions_participant on public.sessions for select to authenticated using((select public.account_session_allowed()) and exists(select 1 from public.matches m where m.id=sessions.match_id and (select auth.uid()) in(m.user_a,m.user_b)));
create function public.propose_session(p_id uuid,p_match uuid,p_topic text,p_start timestamptz,p_duration integer,p_notes text,p_url text) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() or not exists(select 1 from public.matches where id=p_match and auth.uid() in(user_a,user_b)) then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_start<=now() then raise exception 'Choose a future start time'; end if;
 insert into public.sessions(id,match_id,proposer_id,topic,starts_at,duration_minutes,notes,meeting_url)
 values(p_id,p_match,auth.uid(),btrim(p_topic),p_start,p_duration,p_notes,p_url) on conflict(id) do nothing;
 if not exists(select 1 from public.sessions where id=p_id and proposer_id=auth.uid() and match_id=p_match and topic=btrim(p_topic) and starts_at=p_start and duration_minutes=p_duration and notes=p_notes and meeting_url=p_url) then raise exception 'Retry ID conflict'; end if;
 return p_id;
end $$;
create function public.transition_session(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare s public.sessions; m public.matches; begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 select * into s from public.sessions where id=p_id;
 select * into m from public.matches where id=s.match_id and auth.uid() in(user_a,user_b);
 if m.id is null then raise insufficient_privilege using message='Unauthorized'; end if;
 -- Shared member locks serialize overlapping acceptances across DIFFERENT matches.
 perform id from public.profiles where id in(m.user_a,m.user_b) order by id for update;
 select * into s from public.sessions where id=p_id for update;
 if s.status=p_status then return; end if;
 if not ((s.status='pending' and p_status in('accepted','declined') and auth.uid()<>s.proposer_id)
 or (s.status in('pending','accepted') and p_status='cancelled')
 or (s.status='accepted' and p_status='completed' and s.starts_at+make_interval(mins=>s.duration_minutes)<=now())) then raise exception 'Invalid session transition'; end if;
 if p_status='accepted' then
 if s.starts_at<=now() then raise exception 'Session start has passed'; end if;
 if exists(select 1 from public.sessions other join public.matches om on om.id=other.match_id
 where other.status='accepted' and other.id<>s.id and (om.user_a in(m.user_a,m.user_b) or om.user_b in(m.user_a,m.user_b))
 and tstzrange(other.starts_at,other.starts_at+make_interval(mins=>other.duration_minutes),'[)') && tstzrange(s.starts_at,s.starts_at+make_interval(mins=>s.duration_minutes),'[)')) then raise exception 'An accepted booking overlaps for a participant'; end if;
 end if;
 update public.sessions set status=p_status,updated_at=now() where id=p_id;
end $$;
-- New functions default to PUBLIC execution: explicitly close every mutation.
revoke all on function public.save_member(text,text,text,boolean,jsonb),public.record_swipe(uuid,text),public.send_message(uuid,uuid,text),public.mark_read(uuid,uuid),public.propose_session(uuid,uuid,text,timestamptz,integer,text,text),public.transition_session(uuid,text) from public,anon;
grant execute on function public.save_member(text,text,text,boolean,jsonb),public.record_swipe(uuid,text),public.send_message(uuid,uuid,text),public.mark_read(uuid,uuid),public.propose_session(uuid,uuid,text,timestamptz,integer,text,text),public.transition_session(uuid,text) to authenticated;
commit;
