const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const a = id(1), b = id(2), python = id(101), guitar = id(102);
const env = { APP_ORIGIN: 'http://localhost:3000', SKILLSWAP_BACKEND_URL: 'http://localhost:3002', NODE_ENV: 'test' };
const cookie = 'sb-project-auth-token.0=fixture-0; sb-project-auth-token.1=fixture-1; skillswap-remember=0';
const normalize = value => JSON.parse(JSON.stringify(value));

// Executes actual frontend client -> frontend Route Handler/proxy -> backend
// Route Handler/auth/model/service. Only network and Supabase are fixtures.
function fixture() {
  let actor = a, currentRequest, signedOut = false, failTable = null, failWrite = null;
  const tables = { profiles: [], user_skills: [], swipes: [], matches: [], skills: [{ id: python, name: 'Python' }, { id: guitar, name: 'Guitar' }] };
  const calls = [], forwarded = [];
  const client = { from(table) {
    assert.notEqual(table, 'account_profiles', 'private profiles must never be published implicitly');
    let operation = 'read', values, upsertOptions, columns = '', counted = false, offset = 0, limit = 100, single = false;
    const filters = [], order = [];
    const q = {
      select(value, options) { columns = value; counted = options?.count === 'exact'; return this; },
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      is(key, value) { filters.push(row => row[key] === value); return this; },
      gt(key, value) { filters.push(row => row[key] > value); return this; },
      in(key, value) { filters.push(row => value.includes(row[key])); return this; },
      or() { return this; },
      order(key) { order.push(key); return this; },
      range(start, end) { offset = start; limit = end - start + 1; return this; },
      limit(size) { limit = size; return this; },
      maybeSingle() { single = true; return this; }, single() { single = true; return this; },
      insert(value) { operation = 'insert'; values = value; return this; },
      update(value) { operation = 'update'; values = value; return this; },
      upsert(value, options) { operation = 'upsert'; values = value; upsertOptions = options; return this; },
      delete() { operation = 'delete'; return this; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        calls.push({ table, operation, values: values && { ...values }, upsertOptions });
        if (table === failTable || (operation !== 'read' && table === failWrite)) return { data: null, error: { code: '42501', message: 'private database error' }, count: null };
        let affected = tables[table].filter(row => filters.every(f => f(row)));
        if (operation === 'insert' || operation === 'upsert') {
          assert.equal(values.user_id || values.id, actor, 'writes must use verified actor');
          const exists = tables[table].find(row => table === 'profiles' ? row.id === values.id
            : row.user_id === values.user_id && row.skill_id === values.skill_id && row.direction === values.direction);
          if (exists) {
            assert.equal(operation, 'upsert'); assert.equal(upsertOptions.ignoreDuplicates, true);
            affected = [];
          } else {
            const row = { ...(table === 'user_skills' ? { level: 'beginner', goal_level: null } : table === 'profiles' ? { meeting_preference: null, visible: false, onboarded: false, suspended_at: null } : {}), ...values };
            tables[table].push(row); affected = [row];
          }
        } else if (operation === 'update') {
          if (table === 'profiles') {
            assert.ok(affected.every(row => row.id === actor));
            assert.deepEqual(Object.keys(values).sort(), ['bio', 'display_name', 'meeting_preference']);
          } else {
            assert.ok(affected.every(row => row.user_id === actor));
            assert.deepEqual(Object.keys(values).sort(), ['goal_level', 'level']);
          }
          affected.forEach(row => Object.assign(row, values));
        } else if (operation === 'delete') {
          assert.ok(affected.every(row => row.user_id === actor));
          tables[table] = tables[table].filter(row => !affected.includes(row));
        }
        if (columns.includes('skills!inner')) {
          affected = affected.map(row => ({ ...row, skills: tables.skills.find(skill => skill.id === row.skill_id) })).filter(row => row.skills);
        }
        affected.sort((left, right) => {
          for (const key of order) { if (left[key] < right[key]) return -1; if (left[key] > right[key]) return 1; } return 0;
        });
        return { data: single ? affected[0] ?? null : affected.slice(offset, offset + Math.min(limit, 1)), error: null, count: counted ? affected.length : null };
      }).then(resolve, reject); },
    };
    return q;
  }, rpc: async name => {
    if (name === 'get_hidden_user_ids' || name === 'get_hidden_user_ids_page') return { data: [], error: null };
    if (name === 'publish_my_public_profile') {
      const profile = tables.profiles.find(row => row.id === actor);
      if (!profile || !tables.user_skills.some(row => row.user_id === actor && row.direction === 'teach') ||
          !tables.user_skills.some(row => row.user_id === actor && row.direction === 'learn')) return { data: null, error: { code: '22023' } };
      profile.visible = true; profile.onboarded = true;
      return { data: true, error: null };
    }
    return { data: [], error: null };
  }, auth: {
    getUser: async () => ({ data: { user: signedOut || !currentRequest.headers.get('cookie')?.includes('sb-project-auth-token.0=fixture-0') ? null : { id: actor, email_confirmed_at: '2026-01-01', app_metadata: {} } }, error: null }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }) },
  } };
  const backendMocks = {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/supabase/config': { getSupabaseConfig() {} },
  };
  const backendRoutes = {
    '/api/profiles/me': loadTs('backend/src/app/api/profiles/me/route.ts', backendMocks, { process: { env } }),
    '/api/skills': loadTs('backend/src/app/api/skills/route.ts', backendMocks, { process: { env } }),
    '/api/user-skills': loadTs('backend/src/app/api/user-skills/route.ts', backendMocks, { process: { env } }),
    '/api/discover': loadTs('backend/src/app/api/discover/route.ts', backendMocks, { process: { env } }),
  };
  async function backendFetch(url, options) {
    forwarded.push({ url: url.toString(), options });
    currentRequest = new Request(url, options);
    return backendRoutes[new URL(url).pathname][currentRequest.method](currentRequest);
  }
  const frontendRoutes = {};
  for (const name of ['public-profile', 'skills', 'user-skills', 'discover']) {
    frontendRoutes['/api/' + name] = loadTs('frontend/src/app/api/' + name + '/route.ts', {
      '@/lib/auth/origin': { appOrigin: async () => env.APP_ORIGIN },
    }, { process: { env }, fetch: backendFetch });
  }
  async function browserFetch(url, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('cookie', cookie);
    if (options.method && options.method !== 'GET') headers.set('origin', env.APP_ORIGIN);
    const request = new Request(env.APP_ORIGIN + url, { ...options, headers });
    return frontendRoutes[new URL(request.url).pathname][request.method](request);
  }
  const browser = loadTs('frontend/src/lib/discovery/client.ts', {}, { fetch: browserFetch });
  return { browser, tables, calls, forwarded, backendRoutes, frontendRoutes,
    as(value) { actor = value; }, signOut() { signedOut = true; }, failRead(value) { failTable = value; }, failWrite(value) { failWrite = value; },
  };
}

