const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../discovery/load-ts.cjs');
const { skills } = require('./fixtures/labeled-skills.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1);
const matching = loadTs('backend/src/lib/discovery/matching.ts');
const semantic = loadTs('backend/src/lib/discovery/semantic-matching.ts');
const pad = values => [...values, ...Array(256 - values.length).fill(0)];
const vector = new Map([
  [semantic.skillContent(skills.python), pad([1,0,0])],
  [semantic.skillContent(skills.pythonProgramming), pad([0.8,0.6,0])],
  [semantic.skillContent(skills.guitar), pad([0,0,1])],
  [semantic.skillContent(skills.snakeCare), pad([0,1,0])],
  [semantic.skillContent(skills.baking), pad([0,1,0])],
]);
const listing = (user, skill, direction) => ({ user_id: user, skill_id: skill.id, direction, skill });
const own = [listing(actor, skills.guitar, 'teach'), listing(actor, skills.python, 'learn')];

test('semantic matching permits related IDs without exact prefilter, requires both directions and grounds explanations', () => {
  const candidate = { id: id(2), display_name: 'Fixture', bio: 'Must never be embedded' };
  const related = [listing(id(2), skills.pythonProgramming, 'teach'), listing(id(2), skills.guitar, 'learn')];
  const a = matching.skillsByDirection(own);
  assert.equal(matching.complementaryCandidate(a, candidate, related), null);
  const result = semantic.semanticCandidate(a, candidate, related, vector, 0.75);
  assert.ok(result); assert.equal(result.semantic.learning.kind, 'related');
  assert.ok(Math.abs(result.semantic.learning.similarity - 0.8) < 1e-10);
  assert.equal(result.semantic.teaching.similarity, 1);
  assert.equal(result.semantic.score_kind, 'cosine_similarity');
  assert.match(result.semantic.learning.explanation, /different catalog skills/);
  assert.equal(result.semantic.learning.wanted.id, skills.python.id);
  assert.equal(result.semantic.learning.offered.id, skills.pythonProgramming.id);
  assert.equal(semantic.semanticCandidate(a, candidate, [related[0], listing(id(2), skills.baking, 'learn')], vector, 0.75), null);
  assert.equal(semantic.semanticCandidate(a, candidate, [listing(id(2), skills.snakeCare, 'teach'), related[1]], vector, 0.75), null);
  assert.equal(semantic.semanticCandidate(a, candidate, related, vector, 0.85), null);
  assert.throws(() => semantic.cosine([0,0], [1,0]));
  assert.throws(() => semantic.cosine([NaN], [1]));
});

test('provider embeds only canonical content; cache keys include content, model revision and dimensions', async () => {
  const requests = [];
  const provider = loadTs('backend/src/lib/discovery/embeddings.ts', {}, { fetch: async (url, options) => {
    const input = JSON.parse(options.body); requests.push(input);
    assert.equal(url, 'https://api.openai.com/v1/embeddings');
    assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    return Response.json({ model: input.model, data: input.input.map((text, index) => ({ index, embedding: pad([1,0]) })) });
  } });
  const settings = { key: 'fixture-private-key', revision: 'fixture-v1' };
  const skill = { ...skills.python, description: 'Canonical programming skill.', bio: 'PRIVATE_BIO', email: 'PRIVATE_EMAIL' };
  const first = await provider.embedSkills([skill], settings);
  first.get(semantic.skillContent(skill))[0] = 999; // caller cannot mutate cache
  assert.equal((await provider.embedSkills([{ ...skill, id: id(99) }], settings)).get(semantic.skillContent(skill))[0], 1);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].input[0]), { name: 'Python', description: 'Canonical programming skill.' });
  assert.ok(!JSON.stringify(requests).includes('PRIVATE_'));
  await provider.embedSkills([{ ...skill, description: 'Changed canonical content.' }], settings);
  await provider.embedSkills([skill], { ...settings, revision: 'fixture-v2' });
  assert.equal(requests.length, 3);
  assert.notEqual(provider.embeddingKey(skill, 'fixture-v1'), provider.embeddingKey(skill, 'fixture-v2'));
});

