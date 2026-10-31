-- Additive: real member identity, pictures, and profile completion.
-- Requires Supabase's storage schema. Deletes no rows.
begin;
alter table public.account_profiles
 add column email text,
 add column username text check(username ~ '^[a-z0-9_]{3,30}$'),
 add column avatar_path text check(avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
 add column provider_avatar_url text check(provider_avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/[^[:space:]]+$');
-- Email stays in account_profiles, which only its owner can read.
alter table public.profiles
 add column username text,
 add column avatar_path text,
 add column provider_avatar_url text;
create unique index account_profiles_username_idx on public.account_profiles(lower(username)) where username is not null;
create unique index profiles_username_idx on public.profiles(lower(username)) where username is not null;
-- Skill changes go through RPCs so completion can never go stale.
revoke insert,update,delete on public.user_skills from authenticated;

create function private.member_complete(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.account_profiles a where a.user_id=p_user and btrim(a.display_name)<>'' and btrim(a.bio)<>'')
 and exists(select 1 from public.user_skills s where s.user_id=p_user and s.direction='teach')
 and exists(select 1 from public.user_skills s where s.user_id=p_user and s.direction='learn');
$$;
revoke all on function private.member_complete(uuid) from public,anon,authenticated;

create or replace function private.sync_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name,city,bio,username,avatar_path,provider_avatar_url)
 values(new.user_id,new.display_name,new.city,new.bio,new.username,new.avatar_path,new.provider_avatar_url)
 on conflict(id) do update set display_name=excluded.display_name,city=excluded.city,bio=excluded.bio,username=excluded.username,avatar_path=excluded.avatar_path,provider_avatar_url=excluded.provider_avatar_url,updated_at=now();
 update public.profiles set onboarded=private.member_complete(new.user_id) where id=new.user_id;
 return new;
end $$;

-- Metadata is editable by its user, so only a Google-hosted picture is accepted.
create function private.provider_picture(p_meta jsonb) returns text language sql immutable set search_path='' as $$
 select v from unnest(array[p_meta->>'avatar_url',p_meta->>'picture']) v
 where v ~ '^https://[a-z0-9-]+\.googleusercontent\.com/[^[:space:]]+$' limit 1;
$$;
revoke all on function private.provider_picture(jsonb) from public,anon,authenticated;

create or replace function public.ensure_my_account_profile() returns setof public.account_profiles
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 -- Conflict keeps everything a returning member customized, including a removed picture.
 insert into public.account_profiles(user_id,display_name,email,provider_avatar_url)
 select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),'New member'),80),email,private.provider_picture(raw_user_meta_data)
 from auth.users where id=auth.uid() on conflict(user_id) do nothing;
 update public.account_profiles a set email=u.email from auth.users u where a.user_id=auth.uid() and u.id=a.user_id and a.email is distinct from u.email;
 insert into public.profiles(id,display_name,city,bio,username,avatar_path,provider_avatar_url)
 select user_id,display_name,city,bio,username,avatar_path,provider_avatar_url from public.account_profiles where user_id=auth.uid() on conflict(id) do nothing;
 return query select * from public.account_profiles where user_id=auth.uid();
end $$;