test('integration: explicit onboarding persists canonical skills and finds reciprocal saved public profiles', async () => {
  const f = fixture();
  const initial = await f.browser.loadPublicOnboarding();
  assert.equal(initial.profile, null); assert.deepEqual(normalize(initial.selections), []);
  assert.equal(initial.catalog.length, 2); // capped server still fully read
  assert.equal((await f.browser.loadDiscovery()).meta.reason, 'PROFILE_REQUIRED');
  await f.browser.savePublicOnboarding({ display_name: 'Public A', bio: 'Explicit public introduction', meeting_preference: null }, [
    { skill_id: python, direction: 'teach', level: 'beginner' }, { skill_id: guitar, direction: 'learn', level: 'beginner' },
  ]);
  f.as(b);
  await f.browser.savePublicOnboarding({ display_name: 'Public B', bio: 'Public exchange', meeting_preference: null }, [
    { skill_id: guitar, direction: 'teach', level: 'beginner' }, { skill_id: python, direction: 'learn', level: 'beginner' },
  ]);
  f.as(a);
  const loaded = await f.browser.loadPublicOnboarding();
  assert.equal(loaded.profile.display_name, 'Public A');
  assert.equal(loaded.selections.length, 2);
  const recommendations = await f.browser.loadDiscovery();
  assert.deepEqual(normalize(recommendations.data.map(row => row.id)), [b]);
  assert.equal(recommendations.data[0].compatibility.you_can_learn[0].id, guitar);
  assert.ok(f.forwarded.every(call => call.options.headers.get('cookie') === cookie));
  assert.ok(f.forwarded.every(call => call.options.cache === 'no-store' && call.options.redirect === 'manual'));
  assert.ok(f.calls.every(call => call.table !== 'account_profiles'));
});

