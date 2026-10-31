const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const validation = loadTs('frontend/src/lib/auth/validation.ts');

test('display names: Google, unnamed Google, email, fallback, plain text', () => {
  for (const [user, expected] of [
    [{user_metadata:{full_name:'Google Name'}}, 'Google Name'],
    [{email:'fallback@example.com',user_metadata:{}}, 'fallback'],
    [{user_metadata:{display_name:'Registered Name'}}, 'Registered Name'],
    [{}, 'New user'],
    [{user_metadata:{name:'<script>alert(1)</script>'}}, '<script>alert(1)</script>'],
  ]) assert.equal(validation.initialDisplayName(user), expected);
});
test('password policy: minimum15, 64+ characters, UTF8 limit, breached and outage fail closed', async () => {
  assert.equal(validation.passwordSchema.safeParse('a'.repeat(14)).success, false);
  assert.equal(validation.passwordSchema.safeParse('😀'.repeat(14)).success, false);
  assert.equal(validation.passwordSchema.safeParse('a'.repeat(64)).success, true);
  assert.equal(validation.passwordSchema.safeParse('é'.repeat(37)).success, false);
  const crypto = require('node:crypto'), password = 'test fixture passphrase';
  const digest = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  let requested;
  const policy = loadTs('frontend/src/lib/auth/password-policy.ts', {}, { fetch: async url => {requested=url; return new Response(digest.slice(5)+':4\r\n'+'0'.repeat(35)+':0');} });
  assert.match(await policy.checkNewPassword(password), /breaches/);
  assert.equal(requested, 'https://api.pwnedpasswords.com/range/'+digest.slice(0,5));
  const outage = loadTs('frontend/src/lib/auth/password-policy.ts', {}, { fetch:async()=>{throw Error('offline');} });
  assert.match(await outage.checkNewPassword(password), /unavailable/);
});
function fixture(options={}) {
  const calls=[];
  const user={id:'user-a',email_confirmed_at:'2026-01-01',app_metadata:{}};
  const supabase={auth:{
    signInWithPassword:async()=>({data:{user},error:options.loginError||null}),
    signUp:async input=>{calls.push(['signup',input]);return {data:{user,session:null},error:null};},
    signOut:async input=>{calls.push(['signout',input.scope]);return {error:options.revokeError||null};},
    resetPasswordForEmail:async()=>({error:options.recoveryError||null}),
    exchangeCodeForSession:async()=>({data:{session:{},redirectType:options.redirectType||null},error:null}),
    verifyOtp:async()=>{calls.push(['verify']);return {data:{session:options.invalid?null:{},user},error:options.invalid?{}:null};},
    getUser:async()=>({data:{user},error:null}),
    updateUser:async()=>{calls.push(['update']);return {error:null};},
    mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:options.mfa?'aal2':'aal1'},error:null}),listFactors:async()=>({data:{totp:[{id:'factor',status:'verified'}]},error:null}),challengeAndVerify:async()=>({error:options.badMfa?{}:null})},
    signInWithOAuth:async()=>({data:{url:'https://provider.example/authorize'},error:null}),
  }};
  const mocks={
    '@/lib/supabase/server':{createClient:async()=>supabase},
    './password-policy':{checkNewPassword:async()=>null},
    './session':{verifiedSession:async()=>({supabase,user,claims:{}}),mfaRequired:async()=>!!options.mfa},
    'next/headers':{headers:async()=>new Headers({origin:options.origin||'http://localhost:3000'}),cookies:async()=>({set(){},delete(){}})},
    'next/navigation':{redirect:destination=>{throw new Error('REDIRECT:'+destination);}},
  };
  return {calls,actions:loadTs('frontend/src/lib/auth/actions.ts',mocks,{process:{env:{APP_ORIGIN:'http://localhost:3000',NODE_ENV:'test'}}})};
}
test('generic login errors, MFA redirect, server validation, CSRF origin', async()=>{
  const a=fixture({loginError:{code:'email_not_confirmed'}}),b=fixture({loginError:{code:'invalid_credentials'}});
  const input={email:'a@example.com',password:'existing short password',remember:true};
  assert.equal((await a.actions.loginAction(input)).error,(await b.actions.loginAction(input)).error);
  assert.ok((await a.actions.loginAction({email:'bad',password:''})).error);
  assert.equal((await fixture({mfa:true}).actions.loginAction(input)).next,'/mfa');
  await assert.rejects(()=>fixture({origin:'https://attacker.example'}).actions.loginAction(input),/origin/);
});
test('signup validates server-side and never returns a session; recovery responses generic',async()=>{
  const f=fixture();assert.ok((await f.actions.signupAction({name:'',email:'a@example.com',password:'short',confirmPassword:'short'})).error);
  const result=await f.actions.signupAction({name:'Name',email:'a@example.com',password:'test fixture passphrase',confirmPassword:'test fixture passphrase'});
  assert.equal(result.error,null);assert.equal(f.calls[0][1].options.data.display_name,'Name');assert.equal(f.calls[1][1],'local');
  assert.equal((await fixture().actions.requestRecoveryAction('a@example.com')).error,(await fixture({recoveryError:{status:429}}).actions.requestRecoveryAction('a@example.com')).error);
});
test('recovery validates single-use provider proof before mutation, global revocation, MFA',async()=>{
  const input={tokenHash:'opaque-test-token-hash',password:'test fixture passphrase',confirmation:'test fixture passphrase'};
  const invalid=fixture({invalid:true});assert.equal((await invalid.actions.resetPasswordAction(input)).invalid,true);assert.equal(invalid.calls.some(c=>c[0]==='update'),false);
  const valid=fixture();assert.equal((await valid.actions.resetPasswordAction(input)).changed,true);assert.deepEqual(valid.calls.map(c=>c[0]),['verify','update','signout']);assert.equal(valid.calls[2][1],'global');
  const noFactor=fixture({mfa:true});assert.equal((await noFactor.actions.resetPasswordAction(input)).invalid,true);assert.equal(noFactor.calls.some(c=>c[0]==='update'),false);
  const mfa=fixture({mfa:true});assert.equal((await mfa.actions.resetPasswordAction({...input,totpCode:'123456'})).changed,true);
  const pkce=fixture({redirectType:'recovery'});assert.equal((await pkce.actions.resetPasswordAction({...input,tokenHash:undefined,code:'fixture-recovery-code'})).changed,true);
  const wrongFlow=fixture({redirectType:'signup'});assert.equal((await wrongFlow.actions.resetPasswordAction({...input,tokenHash:undefined,code:'fixture-recovery-code'})).invalid,true);
  const revoke=fixture({revokeError:{}});const warning=await revoke.actions.resetPasswordAction(input);assert.equal(warning.changed,true);assert.match(warning.error,/revocation/);
});
test('logout uses Supabase, redirects only after successful revocation',async()=>{
  const f=fixture();await assert.rejects(()=>f.actions.logoutAction(),/REDIRECT:\/login/);assert.equal(f.calls[0][1],'local');
  assert.ok((await fixture({revokeError:{}}).actions.logoutAction()).error);
});
test('private profile API returns401 and rejects cross-origin mutations',async()=>{
 const mocks={'@/lib/auth/session':{verifiedSession:async()=>null},'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},'next/headers':{headers:async()=>new Headers({host:'localhost:3000'})}};
 const api=loadTs('frontend/src/app/api/profile/route.ts',mocks);
 assert.equal((await api.GET()).status,401);
 const request={headers:new Headers({origin:'https://attacker.example'})};
 const configured=loadTs('frontend/src/app/api/profile/route.ts',mocks,{process:{env:{APP_ORIGIN:'http://localhost:3000'}}});
 assert.equal((await configured.PATCH(request)).status,403);
});

test('recent authentication and admin checks use verified claims/app metadata, never display metadata',async()=>{
 const sessionModule=loadTs('frontend/src/lib/auth/session.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'a',email_confirmed_at:'yes',user_metadata:{role:'admin'},app_metadata:{}}},error:null}),getClaims:async()=>({data:{claims:{sub:'a',aal:'aal1'}},error:null})}})}});
 assert.equal(sessionModule.recentlyAuthenticated({amr:[{method:'oauth',timestamp:Date.now()/1000-30}]}),true);
 assert.equal(sessionModule.recentlyAuthenticated({amr:[{method:'password',timestamp:Date.now()/1000-700}]}),false);
 assert.equal(sessionModule.recentlyAuthenticated({amr:['oauth']}),false);
 await assert.rejects(()=>sessionModule.requireAdmin(),/Forbidden/);
});
test('Google/confirmation callbacks: success, provider rejection, expired link, unexchangeable code',async()=>{
 const response={redirect:url=>({url:url.href,headers:new Headers()})};
 async function callback(query,exchangeError=null){
 const route=loadTs('frontend/src/app/auth/callback/route.ts',{
 'next/server':{NextResponse:response},'@/lib/auth/origin':{appOrigin:async()=> 'https://app.example'},
 '@/lib/supabase/server':{createClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:exchangeError}),getUser:async()=>({data:{user:null},error:null})}})},
 });const u=new URL('https://app.example/auth/callback'+query);return route.GET({nextUrl:u,url:u.href});}
 assert.equal((await callback('?code=valid')).url,'https://app.example/dashboard');
 assert.equal((await callback('?error=access_denied')).url,'https://app.example/login?error=oauth');
 assert.equal((await callback('?error_code=otp_expired')).url,'https://app.example/login?error=confirmation');
 assert.equal((await callback('?code=used',{})).url,'https://app.example/login?notice=signin');
});

