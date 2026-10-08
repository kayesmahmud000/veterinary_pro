const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../api/index.js'), 'utf8');

async function invoke(t, artifacts, url, cwdAtWorkspace = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vetralink-entry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appRoot = path.join(root, 'apps/api');
  const entry = path.join(appRoot, 'api/index.js');
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  for (const [location, label] of Object.entries(artifacts)) {
    const file = path.join(appRoot, location);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `exports.default = async (req, res) => res.status(200).json({ artifact: ${JSON.stringify(label)}, url: req.url });`);
  }
  const module = { exports: {} };
  vm.runInNewContext(source, {
    require: createRequire(entry), module, exports: module.exports,
    __dirname: path.dirname(entry), console, global: {},
    process: { env: {}, version: 'test', platform: 'linux', arch: 'x64',
      cwd: () => cwdAtWorkspace ? root : appRoot, on: () => {} },
  }, { filename: entry });
  const res = { statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await module.exports({ url, headers: {} }, res);
  return res;
}

test('loads the flat serverless build for an API request', async t => {
  const res = await invoke(t, { 'dist/serverless.js': 'flat' }, '/api/v1/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.artifact, 'flat');
  assert.equal(res.body.url, '/api/v1/health');
});

test('prefers the current flat artifact over stale nested output', async t => {
  const res = await invoke(t, {
    'dist/serverless.js': 'current', 'dist/src/serverless.js': 'stale',
  }, '/api/v1/auth/me');
  assert.equal(res.body.artifact, 'current');
});

test('supports a legacy nested serverless build', async t => {
  const res = await invoke(t, { 'dist/src/serverless.js': 'legacy' }, '/api/v1/health');
  assert.equal(res.body.artifact, 'legacy');
});

test('discovers the flat artifact when invoked from the workspace root', async t => {
  const res = await invoke(t, { 'dist/serverless.js': 'workspace' }, '/api/v1/health', true);
  assert.equal(res.body.artifact, 'workspace');
});

test('diagnostics discovers the flat build used for real API requests', async t => {
  const res = await invoke(t, { 'dist/serverless.js': 'flat' }, '/api/ping?diagnose=1');
  assert.equal(res.body.diagnostics.serverlessRequireSuccess, true);
  assert.equal(res.body.diagnostics.serverlessExportType, 'function');
});
