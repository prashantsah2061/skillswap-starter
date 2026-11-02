// Same transpile/VM approach as tests/auth, resolving this workspace's aliases.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const nativeRequire = createRequire(path.join(root, 'backend/package.json'));

function loadTs(entry, mocks = {}, globals = {}) {
  const cache = new Map();
  const workspace = entry.startsWith('frontend/') ? 'frontend' : 'backend';
  function load(file) {
    file = path.resolve(root, file);
    if (!fs.existsSync(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file).exports;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const module = { exports: {} };
    cache.set(file, module);
    function requireModule(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/')) return load(path.join(root, workspace, 'src', name.slice(2)));
      if (name.startsWith('@shared/')) return load(path.join(root, 'shared/types', name.slice(8)));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return nativeRequire(name);
    }
    vm.runInNewContext(source, {
      module, exports: module.exports, require: requireModule,
      URL, Headers, Request, Response, TextEncoder, TextDecoder, AbortSignal, AbortController, process, ...globals,
    }, { filename: file });
    return module.exports;
  }
  return load(entry);
}
module.exports = { loadTs };
