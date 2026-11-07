const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('isolated PostgreSQL: discovery visibility, actor-only swipes, private profile separation, denied writes/anonymous reads', async () => {
  const db = new PGlite();
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  const c = '00000000-0000-4000-8000-000000000003';
  const python = '10000000-0000-4000-8000-000000000001';
  const guitar = '10000000-0000-4000-8000-000000000002';
  const session = '20000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
        raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id));
      create table auth.mfa_factors(user_id uuid, status text);
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth to authenticated, anon;
    `);
    // Apply repository migrations only to this disposable in-memory database.
    await db.exec(fs.readFileSync('backend/supabase/migrations/202609210001_initial_schema.sql', 'utf8'));
    await db.exec(fs.readFileSync('backend/supabase/migrations/202610280001_private_account_profiles.sql', 'utf8'));
    for (const migration of [
      '20261106205430_matching_messaging.sql', '20261106210208_session_scheduling.sql',
      '20261106211146_user_safety_controls.sql', '20261106211800_public_onboarding_visibility.sql',
      '20261106214000_profile_update_grants.sql', '20261107000100_discovery_ranking_and_visibility.sql',
    ]) await db.exec(fs.readFileSync('backend/supabase/migrations/' + migration, 'utf8'));
    await db.query(`insert into auth.users(id,email_confirmed_at) values ($1,now()),($2,now()),($3,now())`, [a, b, c]);
    await db.query(`insert into auth.sessions values ($1,$2)`, [session, a]);
    await db.query(`insert into auth.sessions values ('20000000-0000-4000-8000-000000000003',$1)`, [c]);
    await db.query(`insert into public.profiles(id,display_name,visible,onboarded) values ($1,'Member A',true,true),($2,'Member B',true,true)`, [a, b]);
    // C has only a private frontend profile; it must not appear in discovery.
    await db.query(`insert into public.account_profiles(user_id,display_name) values ($1,'Private A'),($2,'Private B'),($3,'Private C')`, [a, b, c]);
    await db.query(`insert into public.skills(id,name) values ($1,'Python'),($2,'Guitar')`, [python, guitar]);
    await db.query(`insert into public.user_skills(user_id,skill_id,direction) values
      ($1,$3,'teach'),($1,$4,'learn'),($2,$4,'teach'),($2,$3,'learn')`, [a, b, python, guitar]);
    await db.query(`insert into public.swipes(actor_id,target_id,decision) values ($1,$2,'pass'),($2,$1,'like')`, [a, b]);
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: a, session_id: session, aal: 'aal1' })]);
    await db.exec('set role authenticated');

    assert.deepEqual((await db.query('select id from public.profiles order by id')).rows.map(r => r.id), [a, b]);
    const visible = await db.query(`select u.user_id,u.skill_id,u.direction,s.name from public.user_skills u
      join public.skills s on s.id=u.skill_id order by u.user_id,u.skill_id,u.direction`);
    assert.equal(visible.rows.length, 4);
    assert.equal(visible.rows.filter(r => r.user_id === b).length, 2);
    assert.deepEqual((await db.query('select actor_id,target_id from public.swipes')).rows, [{ actor_id: a, target_id: b }]);
    assert.deepEqual((await db.query('select user_id from public.account_profiles')).rows, [{ user_id: a }]);
    await assert.rejects(() => db.query(`insert into public.user_skills(user_id,skill_id,direction,level) values ($1,$2,'teach','beginner')`, [b, python]));
    await assert.rejects(() => db.query(`insert into public.swipes values ($1,$2,'like',now())`, [a, b]));
    await assert.rejects(() => db.query(`insert into public.matches(user_a,user_b) values ($1,$2)`, [a, b]));

    // Exercise the exact privileges needed by onboarding, including idempotent
    // INSERT ... DO NOTHING without UPDATE privileges on the composite key.
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: c, session_id: '20000000-0000-4000-8000-000000000003', aal: 'aal1' })]);
    await db.query(`insert into public.profiles(id,display_name,bio) values ($1,'Explicit public C','Chosen public bio')`, [c]);
    await db.query(`update public.profiles set display_name='Edited public C',bio='Edited public bio',meeting_preference='online' where id=$1`, [c]);
    assert.equal((await db.query('select display_name from public.profiles where id=$1', [c])).rows[0].display_name, 'Edited public C');
    assert.equal((await db.query('select meeting_preference from public.profiles where id=$1', [c])).rows[0].meeting_preference, 'online');
    assert.equal((await db.query(`update public.profiles set display_name='Forged' where id=$1 returning id`, [a])).rows.length, 0);
    await assert.rejects(() => db.query('update public.profiles set id=id where id=$1', [c]));
    await db.query(`insert into public.user_skills(user_id,skill_id,direction) values ($1,$2,'teach'),($1,$3,'learn')`, [c, python, guitar]);
    await db.query(`update public.user_skills set level='advanced' where user_id=$1 and skill_id=$2 and direction='teach'`, [c, python]);
    await db.query(`update public.user_skills set goal_level='intermediate' where user_id=$1 and skill_id=$2 and direction='learn'`, [c, guitar]);
    await db.query(`insert into public.user_skills(user_id,skill_id,direction) values ($1,$2,'teach') on conflict(user_id,skill_id,direction) do nothing`, [c, python]);
    assert.equal((await db.query(`select level from public.user_skills where user_id=$1 and skill_id=$2 and direction='teach'`, [c, python])).rows[0].level, 'advanced');
    assert.equal((await db.query(`select goal_level from public.user_skills where user_id=$1 and skill_id=$2 and direction='learn'`, [c, guitar])).rows[0].goal_level, 'intermediate');
    assert.equal((await db.query(`delete from public.user_skills where user_id=$1 returning *`, [a])).rows.length, 0);
    assert.equal((await db.query(`delete from public.user_skills where user_id=$1 and skill_id=$2 and direction='learn' returning *`, [c, guitar])).rows.length, 1);
    await db.query(`insert into public.user_skills(user_id,skill_id,direction) values ($1,$2,'teach'),($1,$3,'learn')`, [c, guitar, python]);
    await db.query('select public.publish_my_public_profile()');

    // The RPC upgrades an intentional pass-to-like revisit, creates no match
    // for one-sided interest, and remains idempotent after reciprocal interest.
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: a, session_id: session, aal: 'aal1' })]);
    const upgraded = await db.query('select * from public.record_swipe($1,\'like\')', [b]);
    assert.equal(upgraded.rows[0].matched, true);
    assert.equal((await db.query('select count(*)::int as count from public.matches where user_a=$1 and user_b=$2', [a, b])).rows[0].count, 1);
    const oneSided = await db.query('select * from public.record_swipe($1,\'like\')', [c]);
    assert.equal(oneSided.rows[0].matched, false);
    assert.equal((await db.query('select count(*)::int as count from public.matches where user_a=$1 or user_b=$1', [c])).rows[0].count, 0);
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: c, session_id: '20000000-0000-4000-8000-000000000003', aal: 'aal1' })]);
    const mutual = await db.query('select * from public.record_swipe($1,\'like\')', [a]);
    const retry = await db.query('select * from public.record_swipe($1,\'like\')', [a]);
    assert.equal(mutual.rows[0].matched, true); assert.equal(retry.rows[0].matched, true);
    assert.equal((await db.query('select count(*)::int as count from public.matches where user_a=$1 or user_b=$1', [c])).rows[0].count, 1);
    const matchId = (await db.query('select id from public.matches where user_a=$1 or user_b=$1', [c])).rows[0].id;
    const sent = await db.query('select * from public.send_match_message($1,$2)', [matchId, 'Hello']);
    assert.equal(sent.rows[0].sender_id, c);
    await assert.rejects(() => db.query('select * from public.record_swipe($1,\'like\')', [c]));
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: a, session_id: session, aal: 'aal1' })]);
    assert.equal((await db.query('select id from public.messages where match_id=$1', [matchId])).rows.length, 1);
    await db.query('insert into public.user_blocks(blocker_id,blocked_id) values ($1,$2)', [a, c]);
    assert.deepEqual((await db.query('select user_id from public.get_hidden_user_ids_page(0,500)')).rows, [{ user_id: c }]);
    assert.equal((await db.query('select id from public.profiles where id=$1', [c])).rows.length, 0);
    assert.equal((await db.query('select id from public.messages where match_id=$1', [matchId])).rows.length, 0);
    await assert.rejects(() => db.query('select * from public.send_match_message($1,$2)', [matchId, 'Blocked contact']));

    await db.exec('reset role; set role anon');
    for (const table of ['profiles', 'skills', 'user_skills', 'swipes', 'account_profiles']) {
      await assert.rejects(() => db.query(`select * from public.${table}`));
    }
  } finally { await db.close(); }
});
