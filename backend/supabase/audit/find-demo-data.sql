-- READ ONLY: changes nothing. Lists accounts that look like demo data so a person
-- can review them. A match here is a reason to look, not proof an account is fake.
select u.id, u.email, a.display_name, u.created_at, u.last_sign_in_at,
 array_remove(array[
  case when u.email ~* '@(example\.(com|org|net|test)|test\.com|mailinator\.com)$' then 'placeholder email domain' end,
  case when u.email ~* '^(demo|test|fake|dummy|sample|seed)[^@]*@' then 'demo-style email address' end,
  case when lower(btrim(a.display_name)) = any(array['alex morgan','sam rivera','jordan lee','maya chen','jordan rivera','sam park','riley taylor','john doe','jane doe','test user','demo user']) then 'exact name from old demo data' end,
  case when u.last_sign_in_at is null then 'never signed in' end
 ], null) as reasons
from auth.users u left join public.account_profiles a on a.user_id = u.id
where u.email ~* '@(example\.(com|org|net|test)|test\.com|mailinator\.com)$'
 or u.email ~* '^(demo|test|fake|dummy|sample|seed)[^@]*@'
 or lower(btrim(a.display_name)) = any(array['alex morgan','sam rivera','jordan lee','maya chen','jordan rivera','sam park','riley taylor','john doe','jane doe','test user','demo user'])
 or u.last_sign_in_at is null
order by u.created_at;