test('profile and account menu render the same saved name as escaped text',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const name='<script>alert("x")</script>';
 const profile={user_id:'a',display_name:name,city:'',bio:''};
 const mocks={
 '@/components/auth/account-provider':{useAccount:()=>({name,profile,setProfile(){}})},
 '@/lib/profile/actions':{saveProfileAction:async()=>({error:null,profile})},
 './demo-provider':{useDemo:()=>({data:{userId:'a',profile:{id:'a',display_name:name,city:'',bio:'',visible:false},skills:[],selections:[]},refresh(){}})},
 '@/components/demo/demo-provider':{useDemo:()=>({data:{profile:{photo:'alex'}}})},
 './ui':{Photo:()=>null,Badge:({children})=>React.createElement('span',null,children)},
 '@/components/demo/ui':{Photo:()=>null,Logo:()=>null},
 '@/components/auth/logout-button':{LogoutButton:()=>null},
 'next/navigation':{usePathname:()=>'/profile'},
 'next/link':{default:({children,href,...props})=>React.createElement('a',{href,...props},children)},
 };
 const Profile=loadTs('frontend/src/components/demo/profile.tsx',mocks).Profile;
 const Nav=loadTs('frontend/src/components/layout/site-nav.tsx',mocks).SiteNav;
 for(const Component of [Profile,Nav]){const html=renderToStaticMarkup(React.createElement(Component));assert.equal(html.includes('<script>'),false);assert.ok(html.includes('&lt;script&gt;'));assert.equal(html.includes('example.com'),false);}
});
test('profile mutations reject supplied owner IDs and always scope to the verified user',async()=>{
 let owner;
 const profile={user_id:'verified-a',display_name:'Saved',city:'',bio:''};
 const action=loadTs('frontend/src/lib/profile/actions.ts',{
 'next/cache':{revalidatePath(){}},'@/lib/auth/origin':{checkActionOrigin:async()=>{}},
 '@/lib/auth/session':{mfaRequired:async()=>false,verifiedSession:async()=>({user:{id:'verified-a'},supabase:{from:()=>({update:()=>({eq:(column,id)=>{assert.equal(column,'user_id');owner=id;return {select:()=>({single:async()=>({data:profile,error:null})})};}})})}})},
 });
 assert.ok((await action.saveProfileAction({display_name:'Saved',city:'',bio:'',user_id:'victim'})).error);assert.equal(owner,undefined);
 assert.equal((await action.saveProfileAction({display_name:'Saved',city:'',bio:''})).error,null);assert.equal(owner,'verified-a');
});

