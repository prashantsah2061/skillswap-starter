-- Standalone, additive migration: works even if the starter schema is not installed.
begin;
create table if not exists public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  city text not null default '' check (char_length(city) <= 80),
  bio text not null default '' check (char_length(bio) <= 500),
  created_at timestamptz not null default now()
);
alter table public.account_profiles enable row level security;
revoke all on public.account_profiles from anon, authenticated;
grant select on public.account_profiles to authenticated;
grant update (display_name, city, bio) on public.account_profiles to authenticated;

-- A revoked session must not keep reading private profiles with an old JWT.
-- Definer is used only to inspect Auth's session/factor rows; it returns a boolean.
create or replace function public.account_session_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id::text = (select auth.jwt()->>'session_id')
      and s.user_id = (select auth.uid()) and u.email_confirmed_at is not null
      and (
        (select auth.jwt()->>'aal') = 'aal2'
        or (coalesce(u.raw_app_meta_data->>'role', '') <> 'admin'
          and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'))
      )
  );
$$;
revoke all on function public.account_session_allowed() from public, anon;
grant execute on function public.account_session_allowed() to authenticated;
create policy account_profile_owner_read on public.account_profiles for select to authenticated
  using ((select auth.uid()) = user_id and (select public.account_session_allowed()));
create policy account_profile_owner_update on public.account_profiles for update to authenticated
  using ((select auth.uid()) = user_id and (select public.account_session_allowed()))
  with check ((select auth.uid()) = user_id and (select public.account_session_allowed()));

create or replace function public.ensure_my_account_profile()
returns setof public.account_profiles language plpgsql security definer set search_path = '' as $$
begin
  if not public.account_session_allowed() then raise insufficient_privilege using message = 'Unauthorized'; end if;
  insert into public.account_profiles(user_id, display_name)
  select u.id, left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
    nullif(btrim(u.raw_user_meta_data->>'username'), ''),
    nullif(split_part(u.email, '@', 1), ''), 'New user'), 80)
  from auth.users u where u.id = auth.uid()
  on conflict (user_id) do nothing; -- Preserve names edited by the user.
  return query select p.* from public.account_profiles p where p.user_id = auth.uid();
end;
$$;
revoke all on function public.ensure_my_account_profile() from public, anon;
grant execute on function public.ensure_my_account_profile() to authenticated;
commit;
