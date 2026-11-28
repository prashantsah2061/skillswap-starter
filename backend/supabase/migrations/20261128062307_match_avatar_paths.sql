-- Return only avatar paths for the caller's current, unblocked matches.
-- account_profiles stays owner-only; this scoped function is the match-card
-- presentation boundary for its otherwise private avatar_path column.
begin;

create or replace function public.get_match_avatar_paths(p_partner_ids uuid[])
returns table (user_id uuid, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.user_id, profile.avatar_path
  from public.account_profiles profile
  where (select auth.uid()) is not null
    and (select public.account_session_allowed())
    and cardinality(p_partner_ids) between 1 and 100
    and profile.user_id = any(p_partner_ids)
    and exists (
      select 1
      from public.matches match_row
      where (select auth.uid()) in (match_row.user_a, match_row.user_b)
        and profile.user_id = case
          when (select auth.uid()) = match_row.user_a then match_row.user_b
          else match_row.user_a
        end
        and not exists (
          select 1 from public.get_hidden_user_ids() hidden
          where hidden.user_id = profile.user_id
        )
    );
$$;

revoke all on function public.get_match_avatar_paths(uuid[]) from public, anon, authenticated;
grant execute on function public.get_match_avatar_paths(uuid[]) to authenticated;

commit;