drop function public.save_member(text,text,text,boolean,jsonb);
-- p_username: null keeps the current value, '' clears it.
create function public.save_member(p_name text,p_city text,p_bio text,p_visible boolean,p_skills jsonb,p_username text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 perform public.ensure_my_account_profile();
 if p_skills is null or jsonb_typeof(p_skills)<>'array' or jsonb_array_length(p_skills)>100 then raise exception 'Invalid skill selections'; end if;
 begin
  update public.account_profiles set display_name=btrim(p_name),city=btrim(p_city),bio=btrim(p_bio),
   username=case when p_username is null then username else nullif(lower(btrim(p_username)),'') end
  where user_id=auth.uid();
 exception when unique_violation then raise exception 'That username is already taken';
 end;
 delete from public.user_skills where user_id=auth.uid();
 insert into public.user_skills(user_id,skill_id,direction,level)
 select auth.uid(),x.skill_id,x.direction,x.level from jsonb_to_recordset(p_skills) as x(skill_id uuid,direction text,level text);
 update public.profiles set visible=p_visible,onboarded=private.member_complete(auth.uid()),updated_at=now() where id=auth.uid();
end $$;

create or replace function public.set_my_skill(p_skill uuid,p_direction text,p_level text default 'beginner',p_remove boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_direction is null or p_direction not in('teach','learn') or p_level is null or p_level not in('beginner','intermediate','advanced') or p_remove is null then raise exception 'Invalid selection'; end if;
 perform public.ensure_my_account_profile();
 perform 1 from public.account_profiles where user_id=auth.uid() for update;
 if p_remove then delete from public.user_skills where user_id=auth.uid() and skill_id=p_skill and direction=p_direction;
 else insert into public.user_skills(user_id,skill_id,direction,level) values(auth.uid(),p_skill,p_direction,p_level)
 on conflict(user_id,skill_id,direction) do update set level=excluded.level; end if;
 update public.profiles set onboarded=private.member_complete(auth.uid()) where id=auth.uid();
end $$;

-- Incomplete members can't like anyone: nobody could discover them to like back.
create or replace function public.record_swipe(p_target uuid,p_decision text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_target=auth.uid() or p_decision not in('like','pass') or p_decision is null then raise exception 'Invalid decision'; end if;
 perform id from public.profiles where id in(auth.uid(),p_target) order by id for update;
 if not exists(select 1 from public.profiles where id=auth.uid() and onboarded) then raise exception 'Complete your profile first'; end if;
 if not exists(select 1 from public.profiles where id=p_target and visible and onboarded) then raise exception 'Member unavailable'; end if;
 insert into public.swipes(actor_id,target_id,decision) values(auth.uid(),p_target,p_decision)
 on conflict(actor_id,target_id) do update set decision=excluded.decision,created_at=now();
 if p_decision='like' and exists(select 1 from public.swipes where actor_id=p_target and target_id=auth.uid() and decision='like') then
 insert into public.matches(user_a,user_b) values(least(auth.uid(),p_target),greatest(auth.uid(),p_target)) on conflict(user_a,user_b) do nothing;
 end if;
 select id into result from public.matches where user_a=least(auth.uid(),p_target) and user_b=greatest(auth.uid(),p_target);
 return result;
end $$;

-- A null path removes the picture, including an inherited Google one. Returns the
-- previous storage path so the caller can delete that file.
create function public.set_my_avatar(p_path text) returns text
language plpgsql security definer set search_path='' as $$
declare previous text; begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_path is not null and not (split_part(p_path,'/',1)=auth.uid()::text
   and exists(select 1 from storage.objects o where o.bucket_id='avatars' and o.name=p_path and o.owner_id=auth.uid()::text)) then
  raise exception 'Invalid picture';
 end if;
 perform public.ensure_my_account_profile();
 select avatar_path into previous from public.account_profiles where user_id=auth.uid() for update;
 update public.account_profiles set avatar_path=p_path,provider_avatar_url=null where user_id=auth.uid();
 return previous;
end $$;
revoke all on function public.save_member(text,text,text,boolean,jsonb,text),public.set_my_avatar(text) from public,anon;
grant execute on function public.save_member(text,text,text,boolean,jsonb,text),public.set_my_avatar(text) to authenticated;

-- Existing members: fill new fields; never replace anything they have set.
update public.account_profiles a set email=u.email,provider_avatar_url=private.provider_picture(u.raw_user_meta_data)
 from auth.users u where u.id=a.user_id;
update public.profiles p set onboarded=private.member_complete(p.id);

-- Readable by URL (random file names); only the owner can list, add, or delete.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy avatars_owner_insert on storage.objects for insert to authenticated with check(
 bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and (select public.account_session_allowed()));
create policy avatars_owner_read on storage.objects for select to authenticated using(
 bucket_id='avatars' and owner_id=(select auth.uid())::text and (select public.account_session_allowed()));
create policy avatars_owner_delete on storage.objects for delete to authenticated using(
 bucket_id='avatars' and owner_id=(select auth.uid())::text and (select public.account_session_allowed()));
commit;
