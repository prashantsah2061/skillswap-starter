const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('./load-ts.cjs');

const service = loadTs('backend/src/services/discovery.service.ts');
const validator = loadTs('backend/src/lib/validators/discovery.ts');
const matching = loadTs('backend/src/lib/discovery/matching.ts');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), python = id(9001), guitar = id(9002);
const profile = n => ({ id: id(n), display_name: `Member ${n}`, bio: 'Fixture profile' });
const listing = (user, skill, direction, name = skill === python ? 'Python' : 'Guitar') =>
  ({ user_id: user, skill_id: skill, direction, skill: { id: skill, name } });
const ownSkills = [listing(actor, python, 'teach'), listing(actor, guitar, 'learn')];
const reciprocal = user => [listing(user, guitar, 'teach'), listing(user, python, 'learn')];
const json = value => JSON.parse(JSON.stringify(value));

function source({ profiles = [profile(1), profile(2)], skills = [...ownSkills, ...reciprocal(id(2))], swiped = [], own = profile(1), batch = 2 } = {}) {
  const calls = [];
  return {
    calls,
    ownProfile: async user => { assert.equal(user, actor); return own; },
    profilesAfter: async after => {
      calls.push(after);
      return profiles.filter(p => !after || p.id > after).slice(0, batch);
    },
    skillsFor: async ids => skills.filter(row => ids.includes(row.user_id)),
    swipedTargets: async (user, ids) => {
      assert.equal(user, actor);
      return new Set(swiped.filter(value => ids.includes(value)));
    },
  };
}

test('matching requires both directions and canonical IDs, with exact overlap explanations', () => {
  const own = matching.skillsByDirection(ownSkills);
  assert.equal(matching.complementaryCandidate(own, profile(2), [listing(id(2), guitar, 'teach')]), null);
  assert.equal(matching.complementaryCandidate(own, profile(2), [listing(id(2), python, 'learn')]), null);
  assert.equal(matching.complementaryCandidate(own, profile(2), [listing(id(2), id(9003), 'teach', 'Guitar'), listing(id(2), python, 'learn')]), null);
  const result = matching.complementaryCandidate(own, profile(2), reciprocal(id(2)));
  assert.deepEqual(json(result.compatibility), {
    you_can_learn: [{ id: guitar, name: 'Guitar' }], you_can_teach: [{ id: python, name: 'Python' }],
  });
});

test('discovery excludes self and any outgoing swipe (like or pass)', async () => {
  const fixture = source({
    profiles: [1, 2, 3, 4].map(profile),
    skills: [...ownSkills, ...[1, 2, 3, 4].flatMap(n => reciprocal(id(n)))],
    swiped: [id(2), id(3)],
  });
  const result = await service.discover(fixture, actor, { limit: 20, after: null });
  assert.deepEqual(json(result.data.map(p => p.id)), [id(4)]);
  assert.equal(result.meta.next_cursor, null);
});

test('missing profile and either missing skill direction have distinct onboarding reasons', async () => {
  for (const [fixture, reason] of [
    [source({ own: null }), 'PROFILE_REQUIRED'],
    [source({ skills: [] }), 'SKILLS_REQUIRED'],
    [source({ skills: ownSkills.slice(0, 1) }), 'SKILLS_REQUIRED'],
    [source({ skills: ownSkills.slice(1) }), 'SKILLS_REQUIRED'],
  ]) {
    const result = await service.discover(fixture, actor, { limit: 20, after: null });
    assert.deepEqual(json(result), { data: [], meta: { next_cursor: null, reason } });
    assert.equal(fixture.calls.length, 0);
  }
  const noMatches = await service.discover(source({ skills: ownSkills }), actor, { limit: 20, after: null });
  assert.equal(noMatches.meta.reason, null);
  assert.equal(noMatches.data.length, 0);
});

test('sparse pagination scans beyond ineligible batches and preserves lookahead without skips', async () => {
  // Eligible 3, 8, 9, 12; ineligible rows span multiple batches and the tail.
  const fixture = source({
    profiles: Array.from({ length: 15 }, (_, n) => profile(n + 1)), batch: 2,
    skills: [...ownSkills, ...[3, 8, 9, 12].flatMap(n => reciprocal(id(n)))],
  });
  const seen = [];
  let after = null;
  let pages = 0;
  do {
    const result = await service.discover(fixture, actor, { limit: 2, after });
    pages++;
    seen.push(...result.data.map(p => p.id));
    if (pages === 1) assert.ok(result.meta.next_cursor);
    after = result.meta.next_cursor
      ? validator.parseDiscoveryQuery('http://local/api/discover?cursor=' + result.meta.next_cursor, actor).after : null;
    if (pages === 2) assert.equal(result.meta.next_cursor, null);
  } while (after && pages < 10);
  assert.equal(pages, 2);
  assert.deepEqual(seen, [id(3), id(8), id(9), id(12)]);
});

