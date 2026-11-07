const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTs } = require('./load-ts.cjs');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// Deterministic hook/effect fixture for exercising production screen callbacks.
// This is mocked React interaction verification, not a browser or DOM test.
function screen(file, name, client) {
  const slots = [], pending = [];
  let index = 0;
  const hooks = { ...React,
    useState(initial) {
      const position = index++;
      if (!(position in slots)) slots[position] = initial;
      return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }];
    },
    useRef(initial) { const position = index++; return slots[position] ||= { current: initial }; },
    useEffect(effect, deps) {
      const position = index++, previous = slots[position];
      if (!previous || deps.some((value, i) => value !== previous[i])) { pending.push(effect); slots[position] = deps; }
    },
  };
  const component = loadTs(file, {
    react: hooks,
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/demo/ui': { Badge: ({ children }) => React.createElement('span', null, children) },
    '@/lib/discovery/client': client,
  }, { Error })[name];
  let tree;
  const render = () => { index = 0; tree = component(); return renderToStaticMarkup(tree); };
  function elements(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(elements);
    return [node, ...elements(node.props?.children)];
  }
  return { render, elements: () => elements(tree),
    find: predicate => elements(tree).find(predicate),
    async settle() {
      while (pending.length) pending.shift()();
      await new Promise(resolve => setImmediate(resolve));
      return render();
    },
  };
}
class PublicApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const empty = reason => ({ data: [], meta: { next_cursor: null, reason } });

test('discovery screen renders loading, onboarding, true empty, provider errors and auth recovery without demo fallback', async () => {
  for (const [result, error, expected] of [
    [empty('PROFILE_REQUIRED'), null, 'Introduce yourself to the community'],
    [empty('SKILLS_REQUIRED'), null, 'Choose your skill exchange'],
    [empty(null), null, 'No partners in this queue yet.'],
    [null, new PublicApiError(503, 'DISCOVERY_UNAVAILABLE', 'Service unavailable'), 'Service unavailable'],
    [null, new PublicApiError(401, 'UNAUTHORIZED', 'Sign in to continue.'), 'Sign in again'],
    [null, new PublicApiError(403, 'MFA_REQUIRED', 'Complete verification.'), 'Verify your second factor'],
  ]) {
    const view = screen('frontend/src/components/discover/discovery.tsx', 'Discovery', { PublicApiError,
      loadDiscovery: async () => { if (error) throw error; return result; },
      loadPublicOnboarding: async () => ({ catalog: [], selections: [] }),
      loadPendingInterests: async () => ({ data: [] }),
    });
    assert.match(view.render(), /Finding skill partners/);
    const html = await view.settle();
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /Maya|fictional|predefined|Start a demo conversation/i);
    if (result?.meta.reason) assert.match(html, /href="\/onboarding"/);
  }
});

test('discovery screen retries and appends real pages, preserving loaded results on a load-more failure', async () => {
  const candidate = n => ({ id: id(n), display_name: 'Real member ' + n, bio: 'Saved public bio', meeting_preference: null,
    recommendation_type: 'reciprocal', recommendation_reason: 'Can exchange Python and Guitar.', preference_compatible: true, reciprocal_skill_count: 2,
    teaches: [], learns: [], compatibility: { you_can_learn: [], you_can_teach: [] } });
  let fail = true;
  const cursors = [];
  const view = screen('frontend/src/components/discover/discovery.tsx', 'Discovery', { PublicApiError,
    loadDiscovery: async cursor => {
      cursors.push(cursor);
      if (cursor && fail) throw new PublicApiError(503, 'DISCOVERY_UNAVAILABLE', 'Temporary failure');
      return { data: [candidate(cursor ? 3 : 2)], meta: { next_cursor: cursor ? null : 'opaque-next', reason: null } };
    },
    loadPublicOnboarding: async () => ({ catalog: [], selections: [] }),
    loadPendingInterests: async () => ({ data: [] }),
  });
  view.render(); assert.match(await view.settle(), /Real member 2/);
  const button = label => view.find(node => node.type === 'button' && node.props.children === label);
  button('Load more partners').props.onClick();
  let html = await view.settle();
  assert.match(html, /Temporary failure/); assert.match(html, /Real member 2/);
  fail = false; button('Try again').props.onClick();
  html = await view.settle();
  assert.match(html, /Real member 2/); assert.match(html, /Real member 3/); assert.match(html, /reached the end/);
  assert.deepEqual(cursors, [null, 'opaque-next', 'opaque-next']);
});

test('public onboarding starts blank, saves only explicit canonical selections and reports partial-save retry', async () => {
  const saved = [];
  let fail = true;
  const view = screen('frontend/src/components/discover/public-onboarding.tsx', 'PublicOnboarding', { PublicApiError,
    loadPublicOnboarding: async () => ({ profile: null, catalog: [{ id: id(101), name: 'Python' }, { id: id(102), name: 'Guitar' }], selections: [] }),
    savePublicOnboarding: async (profile, selections) => { saved.push({ profile, selections }); if (fail) throw new PublicApiError(503, 'DISCOVERY_UNAVAILABLE', 'Temporary failure'); },
  });
  assert.match(view.render(), /Loading your saved public profile/);
  assert.match(await view.settle(), /Nothing is copied or published automatically/);
  const input = () => view.find(node => node.type === 'input');
  assert.equal(input().props.value, '');
  input().props.onChange({ target: { value: 'Explicit public name' } }); view.render();
  let form = view.find(node => node.type === 'form');
  await form.props.onSubmit({ preventDefault() {} });
  assert.match(view.render(), /Choose at least one skill/); assert.equal(saved.length, 0);
  for (const [direction, skill] of [['teach', id(101)], ['learn', id(102)]]) {
    view.find(node => node.type === 'select' && node.props['aria-label'] === 'Add a skill to ' + direction).props.onChange({ target: { value: skill } });
    view.render();
  }
  await view.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.match(view.render(), /Some changes may already be saved/);
  fail = false;
  await view.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.match(view.render(), /Public profile and skills saved/);
  assert.deepEqual(JSON.parse(JSON.stringify(saved[1])), { profile: { display_name: 'Explicit public name', bio: '', meeting_preference: null }, selections: [
    { skill_id: id(101), direction: 'teach', level: 'beginner', goal_level: null }, { skill_id: id(102), direction: 'learn', level: 'beginner', goal_level: null },
  ] });
});