test('provider enforces single batch, zero retries, input/output/vector validation and per-process request budget', async () => {
  let calls = 0;
  const failed = loadTs('backend/src/lib/discovery/embeddings.ts', {}, { fetch: async () => { calls++; throw Error('private provider failure'); } });
  await assert.rejects(() => failed.embedSkills([skills.python], { key: 'fixture', revision: 'v1' }), { reason: 'PROVIDER_UNAVAILABLE' });
  assert.equal(calls, 1);
  const malformed = loadTs('backend/src/lib/discovery/embeddings.ts', {}, { fetch: async () => Response.json({ model: 'text-embedding-3-small', data: [{ index: 0, embedding: [0] }] }) });
  await assert.rejects(() => malformed.embedSkills([skills.python], { key: 'fixture', revision: 'v1' }), { reason: 'PROVIDER_UNAVAILABLE' });
  const bounded = loadTs('backend/src/lib/discovery/embeddings.ts', {}, { fetch: async (url, options) => {
    calls++; return Response.json({ model: 'text-embedding-3-small', data: JSON.parse(options.body).input.map((_, index) => ({ index, embedding: pad([1]) })) });
  } });
  calls = 0;
  for (let n = 0; n < 16; n++) await bounded.embedSkills([{ id: id(n+1), name: 'Canonical ' + n }], { key: 'fixture', revision: 'v1' });
  await assert.rejects(() => bounded.embedSkills([{ id: id(50), name: 'New content' }], { key: 'fixture', revision: 'v1' }), { reason: 'PROVIDER_BUDGET' });
  assert.equal(calls, 16);
  await assert.rejects(() => bounded.embedSkills(Array.from({ length: 65 }, (_, n) => ({ id: id(n+1), name: 'Canonical ' + n })), { key: 'fixture', revision: 'v1' }), { reason: 'CATALOG_LIMIT' });
  await assert.rejects(() => bounded.embedSkills([{ id: id(1), name: 'x'.repeat(600) }], { key: 'fixture', revision: 'v1' }), { reason: 'CATALOG_LIMIT' });
});

function discoveryFixture({ failure = false, maxProfiles = 200 } = {}) {
  let now = Date.now(), enabled = true, providerCalls = 0;
  class Clock extends Date { static now() { return now; } }
  class SemanticUnavailable extends Error { constructor(reason) { super(reason); this.reason = reason; } }
  const profiles = [1,2,3,4,5].map(n => ({ id: id(n), display_name: 'Member ' + n, bio: '' }));
  const better = { id: id(101), name: 'Intermediate Python programming' };
  const vectors = new Map(vector); vectors.set(semantic.skillContent(better), pad([0.95, Math.sqrt(1-0.95**2), 0]));
  const rows = [...own,
    listing(id(2), skills.pythonProgramming, 'teach'), listing(id(2), skills.guitar, 'learn'),
    listing(id(3), skills.snakeCare, 'teach'), listing(id(3), skills.guitar, 'learn'),
    listing(id(4), better, 'teach'), listing(id(4), skills.guitar, 'learn'),
    listing(id(5), skills.python, 'teach'), listing(id(5), skills.guitar, 'learn'),
  ];
  const hidden = new Set(), swiped = new Set();
  const source = {
    ownProfile: async () => profiles[0],
    profilesAfter: async after => profiles.filter(row => !hidden.has(row.id) && (!after || row.id > after)).slice(0,2),
    profilesFor: async ids => profiles.filter(row => ids.includes(row.id) && !hidden.has(row.id)),
    skillsFor: async ids => rows.filter(row => ids.includes(row.user_id)),
    swipedTargets: async (user, ids) => new Set(ids.filter(value => swiped.has(value))),
  };
  const service = loadTs('backend/src/services/semantic-discovery.service.ts', {
    '../lib/discovery/semantic-config': { semanticEnabled: () => enabled, semanticSettings: () => ({ threshold: 0.75, revision: 'fixture', key: 'fixture', maxProfiles }) },
    '../lib/discovery/embeddings': { SemanticUnavailable, embeddingVersion: () => 'fixture-v1', embedSkills: async () => {
      providerCalls++; if (failure) throw new SemanticUnavailable('PROVIDER_UNAVAILABLE'); return vectors;
    } },
  }, { Date: Clock });
  const validator = loadTs('backend/src/lib/validators/discovery.ts');
  const next = response => validator.parseDiscoveryQuery('http://local/api/discover?limit=1&cursor=' + response.meta.next_cursor, actor);
  return { service, source, hidden, swiped, rows, next, providerCalls: () => providerCalls, advance: () => { now += 300001; }, disable: () => { enabled = false; } };
}

test('global semantic rank is frozen before pagination, with no skips or per-page reranking', async () => {
  const f = discoveryFixture(), seen = [];
  let query = { limit: 1, after: null }, response;
  do {
    response = await f.service.discoverWithSemantics(f.source, actor, query);
    assert.equal(response.meta.matching.mode, 'semantic');
    seen.push(...response.data.map(row => row.id));
    if (response.meta.next_cursor) query = f.next(response);
  } while (response.meta.next_cursor);
  assert.deepEqual(seen, [id(5), id(4), id(2)]); // rank differs from UUID scan order
  assert.equal(f.providerCalls(), 1);
});