test('lookahead in the same batch and page size changes never consume unseen candidates', async () => {
  const fixture = source({ profiles: [1, 2, 3, 4, 5].map(profile), batch: 100,
    skills: [...ownSkills, ...[2, 3, 4, 5].flatMap(n => reciprocal(id(n)))] });
  const first = await service.discover(fixture, actor, { limit: 1, after: null });
  const query = validator.parseDiscoveryQuery(`http://local/api/discover?limit=3&cursor=${first.meta.next_cursor}`, actor);
  const second = await service.discover(fixture, actor, query);
  assert.deepEqual(json([...first.data, ...second.data].map(p => p.id)), [2, 3, 4, 5].map(id));
  assert.equal(second.meta.next_cursor, null);
});

test('cursor validation rejects malformed, foreign-user, unknown, duplicate and out-of-range parameters', () => {
  const bad = ['limit=0', 'limit=51', 'limit=-1', 'limit=1.5', 'limit=01', 'limit=', 'limit=1&limit=2',
    'actor_id=' + id(2), 'cursor=', 'cursor=***', 'cursor=e30', 'cursor=x'.repeat(100),
    'cursor=' + validator.discoveryCursor(id(2), id(3)),
    'cursor=' + Buffer.from(JSON.stringify({ v: 2, actor, after: id(2) })).toString('base64url'),
    'cursor=' + Buffer.from(JSON.stringify({ v: 1, actor, after: 'not-a-uuid' })).toString('base64url')];
  for (const query of bad) assert.throws(() => validator.parseDiscoveryQuery('http://local/api/discover?' + query, actor), { status: 400 });
  assert.deepEqual(json(validator.parseDiscoveryQuery('http://local/api/discover', actor)), { limit: 20, after: null });
  assert.equal(validator.parseDiscoveryQuery('http://local/api/discover?limit=50', actor).limit, 50);
});

// A PostgREST query-builder fixture executes the production model queries.
// It models server row caps, filters, ordering, count and errors; it is not live Supabase.
function database({ cap = 1, failure = null, reject = false, errorCode = 'PGRST205', corrupt = false, missingCount = false } = {}) {
  const tables = {
    profiles: [1, 2, 3].map(profile),
    user_skills: [...ownSkills, ...reciprocal(id(2)), ...reciprocal(id(3))].map(({ skill, ...row }) => ({ ...row, skills: skill })),
    swipes: [{ actor_id: actor, target_id: id(2), decision: 'pass' }, { actor_id: id(2), target_id: id(3), decision: 'like' }],
  };
  const calls = [];
  return { tables, calls, from(table) {
    const conditions = [], ordering = [];
    let offset = 0, size = Infinity, single = false, counted = false;
    const query = {
      select(columns, options) { counted = options?.count === 'exact'; calls.push({ table, columns }); return this; },
      eq(key, value) { conditions.push(row => row[key] === value); return this; },
      gt(key, value) { conditions.push(row => row[key] > value); return this; },
      in(key, values) { conditions.push(row => values.includes(row[key])); return this; },
      order(key) { ordering.push(key); return this; },
      limit(value) { size = value; return this; },
      range(start, end) { offset = start; size = end - start + 1; return this; },
      maybeSingle() { single = true; return this; },
      then(resolve, rejectPromise) {
        return Promise.resolve().then(() => {
          if (table === failure) {
            if (reject) throw Error('transport contains private details');
            return { data: null, error: { code: errorCode, message: 'private database details' }, count: null };
          }
          const rows = tables[table].filter(row => conditions.every(f => f(row))).sort((a, b) => {
            for (const key of ordering) { if (a[key] < b[key]) return -1; if (a[key] > b[key]) return 1; } return 0;
          });
          return { data: corrupt ? null : single ? rows[0] ?? null : rows.slice(offset, offset + Math.min(cap, size)), error: null, count: counted && !missingCount ? rows.length : null };
        }).then(resolve, rejectPromise);
      },
    };
    return query;
  } };
}
const model = loadTs('backend/src/models/discovery.model.ts');

test('production model exhausts capped skill/swipe pages and scopes outgoing swipes to actor', async () => {
  const db = database();
  const source = model.discoveryModel(db);
  assert.equal((await source.skillsFor([actor, id(2), id(3)])).length, 6);
  db.tables.swipes.push({ actor_id: actor, target_id: id(3), decision: 'like' });
  assert.deepEqual([...await source.swipedTargets(actor, [id(2), id(3)])], [id(2), id(3)]);
  db.tables.swipes.pop();
  const result = await service.discover(source, actor, { limit: 1, after: null });
  assert.deepEqual(json(result.data.map(row => row.id)), [id(3)]);
  assert.equal(result.meta.next_cursor, null);
  assert.ok(db.calls.every(call => !call.columns.includes('*')));
});