test('development allows matching loopback ports; production and cross-origin requests stay strict',async()=>{
 async function check(env,origin,host){const o=loadTs('frontend/src/lib/auth/origin.ts',{'next/headers':{headers:async()=>new Headers({origin,host})}},{process:{env:{APP_ORIGIN:'http://localhost:3000',NODE_ENV:env}}});await o.checkActionOrigin();return o.appOrigin();}
 assert.equal(await check('development','http://localhost:3001','localhost:3001'),'http://localhost:3001');
 assert.equal(await check('development','http://127.0.0.1:3001','127.0.0.1:3001'),'http://127.0.0.1:3001');
 await assert.rejects(()=>check('development','https://attacker.example','localhost:3001'),/origin/);
 await assert.rejects(()=>check('development','http://attacker.example','attacker.example'),/origin/);
 await assert.rejects(()=>check('production','http://localhost:3001','localhost:3001'),/origin/);
 assert.equal(await check('production','http://localhost:3000','localhost:3000'),'http://localhost:3000');
});

test('Render platform URL and explicit custom domains work without trusting arbitrary origins',async()=>{
 async function check(env,origin,host){const o=loadTs('frontend/src/lib/auth/origin.ts',{'next/headers':{headers:async()=>new Headers({...(origin?{origin}:{}),host})}},{process:{env:{NODE_ENV:'production',...env}}});if(origin)await o.checkActionOrigin();return o.appOrigin();}
 const render='https://fixture-app.onrender.com';
 assert.equal(await check({RENDER_EXTERNAL_URL:render},render,'fixture-app.onrender.com'),render);
 assert.equal(await check({RENDER_EXTERNAL_URL:render,APP_ORIGIN:'http://localhost:3000'},render,'fixture-app.onrender.com'),render);
 assert.equal(await check({RENDER_EXTERNAL_URL:render,APP_ORIGIN:render+'/'},render,'fixture-app.onrender.com'),render);
 assert.equal(await check({RENDER_EXTERNAL_URL:render,APP_ORIGIN:'https://custom.example'},render,'fixture-app.onrender.com'),render);
 assert.equal(await check({RENDER_EXTERNAL_URL:render,APP_ORIGIN:'https://custom.example'},'https://custom.example','custom.example'),'https://custom.example');
 assert.equal(await check({RENDER_EXTERNAL_URL:render},null,'fixture-app.onrender.com'),render);
 await assert.rejects(()=>check({RENDER_EXTERNAL_URL:render},'https://attacker.example','attacker.example'),/origin/);
 await assert.rejects(()=>check({},render,'fixture-app.onrender.com'),/origin/);
});
