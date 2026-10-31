begin;
alter table public.account_profiles add column updated_at timestamptz not null default now();
alter table public.skills add column created_at timestamptz not null default now();
alter table public.skill_categories add column created_at timestamptz not null default now();
alter table public.user_skills add column created_at timestamptz not null default now(),add column updated_at timestamptz not null default now();
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end $$;
revoke all on function private.touch_updated_at() from public,anon,authenticated;
create trigger account_updated_at before update on public.account_profiles for each row execute function private.touch_updated_at();
create trigger user_skills_updated_at before update on public.user_skills for each row execute function private.touch_updated_at();
commit;