function routeFixture(options = {}) {
  const db = database(options);
  let created = 0, authCalls = 0;
  db.auth = {
    getUser: async () => {
      authCalls++;
      if (options.authThrow) throw Error('network details');
      return { data: { user: options.signedOut ? null : {
        id: actor, email_confirmed_at: options.unconfirmed ? null : '2026-01-01',
        app_metadata: options.admin ? { role: 'admin' } : {}, user_metadata: { role: 'admin' },
      } }, error: options.authError ?? null };
    },
    mfa: { getAuthenticatorAssuranceLevel: async () => ({
      data: { currentLevel: options.aal2 ? 'aal2' : 'aal1', nextLevel: options.mfa ? 'aal2' : 'aal1' }, error: options.mfaError ?? null,
    }) },
  };
  const route = loadTs('backend/src/app/api/discover/route.ts', {
    '@/lib/supabase/server': { createClient: async () => { created++; if (options.clientThrow) throw Error('client details'); return db; } },
    '@/lib/supabase/config': { getSupabaseConfig() { if (options.noConfig) throw Error('private configuration'); } },
    ...options.mocks,
  });
  return { db, route, counts: () => ({ created, authCalls }) };
}
const request = query => new Request('http://local/api/discover' + (query || ''));

test('route enforces verified/confirmed user, MFA and trusted admin metadata before querying', async () => {
  for (const [options, status, code] of [
    [{ signedOut: true }, 401, 'UNAUTHORIZED'], [{ unconfirmed: true }, 401, 'UNAUTHORIZED'],
    [{ authError: { name: 'AuthSessionMissingError', status: 400 } }, 401, 'UNAUTHORIZED'],
    [{ authError: { status: 401 } }, 401, 'UNAUTHORIZED'],
    [{ authError: { status: 400, code: 'refresh_token_not_found' } }, 401, 'UNAUTHORIZED'],
    [{ mfa: true }, 403, 'MFA_REQUIRED'], [{ admin: true }, 403, 'MFA_REQUIRED'],
    [{ authError: { status: 429 } }, 429, 'RATE_LIMITED'],
    [{ authError: { status: 500 } }, 503, 'DISCOVERY_UNAVAILABLE'],
    [{ authThrow: true }, 503, 'DISCOVERY_UNAVAILABLE'],
    [{ mfaError: { status: 500 } }, 503, 'DISCOVERY_UNAVAILABLE'],
    [{ noConfig: true }, 503, 'DISCOVERY_UNAVAILABLE'],
    [{ clientThrow: true }, 503, 'DISCOVERY_UNAVAILABLE'],
  ]) {
    const f = routeFixture(options), response = await f.route.GET(request());
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(f.db.calls.length, 0);
  }
  for (const options of [{}, { admin: true, aal2: true }, { mfa: true, aal2: true }]) {
    const f = routeFixture(options);
    assert.equal((await f.route.GET(request())).status, 200);
    assert.deepEqual(f.counts(), { created: 1, authCalls: 1 });
    assert.equal((await f.route.GET(request())).status, 200);
    assert.deepEqual(f.counts(), { created: 2, authCalls: 2 });
  }
});

test('route returns response envelope, validation errors, and onboarding without database writes', async () => {
  const f = routeFixture();
  const response = await f.route.GET(request('?limit=1'));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.data.map(p => p.id), [id(3)]);
  assert.deepEqual(body.meta, { next_cursor: null, reason: null });
  assert.equal((await f.route.GET(request('?limit=51'))).status, 400);
  f.db.tables.profiles = f.db.tables.profiles.filter(p => p.id !== actor);
  assert.equal((await (await f.route.GET(request())).json()).meta.reason, 'PROFILE_REQUIRED');
  f.db.tables.profiles.push(profile(1));
  f.db.tables.user_skills = [];
  assert.equal((await (await f.route.GET(request())).json()).meta.reason, 'SKILLS_REQUIRED');
});

test('missing schemas, permission/database errors and transport failures return sanitized 503', async () => {
  for (const failure of ['profiles', 'user_skills', 'swipes']) {
    for (const reject of [false, true]) {
      const f = routeFixture({ failure, reject });
      const response = await f.route.GET(request());
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: { code: 'DISCOVERY_UNAVAILABLE', message: 'Discovery is temporarily unavailable.' } });
    }
  }
  const f = routeFixture({ failure: 'user_skills' });
  f.db.tables.profiles = [];
  assert.equal((await f.route.GET(request())).status, 503); // not PROFILE_REQUIRED
  for (const errorCode of ['42501', '42P01', 'PGRST200']) {
    assert.equal((await routeFixture({ failure: 'profiles', errorCode }).route.GET(request())).status, 503);
  }
  for (const options of [{ corrupt: true }, { missingCount: true }]) {
    assert.equal((await routeFixture(options).route.GET(request())).status, 503);
  }
});

test('unexpected application failures have a sanitized 500 envelope', async () => {
  const fixture = routeFixture({ mocks: { '@/services/discovery.service': { discover: async () => { throw Error('internal secret details'); } } } });
  const response = await fixture.route.GET(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_ERROR', message: 'Discovery could not be completed.' } });
});

test('proxy preserves discovery 503 envelope before handler; unrelated routes retain behavior', async () => {
  const proxy = loadTs('backend/src/proxy.ts', { '@/lib/supabase/proxy': { updateSession: async () => { throw Error('configuration details'); } } });
  const result = await proxy.proxy({ nextUrl: new URL('http://local/api/discover') });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.code, 'DISCOVERY_UNAVAILABLE');
  await assert.rejects(() => proxy.proxy({ nextUrl: new URL('http://local/api/matches') }), /configuration details/);
});