test('integration: public edits use UPDATE permitted columns, remove only own selections and preserve unchanged levels', async () => {
  const f = fixture();
  const desired = [{ skill_id: python, direction: 'teach', level: 'beginner' }, { skill_id: guitar, direction: 'learn', level: 'beginner' }];
  await f.browser.savePublicOnboarding({ display_name: 'Public A', bio: '', meeting_preference: null }, desired);
  f.tables.user_skills[0].level = 'advanced';
  f.tables.user_skills.push({ user_id: b, skill_id: python, direction: 'teach', level: 'intermediate', goal_level: null });
  await f.browser.savePublicOnboarding({ display_name: 'Edited Public A', bio: 'New public bio', meeting_preference: null }, [
    ...desired, { skill_id: guitar, direction: 'teach', level: 'beginner' },
  ]);
  await f.browser.savePublicOnboarding({ display_name: 'Edited Public A', bio: 'New public bio', meeting_preference: null }, desired);
  assert.equal(f.tables.profiles[0].display_name, 'Edited Public A');
  assert.equal(f.tables.user_skills.find(row => row.user_id === a && row.skill_id === python).level, 'beginner');
  assert.equal(f.tables.user_skills.filter(row => row.user_id === a).length, 2);
  assert.equal(f.tables.user_skills.filter(row => row.user_id === b).length, 1);
});

test('integration: failures are explicit, partial saves reconcile on retry, and signed-out access never writes', async () => {
  const f = fixture();
  const desired = [{ skill_id: python, direction: 'teach', level: 'beginner' }, { skill_id: guitar, direction: 'learn', level: 'beginner' }];
  f.failWrite('user_skills');
  await assert.rejects(() => f.browser.savePublicOnboarding({ display_name: 'Public A', bio: '', meeting_preference: null }, desired), { status: 503 });
  assert.equal(f.tables.profiles.length, 1); assert.equal(f.tables.user_skills.length, 0);
  f.failWrite(null);
  await f.browser.savePublicOnboarding({ display_name: 'Public A', bio: '', meeting_preference: null }, desired);
  assert.equal(f.tables.user_skills.length, 2);
  f.failRead('profiles');
  await assert.rejects(() => f.browser.loadDiscovery(), { status: 503, code: 'DISCOVERY_UNAVAILABLE' });
  f.failRead(null); f.signOut();
  const previous = JSON.stringify(f.tables);
  await assert.rejects(() => f.browser.savePublicOnboarding({ display_name: 'Forged', bio: '', meeting_preference: null }, desired), { status: 401 });
  assert.equal(JSON.stringify(f.tables), previous);
});

test('backend APIs reject ownership spoofing, unknown catalog IDs, Unicode invalid names, CSRF, and oversized bodies', async () => {
  const f = fixture();
  // Establish authenticated fixture request via a normal same-origin request.
  await f.browser.loadPublicOnboarding();
  const send = (path, method, body, origin = env.APP_ORIGIN) => f.backendRoutes[path][method](new Request('http://localhost:3002' + path, {
    method, headers: { origin, 'content-type': 'application/json', cookie }, body: JSON.stringify(body),
  }));
  for (const body of [{ id: b, display_name: 'Name', bio: '' }, { display_name: '😀', bio: '' }]) {
    assert.equal((await send('/api/profiles/me', 'PATCH', body)).status, 400);
  }
  assert.equal((await send('/api/profiles/me', 'PATCH', { display_name: 'Name', bio: '' }, 'https://untrusted.example')).status, 403);
  assert.equal((await send('/api/profiles/me', 'PATCH', { display_name: 'Name', bio: 'x'.repeat(9000) })).status, 413);
  assert.equal((await send('/api/user-skills', 'POST', { user_id: b, skill_id: python, direction: 'teach' })).status, 400);
  assert.equal((await send('/api/user-skills', 'POST', { skill_id: python, direction: 'teach' })).status, 409);
  await f.browser.savePublicOnboarding({ display_name: 'Public A', bio: '', meeting_preference: null }, [
    { skill_id: python, direction: 'teach', level: 'beginner' }, { skill_id: guitar, direction: 'learn', level: 'beginner' },
  ]);
  assert.equal((await send('/api/user-skills', 'POST', { skill_id: id(999), direction: 'teach' })).status, 400);
  assert.ok(f.calls.every(call => call.values?.id !== b && call.values?.user_id !== b));
});

