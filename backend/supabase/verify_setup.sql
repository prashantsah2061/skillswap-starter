-- Read-only checks for Supabase SQL Editor after applying the migrations.
with expected(table_name) as (
  values ('account_profiles'), ('profiles'), ('skills'), ('user_skills'),
         ('swipes'), ('matches'), ('messages'), ('skill_sessions'), ('user_blocks'), ('user_reports')
)
select expected.table_name,
       to_regclass('public.' || expected.table_name) is not null as table_exists,
       coalesce(class.relrowsecurity, false) as rls_enabled
from expected
left join pg_class class on class.oid = to_regclass('public.' || expected.table_name)
order by expected.table_name;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('account_profiles', 'profiles', 'skills', 'user_skills', 'swipes', 'matches', 'messages', 'skill_sessions', 'user_blocks', 'user_reports')
order by tablename, policyname;

select name from public.skills order by name;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in ('ensure_my_account_profile', 'record_swipe', 'send_match_message', 'act_on_skill_session', 'get_hidden_user_ids')
  and grantee in ('authenticated', 'anon', 'PUBLIC')
order by routine_name, grantee;
