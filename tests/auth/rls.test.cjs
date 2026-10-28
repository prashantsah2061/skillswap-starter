const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('PostgreSQL: private profiles, name preservation, two-user isolation, revoked sessions, MFA, anonymous denial',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 create table auth.mfa_factors(user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 `);
 await db.exec(fs.readFileSync('backend/supabase/migrations/202610280001_private_account_profiles.sql','utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',sa='10000000-0000-4000-8000-000000000001',sb='10000000-0000-4000-8000-000000000002';
 await db.query(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'google@example.com',now(),'{"full_name":"Google Name"}'),($2,'fallback@example.com',now(),'{}')`,[a,b]);
 await db.query('insert into auth.sessions values($1,$2),($3,$4)',[sa,a,sb,b]);
 async function as(id,sid,aal='aal1'){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:sid,aal})]);await db.exec('set role authenticated');}
 await as(a,sa);assert.equal((await db.query('select * from public.ensure_my_account_profile()')).rows[0].display_name,'Google Name');
 await db.query('update public.account_profiles set display_name=$1 where user_id=$2',['<b>Custom name</b>',a]);
 await db.exec('reset role');await db.query(`update auth.users set raw_user_meta_data='{"full_name":"Changed at Google"}' where id=$1`,[a]);
 await as(a,sa);assert.equal((await db.query('select * from public.ensure_my_account_profile()')).rows[0].display_name,'<b>Custom name</b>');
 await as(b,sb);assert.equal((await db.query('select * from public.ensure_my_account_profile()')).rows[0].display_name,'fallback');
 assert.equal((await db.query('select * from public.account_profiles where user_id=$1',[a])).rows.length,0);
 assert.equal((await db.query('update public.account_profiles set display_name=$1 where user_id=$2 returning *',['stolen',a])).rows.length,0);
 await assert.rejects(()=>db.query('update public.account_profiles set user_id=$1',[a]));
 await assert.rejects(()=>db.query('insert into public.account_profiles(user_id,display_name) values($1,$2)',[a,'forged']));
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[sb]);await as(b,sb);
 assert.equal((await db.query('select * from public.account_profiles')).rows.length,0);
 await db.exec('reset role');await db.query("insert into auth.mfa_factors values($1,'verified')",[a]);await as(a,sa);
 assert.equal((await db.query('select * from public.account_profiles')).rows.length,0);await as(a,sa,'aal2');assert.equal((await db.query('select * from public.account_profiles')).rows.length,1);
 await db.exec('reset role');await db.query('insert into auth.sessions values($1,$2)',[sb,b]);await db.query(`update auth.users set raw_app_meta_data='{"role":"admin"}' where id=$1`,[b]);await as(b,sb);assert.equal((await db.query('select * from public.account_profiles')).rows.length,0);await as(b,sb,'aal2');const own=(await db.query('select * from public.account_profiles')).rows;assert.equal(own.length,1);assert.equal(Object.hasOwn(own[0],'email'),false);
 await db.exec('reset role; set role anon');await assert.rejects(()=>db.query('select * from public.account_profiles'));await assert.rejects(()=>db.query('select * from public.ensure_my_account_profile()'));
 }finally{await db.close();}
});