test('same-origin proxy forwards separate refresh/deletion cookies on errors, rejects redirects and CSRF', async () => {
  const refreshed = [
    'sb-project-auth-token.0=new-0; Path=/; HttpOnly; SameSite=Lax; Secure; Domain=backend.example',
    'sb-project-auth-token.1=new-1; Path=/; HttpOnly; SameSite=Lax; Secure',
    'sb-project-auth-token.2=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly',
  ];
  const upstreamHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=999', 'X-Private-Internal': 'omit' });
  for (const value of refreshed) upstreamHeaders.append('set-cookie', value);
  let calls = 0, redirect = false;
  const proxy = loadTs('frontend/src/lib/discovery/backend-proxy.ts', {
    '@/lib/auth/origin': { appOrigin: async () => env.APP_ORIGIN },
  }, { process: { env }, fetch: async (url, options) => {
    calls++;
    assert.equal(options.headers.get('cookie'), cookie);
    assert.equal(options.headers.has('authorization'), false);
    assert.equal(options.redirect, 'manual'); assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({ error: { code: 'MFA_REQUIRED', message: 'Verify second factor.' } }), { status: redirect ? 302 : 403, headers: upstreamHeaders });
  } });
  const response = await proxy.backendProxy(new Request(env.APP_ORIGIN + '/api/discover', { headers: { cookie, authorization: 'not-forwarded' } }), '/api/discover');
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.has('x-private-internal'), false);
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 3); assert.ok(cookies.every(value => !value.includes('Domain=')));
  assert.ok(cookies[0].includes('HttpOnly')); assert.ok(cookies[0].includes('Secure'));
  assert.ok(cookies[2].includes('Expires=Thu, 01 Jan 1970'));
  redirect = true;
  assert.equal((await proxy.backendProxy(new Request(env.APP_ORIGIN + '/api/discover', { headers: { cookie } }), '/api/discover')).status, 503);
  assert.equal(calls, 2);
  const forbidden = await proxy.backendProxy(new Request(env.APP_ORIGIN + '/api/public-profile', { method: 'PATCH', headers: { origin: 'https://untrusted.example' }, body: '{}' }), '/api/profiles/me');
  assert.equal(forbidden.status, 403); assert.equal(calls, 2);
});

test('frontend request proxy delegates API refresh once; backend cookie policy preserves session-only and deletions', async () => {
  let refreshes = 0;
  const proxy = loadTs('frontend/src/proxy.ts', {
    '@/lib/supabase/proxy': { updateSession: async () => { refreshes++; return new Response(); } },
  });
  for (const path of ['/api/discover', '/api/public-profile', '/api/skills', '/api/user-skills']) {
    await proxy.proxy({ nextUrl: new URL(env.APP_ORIGIN + path) });
  }
  assert.equal(refreshes, 0);
  await proxy.proxy({ nextUrl: new URL(env.APP_ORIGIN + '/profile') });
  assert.equal(refreshes, 1);
  const policy = loadTs('backend/src/lib/supabase/session-preference.ts', {}, { process: { env: { APP_ORIGIN: 'https://frontend.example', NODE_ENV: 'production' } } });
  const options = { maxAge: 3600, expires: new Date('2030-01-01'), path: '/' };
  const session = policy.sessionCookieOptions(options, false);
  assert.equal(session.maxAge, undefined); assert.equal(session.expires, undefined);
  assert.equal(session.httpOnly, true); assert.equal(session.secure, true); assert.equal(session.sameSite, 'lax');
  assert.equal(policy.sessionCookieOptions(options, true).maxAge, 3600);
  assert.equal(policy.sessionCookieOptions({ ...options, maxAge: 0 }, false).maxAge, 0);
});

test('backend refresh forwards new request chunks and preserves all response cookies across refresh callbacks', async () => {
  const { NextRequest } = require('next/server');
  const proxy = loadTs('backend/src/lib/supabase/proxy.ts', {
    './config': { getSupabaseConfig: () => ({ url: 'https://fixture.example', key: 'fixture-publishable' }) },
    '@supabase/ssr': { createServerClient(url, key, options) {
      return { auth: { getClaims: async () => {
        options.cookies.setAll([
          { name: 'sb-project-auth-token.0', value: 'refreshed-0', options: { path: '/', maxAge: 3600 } },
          { name: 'sb-project-auth-token.1', value: 'refreshed-1', options: { path: '/', maxAge: 3600 } },
        ]);
        options.cookies.setAll([
          { name: 'sb-project-auth-token.2', value: '', options: { path: '/', maxAge: 0 } },
        ]);
        return { data: { claims: {} }, error: null };
      } } };
    } },
  }, { process: { env: { ...env, NEXT_PUBLIC_SUPABASE_URL: 'configured-fixture' } } });
  const request = new NextRequest('http://localhost:3002/api/discover', { headers: { cookie } });
  const response = await proxy.updateSession(request);
  assert.equal(request.cookies.get('sb-project-auth-token.0').value, 'refreshed-0');
  assert.equal(request.cookies.get('sb-project-auth-token.1').value, 'refreshed-1');
  const outgoing = response.headers.getSetCookie();
  assert.equal(outgoing.length, 3);
  assert.ok(outgoing.filter(value => !value.includes('Max-Age=0')).every(value => !/Expires=|Max-Age=/i.test(value)));
  assert.ok(outgoing.every(value => /HttpOnly/i.test(value) && /SameSite=lax/i.test(value)));
  assert.ok(outgoing.some(value => value.includes('Max-Age=0')));
});
