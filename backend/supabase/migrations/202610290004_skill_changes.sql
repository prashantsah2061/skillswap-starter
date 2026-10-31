begin;
-- Individual catalog toggles do not overwrite stale profile text or other selections.
create function public.set_my_skill(p_skill uuid,p_direction text,p_level text default 'beginner',p_remove boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.account_session_allowed() then raise insufficient_privilege using message='Unauthorized'; end if;
 if p_direction is null or p_direction not in('teach','learn') or p_level is null or p_level not in('beginner','intermediate','advanced') or p_remove is null then raise exception 'Invalid selection'; end if;
 perform public.ensure_my_account_profile();
 -- Same lock as profile saves so batch replacement and individual changes serialize.
 perform 1 from public.account_profiles where user_id=auth.uid() for update;
 if p_remove then delete from public.user_skills where user_id=auth.uid() and skill_id=p_skill and direction=p_direction;
 else insert into public.user_skills(user_id,skill_id,direction,level) values(auth.uid(),p_skill,p_direction,p_level)
 on conflict(user_id,skill_id,direction) do update set level=excluded.level; end if;
end $$;
revoke all on function public.set_my_skill(uuid,text,text,boolean) from public,anon;
grant execute on function public.set_my_skill(uuid,text,text,boolean) to authenticated;
commit;
