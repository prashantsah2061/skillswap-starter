-- Apply ONCE to a fresh development project. All application tables use RLS.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
 bio text not null default '' check (char_length(bio) <= 500),
 created_at timestamptz not null default now()
);
create table public.skills (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (char_length(btrim(name)) between 1 and 80)
);
create table public.user_skills (
 user_id uuid not null references public.profiles(id) on delete cascade,
 skill_id uuid not null references public.skills(id) on delete cascade,
 direction text not null check (direction in ('teach','learn')),
 level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
 primary key (user_id, skill_id, direction)
);
create table public.swipes (
 actor_id uuid not null references public.profiles(id) on delete cascade,
 target_id uuid not null references public.profiles(id) on delete cascade,
 decision text not null check (decision in ('like','pass')),
 created_at timestamptz not null default now(),
 primary key(actor_id,target_id),
 check(actor_id <> target_id)
);
create table public.matches (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references public.profiles(id) on delete cascade,
 user_b uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(user_a,user_b),
 -- A canonical ordering avoids both (A,B) and (B,A) being stored.
 check(user_a < user_b)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.matches(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index user_skills_skill_idx on public.user_skills(skill_id,direction);
create index swipes_target_idx on public.swipes(target_id);
create index matches_user_b_idx on public.matches(user_b);
create index messages_match_time_idx on public.messages(match_id,created_at,id);
create index messages_sender_idx on public.messages(sender_id);
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
revoke all on public.profiles,public.skills,public.user_skills,public.swipes,public.matches,public.messages from anon,authenticated;
grant usage on schema public to authenticated;
grant select,insert on public.profiles to authenticated;
grant update(display_name,bio) on public.profiles to authenticated;
grant select on public.skills to authenticated;
grant select,insert,delete on public.user_skills to authenticated;
grant update(level) on public.user_skills to authenticated;
grant select on public.swipes,public.matches to authenticated;
grant select on public.messages to authenticated;
grant insert(match_id,sender_id,body) on public.messages to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(true);
create policy profiles_insert on public.profiles for insert to authenticated with check((select auth.uid())=id);
create policy profiles_update on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy skills_read on public.skills for select to authenticated using(true);
create policy user_skills_read on public.user_skills for select to authenticated using(true);
create policy user_skills_insert on public.user_skills for insert to authenticated with check((select auth.uid())=user_id);
create policy user_skills_update on public.user_skills for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy user_skills_delete on public.user_skills for delete to authenticated using((select auth.uid())=user_id);
create policy swipes_read on public.swipes for select to authenticated using((select auth.uid())=actor_id);
create policy matches_read on public.matches for select to authenticated using((select auth.uid()) in (user_a,user_b));
create policy messages_read on public.messages for select to authenticated using(exists(select 1 from public.matches m where m.id=messages.match_id and (select auth.uid()) in (m.user_a,m.user_b)));
create policy messages_insert on public.messages for insert to authenticated with check((select auth.uid())=sender_id and exists(select 1 from public.matches m where m.id=messages.match_id and (select auth.uid()) in (m.user_a,m.user_b)));
-- Intentionally NO swipe/match write grants or policies yet.
-- Milestone 4 must add one atomic, carefully authorized matching RPC.
commit;
