-- Restore the narrow public-profile update grant expected by onboarding.
begin;
grant update (display_name, bio) on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant insert, delete on public.user_skills to authenticated;
commit;
