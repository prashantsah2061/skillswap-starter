-- Match members may view limited partner details even when the partner is no
-- longer discoverable. Scope the private-profile read to current matches.
begin;

create or replace function public.get_match_partner_profiles(p_partner_ids uuid[])
returns table (user_id uuid, display_name text, bio text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select requested.user_id,
    coalesce(public_profile.display_name, private_profile.display_name, 'SkillSwap member'),
    coalesce(public_profile.bio, private_profile.bio, ''),
    private_profile.avatar_path
  from (
    select distinct requested_id.user_id
    from unnest(p_partner_ids) as requested_id(user_id)
  ) requested
  left join public.profiles public_profile on public_profile.id = requested.user_id
  left join public.account_profiles private_profile on private_profile.user_id = requested.user_id
  where (select auth.uid()) is not null
    and (select public.account_session_allowed())
    and cardinality(p_partner_ids) between 1 and 100
    and exists (
      select 1
      from public.matches match_row
      where (select auth.uid()) in (match_row.user_a, match_row.user_b)
        and requested.user_id = case
          when (select auth.uid()) = match_row.user_a then match_row.user_b
          else match_row.user_a
        end
        and not exists (
          select 1 from public.get_hidden_user_ids() hidden
          where hidden.user_id = requested.user_id
        )
    );
$$;

revoke all on function public.get_match_partner_profiles(uuid[]) from public, anon, authenticated;
grant execute on function public.get_match_partner_profiles(uuid[]) to authenticated;

commit;