test('snapshot continuation rechecks authorization/exclusions, and expiry/actor edits cannot reuse stale ranks', async () => {
  const f = discoveryFixture();
  const first = await f.service.discoverWithSemantics(f.source, actor, { limit: 1, after: null });
  f.hidden.add(id(4)); f.swiped.add(id(2));
  const second = await f.service.discoverWithSemantics(f.source, actor, f.next(first));
  assert.equal(second.data.length, 0); assert.equal(second.meta.next_cursor, null);
  await assert.rejects(() => f.service.discoverWithSemantics(f.source, id(99), f.next(first)), { status: 409 });
  f.rows.push(listing(actor, skills.baking, 'learn'));
  await assert.rejects(() => f.service.discoverWithSemantics(f.source, actor, f.next(first)), { status: 409 });
  f.rows.pop(); f.advance();
  await assert.rejects(() => f.service.discoverWithSemantics(f.source, actor, f.next(first)), { status: 409 });
  assert.equal(f.providerCalls(), 1);
});

test('provider and pool failures explicitly fall back to the exact baseline; baseline cursors never switch modes', async () => {
  for (const options of [{ failure: true }, { maxProfiles: 2 }]) {
    const f = discoveryFixture(options);
    const result = await f.service.discoverWithSemantics(f.source, actor, { limit: 1, after: null });
    assert.deepEqual(JSON.parse(JSON.stringify(result.data.map(row => row.id))), [id(5)]);
    assert.equal(result.meta.matching.mode, 'baseline');
    assert.equal(result.meta.matching.fallback_reason, options.failure ? 'PROVIDER_UNAVAILABLE' : 'CANDIDATE_LIMIT');
  }
  const f = discoveryFixture();
  const result = await f.service.discoverWithSemantics(f.source, actor, { limit: 20, after: id(1) });
  assert.deepEqual(JSON.parse(JSON.stringify(result.data.map(row => row.id))), [id(5)]);
  assert.equal(f.providerCalls(), 0);
  f.disable();
  assert.equal((await f.service.discoverWithSemantics(f.source, actor, { limit: 20, after: null })).meta.matching, undefined);
});

test('production configuration requires a matching live model evaluation, never a lexical or fixture report', () => {
  const env = { OPENAI_API_KEY: 'fixture', SKILL_EMBEDDING_REVISION: 'revision-v1', SKILL_MATCH_THRESHOLD: '0.8', SKILL_MATCH_EVALUATION_REPORT: '/fixture/report.json' };
  const report = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 256, format: 'canonical-skill-v1', revision: 'revision-v1', input: 'names-only', evaluated_thresholds: [0.8], heldout_count: 12 };
  const config = value => loadTs('backend/src/lib/discovery/semantic-config.ts', { 'node:fs': { statSync: () => ({ size: 1000 }), readFileSync: () => JSON.stringify(value) } }, { process: { env } });
  assert.equal(config(report).semanticSettings().threshold, 0.8);
  for (const value of [{ ...report, provider: 'fixture' }, { ...report, revision: 'old' }, { ...report, evaluated_thresholds: [0.9] }, { ...report, heldout_count: 0 }]) {
    assert.throws(() => config(value).semanticSettings(), { reason: 'EVALUATION_REQUIRED' });
  }
});

test('authorization/data failures during continuation remain failures rather than baseline fallback', async () => {
  const f = discoveryFixture();
  const first = await f.service.discoverWithSemantics(f.source, actor, { limit: 1, after: null });
  const failure = Object.assign(new Error('fixture database unavailable'), { status: 503 });
  f.source.profilesFor = async () => { throw failure; };
  await assert.rejects(() => f.service.discoverWithSemantics(f.source, actor, f.next(first)), error => error === failure);
  assert.equal(f.providerCalls(), 1);
});

test('frontend preserves directional evidence and renders similarities without probability or identity claims', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const result = semantic.semanticCandidate(matching.skillsByDirection(own), { id: id(2), display_name: 'Member', bio: '' }, [
    listing(id(2), skills.pythonProgramming, 'teach'), listing(id(2), skills.guitar, 'learn'),
  ], vector, 0.75);
  const client = loadTs('frontend/src/lib/discovery/client.ts', {}, { fetch: async () => Response.json({ data: [result], meta: { next_cursor: null, reason: null, matching: { mode: 'semantic', model_version: 'fixture-v1', threshold: 0.75 } } }) });
  const response = await client.loadDiscovery();
  assert.equal(response.data[0].semantic.learning.wanted.name, 'Python');
  assert.equal(response.meta.matching.mode, 'semantic');
  const { SkillCard } = loadTs('frontend/src/components/discover/skill-card.tsx', {
    '@/components/demo/ui': { Badge: ({ children }) => React.createElement('span', null, children) },
  });
  const html = renderToStaticMarkup(React.createElement(SkillCard, { profile: response.data[0] }));
  assert.match(html, /Learning similarity: 0.80/);
  assert.match(html, /Teaching similarity: 1.00/);
  assert.match(html, /different catalog skills/);
  assert.match(html, /not a probability/);
  assert.doesNotMatch(html, /80%/);
});
