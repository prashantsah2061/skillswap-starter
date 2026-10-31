begin;
create function public.discover_members(p_after uuid default null,p_search text default '',p_city text default '',p_skill uuid default null,p_category text default null,p_learning uuid default null)
returns setof public.profiles language sql stable security invoker set search_path='' as $$
 select p.* from public.profiles p where p.id<>auth.uid() and p.visible and p.onboarded
 and (p_after is null or p.id>p_after)
 and (p.display_name ilike '%'||p_search||'%' or p.bio ilike '%'||p_search||'%') and p.city ilike '%'||p_city||'%'
 and not exists(select 1 from public.swipes s where s.actor_id=auth.uid() and s.target_id=p.id)
 and not exists(select 1 from public.matches m where auth.uid() in(m.user_a,m.user_b) and p.id in(m.user_a,m.user_b))
 and (p_skill is null or exists(select 1 from public.user_skills us where us.user_id=p.id and us.direction='teach' and us.skill_id=p_skill))
 and (p_learning is null or exists(select 1 from public.user_skills us where us.user_id=p.id and us.direction='learn' and us.skill_id=p_learning))
 and (p_category is null or exists(select 1 from public.user_skills us join public.skills sk on sk.id=us.skill_id where us.user_id=p.id and us.direction='teach' and sk.category_id=p_category))
 order by p.id limit 24;
$$;
create function public.conversation_page(p_offset integer default 0) returns table(id uuid,user_a uuid,user_b uuid,created_at timestamptz,preview text,latest_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 select m.id,m.user_a,m.user_b,m.created_at,
 (select body from public.messages where match_id=m.id order by created_at desc,id desc limit 1),
 coalesce((select max(msg.created_at) from public.messages msg where msg.match_id=m.id),m.created_at),
 (select count(*) from public.messages msg where msg.match_id=m.id and msg.sender_id<>auth.uid() and not exists(select 1 from public.conversation_reads r where r.match_id=m.id and r.user_id=auth.uid() and (msg.created_at,msg.id)<=(r.read_at,coalesce(r.last_message_id,'00000000-0000-0000-0000-000000000000'::uuid))))
 from public.matches m order by 6 desc,m.id limit 24 offset greatest(0,least(p_offset,100000));
$$;
create function public.member_counts() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('matches',(select count(*) from public.matches),'messages',(select count(*) from public.messages where sender_id=auth.uid()),'upcoming',(select count(*) from public.sessions where starts_at+make_interval(mins=>duration_minutes)>now() and status in('pending','accepted')),'completed',(select count(*) from public.sessions where status='completed'));
$$;
revoke all on function public.discover_members(uuid,text,text,uuid,text,uuid),public.conversation_page(integer),public.member_counts() from public,anon;
grant execute on function public.discover_members(uuid,text,text,uuid,text,uuid),public.conversation_page(integer),public.member_counts() to authenticated;

create function public.session_page(p_history boolean default false,p_offset integer default 0) returns setof public.sessions
language sql stable security invoker set search_path='' as $$
 select s.* from public.sessions s
 where (s.status in('pending','accepted') and s.starts_at+make_interval(mins=>s.duration_minutes)>now()) = not p_history
 order by case when not p_history then s.starts_at end asc,case when p_history then s.starts_at end desc,s.id
 limit 24 offset greatest(0,least(p_offset,100000));
$$;
revoke all on function public.session_page(boolean,integer) from public,anon;
grant execute on function public.session_page(boolean,integer) to authenticated;
commit;
