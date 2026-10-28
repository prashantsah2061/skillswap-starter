const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const nativeRequire = createRequire(path.join(root, 'package.json'));
function loadTs(file, mocks = {}, globals = {}) {
  file = path.resolve(root, file);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  const customRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'server-only') return {};
    if (name.startsWith('.') || name.startsWith('@/')) {
      const target = name.startsWith('@/') ? path.join(root, 'frontend/src', name.slice(2)) : path.resolve(path.dirname(file), name);
      const resolved = fs.existsSync(target) ? target : fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx';
      return loadTs(resolved, mocks, globals);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require: customRequire, URL, Headers, Response, TextEncoder, AbortSignal, process, ...globals }, { filename: file });
  return module.exports;
}
module.exports = { loadTs };
