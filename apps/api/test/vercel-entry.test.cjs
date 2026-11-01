const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../api/index.js'), 'utf8');

async function invoke(t, artifacts, url, cwdAtWorkspace = false, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vetralink-entry-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appRoot = path.join(root, 'apps/api');
  const entry = path.join(appRoot, 'api/index.js');
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  for (const [location, label] of Object.entries(artifacts)) {
    const file = path.join(appRoot, location);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, options.artifactSource ?? `exports.default = async (req, res) => res.status(200).json({ artifact: ${JSON.stringify(label)}, url: req.url });`);
  }
  const module = { exports: {} };
  vm.runInNewContext(source, {
    require: createRequire(entry), module, exports: module.exports,
    __dirname: path.dirname(entry), console, global: {},
    process: { env: {}, version: 'test', platform: 'linux', arch: 'x64',
      cwd: () => cwdAtWorkspace ? root : appRoot, on: () => {} },
  }, { filename: entry });
  const res = { statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  await module.exports({ url, headers: options.headers ?? {}, method: options.method ?? 'POST' }, res);
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

test('recovery rejects diagnostic queries before all wrapper bypasses without disclosure', async t => {
  for (const query of ['ping=synthetic-reset-secret', 'diagnose=synthetic-reset-secret']) {
    const res = await invoke(t, {}, `/api/v1/auth/password-reset/complete?${query}`);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.errorDetails.title, 'VALIDATION_FAILED');
    assert.equal(JSON.stringify(res.body).includes('synthetic-reset-secret'), false);
    assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
  }
});

test('recovery preserves query rejection when matched-path would otherwise erase it', async t => {
  const res = await invoke(t, {}, '/api?ping=synthetic-reset-secret', false,
    { headers: { 'x-matched-path': '/api/v1/auth/password-reset/request' } });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.stringify(res.body).includes('synthetic-reset-secret'), false);
});

test('recovery handles missing artifacts, import failure and execution failure safely', async t => {
  for (const options of [
    { artifacts: {} },
    { artifacts: { 'dist/serverless.js': 'bad' }, artifactSource: 'throw new Error("synthetic-provider-secret")' },
    { artifacts: { 'dist/serverless.js': 'throws' }, artifactSource: 'exports.default = async () => { throw new Error("synthetic-provider-secret"); };' },
  ]) {
    const res = await invoke(t, options.artifacts, '/api/v1/auth/password-reset/complete', false, options);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.errorDetails.title, 'RECOVERY_UNAVAILABLE');
    assert.equal(JSON.stringify(res.body).includes('synthetic-provider-secret'), false);
    assert.equal('stack' in res.body, false);
    assert.equal('candidates' in res.body, false);
  }
});

test('recovery dispatches verified matched path before legacy root handling', async t => {
  const res = await invoke(t, { 'dist/serverless.js': 'recovery' }, '/api', false,
    { headers: { 'x-matched-path': '/api/v1/auth/password-reset/request' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.artifact, 'recovery');
  assert.equal(res.body.url, '/api/v1/auth/password-reset/request');
  assert.equal(res.headers['cache-control'], 'private, no-store');
});

test('recovery cannot be rewritten into diagnostics or served using GET', async t => {
  const conflict = await invoke(t, {}, '/api/v1/auth/password-reset/request', false,
    { headers: { 'x-matched-path': '/api/ping' } });
  assert.equal(conflict.statusCode, 400);
  const get = await invoke(t, {}, '/api/v1/auth/password-reset/complete', false, { method: 'GET' });
  assert.equal(get.statusCode, 404);
});
