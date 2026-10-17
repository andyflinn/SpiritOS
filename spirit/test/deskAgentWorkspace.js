'use strict';

// spirit/test/deskAgentWorkspace.js
// goal/G14.10. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   a pair in connection.json keeps an optional workspace beside its key ({name, url, key, use, model, workspace});
//   connection.set takes workspace; the Remote's connect tab has a Workspace field beside the key and sends it;
//   every call made to a pair whose workspace is set carries the header anthropic-workspace-id: <workspace> (the model
//   list calls, the chat call, the probe), and a pair without one sends no such header at all;
//   the Remote shows deskAgent's own reason when the model list is refused, not the generic "text required".
//
// WHERE THE REASON WAS LOST (read at 59b5a51d): deskAgent refuses models with refused(why), a bad-request whose
// reason rides in extra.why; appServer's refusal() keeps extra and sets error to the catalogue's first wording for
// bad-request ("text required", js/spiritErrors.js); the Remote's deskAgentRemoteDrawModels draws got.error, so the
// reason never reaches the screen. Asserted end to end: a real deskAgent refused by a 401 stand-in, the Remote
// mounted over it.
//
// WHAT IS ASSERTED
//   1. a pair without a workspace: the probe, the model list and the chat are all made, and none carries the header.
//   2. a pair saved with workspace wrkspc_test: connection.set takes it; connection.json keeps it on the pair; the
//      probe, the model list calls and the chat call all carry anthropic-workspace-id: wrkspc_test.
//   2b. every call, to every server, carries anthropic-version: 2023-06-01 (Andy's A: Anthropic's model list wants it).
//   3. the model list refused (401): the models ask's reason is deskAgent's own, and the Remote's model box shows it,
//      never "text required".
//   4. the connect tab: a Workspace input (dur-server-workspace) beside the key, empty at first; Save sends it in
//      connection.set.
// NOT ASSERTED: layout, words beyond deskAgent's own reason; whether the published state carries the workspace.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');
const fieldRules = require('../run/js/fieldRules.js');

const OWED = 'OWED by goal/G14.10: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const APP = path.join(ROOT, 'spirit', 'run', 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'gpt-x', answerTokens: 100, bytesPerToken: 4 };
const WORKSPACE = 'wrkspc_test';
const HEADER = 'anthropic-workspace-id';
const VERSION_HEADER = 'anthropic-version';
const VERSION = '2023-06-01';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G14.10: a workspace kept on a pair and sent as anthropic-workspace-id; the model list\'s refusal says why');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothworkspace-'));

function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function bodyOf(req, fn) { let raw = ''; req.on('data', function (c) { raw += c; }); req.on('end', function () { let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; } fn(b); }); }

// ── THE STAND-INS: a plain OpenAI server that records every request's headers, and one that refuses with a 401 ──
function plainServer(seen) {
  return http.createServer(function (req, res) {
    bodyOf(req, function (body) {
      const answer = answerer(res);
      const p = new URL(req.url, 'http://x').pathname;
      seen.push({ method: req.method, path: p, headers: req.headers });
      if (p.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + p + ')' } });
      if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: 'gpt-x', object: 'model' }] });
      if (p === '/v1/chat/completions' && req.method === 'POST') return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'hello' } }] });
      answer(200, { ok: true });
    });
  });
}
const plainSeen = [];
const workSeen = [];
const plain = plainServer(plainSeen);
const work = plainServer(workSeen);
const refuser = http.createServer(function (req, res) { bodyOf(req, function () { answerer(res)(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }); }); });

// ── THE FAKE NODE: jobs.api asks of deskAgent go to it; the desk is not asked here ──
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskAgent && r.body.deskAgent.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };
function readJson(name) { try { return JSON.parse(fs.readFileSync(path.join(state, name), 'utf8')); } catch (e) { return null; } }
function ids(m) { return ((m && m.models) || []).map(function (x) { return x.id; }).sort().join(','); }

// The three kinds of call: the probe (a GET of the url itself), the model list, the chat.
function kinds(seen) {
  return {
    probe: seen.filter(function (s) { return s.method === 'GET' && s.path === '/v1'; }),
    list: seen.filter(function (s) { return s.path === '/v1/models' || s.path === '/api/models/cached-gguf'; }),
    chat: seen.filter(function (s) { return s.method === 'POST' && s.path === '/v1/chat/completions'; }),
  };
}
async function exercise(name, url, key, workspace) {
  const args = { name: name, url: url, key: key };
  if (workspace !== undefined) args.workspace = workspace;
  const set = await ask('connection.set', args);
  await until(async function () { return ids(await ask('models.search', { text: '', marks: [] })) === 'gpt-x'; }, 6000);
  await ask('model.load', { id: 'gpt-x', quant: '' });
  await sleep(200);
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'hello there' }] });
  await until(async function () { const a = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return a.done === true; }, 8000);
  return set;
}

async function serverHalf() {
  for (const s of [node, plain, work, refuser]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  const PLAIN_URL = 'http://127.0.0.1:' + plain.address().port + '/v1';
  const WORK_URL = 'http://127.0.0.1:' + work.address().port + '/v1';
  const REFUSER_URL = 'http://127.0.0.1:' + refuser.address().port + '/v1';
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  start();
  if (!await up()) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return null; }

  test.subHeading('1. a pair without a workspace sends no such header');
  const plainSet = await exercise('plain', PLAIN_URL, 'k-plain');
  const pk = kinds(plainSeen);
  if (plainSet.answers === true && pk.probe.length && pk.list.length && pk.chat.length) test.check('the plain pair: the probe, the model list and the chat were all made');
  else test.fail('the world: the plain pair answered ' + short(plainSet) + '; calls seen ' + short(plainSeen.map(function (s) { return s.method + ' ' + s.path; })));
  const carrying = plainSeen.filter(function (s) { return HEADER in s.headers; });
  if (plainSeen.length && carrying.length === 0) test.check('none of its ' + plainSeen.length + ' calls carries ' + HEADER);
  else test.fail(OWED + 'a pair without a workspace sent ' + HEADER + ' on ' + short(carrying.map(function (s) { return s.path + '=' + s.headers[HEADER]; })));

  test.subHeading('2. a pair saved with workspace ' + WORKSPACE);
  const workSet = await exercise('work', WORK_URL, 'k-work', WORKSPACE);
  if (workSet.answers === true) test.check('connection.set {name, url, key, workspace} is taken');
  else test.fail(OWED + 'connection.set with a workspace answered ' + short(workSet));
  const file = readJson('connection.json');
  const pair = Array.isArray(file) ? file.filter(function (c) { return c && c.name === 'work'; })[0] : null;
  if (pair && pair.workspace === WORKSPACE && pair.key === 'k-work') test.check('connection.json keeps the workspace on the pair, beside its key');
  else test.fail(OWED + 'connection.json reads ' + short(file));
  const wk = kinds(workSeen);
  const marked = function (list) { return list.length > 0 && list.every(function (s) { return s.headers[HEADER] === WORKSPACE; }); };
  const said = function (list) { return short(list.map(function (s) { return s.method + ' ' + s.path + ' ' + HEADER + '=' + (s.headers[HEADER] === undefined ? '(none)' : s.headers[HEADER]); })); };
  if (marked(wk.probe)) test.check('the probe carries ' + HEADER + ': ' + WORKSPACE);
  else test.fail(OWED + 'the probe: ' + said(wk.probe));
  if (marked(wk.list)) test.check('the model list calls carry it');
  else test.fail(OWED + 'the model list calls: ' + said(wk.list));
  if (marked(wk.chat)) test.check('the chat call carries it');
  else test.fail(OWED + 'the chat call: ' + said(wk.chat));
  if (marked(workSeen)) test.check('every one of the ' + workSeen.length + ' calls to that pair carries it');
  else test.fail(OWED + 'calls to the workspace pair: ' + said(workSeen.filter(function (s) { return s.headers[HEADER] !== WORKSPACE; })));

  // Andy's A (box v2): Anthropic's model list wants its API version, so every call to every server carries it.
  test.subHeading('2b. every call, to every server, carries ' + VERSION_HEADER + ': ' + VERSION);
  const unversioned = plainSeen.concat(workSeen).filter(function (s) { return s.headers[VERSION_HEADER] !== VERSION; });
  if (plainSeen.length && workSeen.length && unversioned.length === 0) test.check('all ' + (plainSeen.length + workSeen.length) + ' calls carry it, with or without a workspace');
  else test.fail(OWED + 'calls without ' + VERSION_HEADER + ': ' + short(unversioned.map(function (s) { return s.method + ' ' + s.path; })));

  test.subHeading('3. the model list refused: deskAgent\'s own reason');
  await ask('connection.set', { name: 'refuser', url: REFUSER_URL, key: 'k-bad' });
  let refusedList = {};
  await until(async function () { refusedList = await ask('models.search', { text: '', marks: [] }); return refusedList.ok === false; }, 6000);
  const why = String((refusedList.extra && refusedList.extra.why) || '');
  if (refusedList.ok === false && /could not be read/.test(why)) test.check('the models ask is refused with deskAgent\'s reason: ' + short(why));
  else test.fail('the world: the models ask answered ' + short(refusedList));
  return { refused: refusedList };
}

// ── THE REMOTE ─────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
// answer(verb, args) gives deskAgent's answer body, or a promise of {status, body}.
async function mount(answer) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core, keyTail: function (k) { return String(k).slice(-6); } }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  ctx.window.spiritFieldRules = fieldRules;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  behavior.mount(doc.getElementById('container'), {
    escapeHtml: kernel.core.util.escapeHtml, onPublished: function () {},
    fs: { loadFile: function () { return null; } },
    armUntilElsewhere: function () {},
    verb: function (name, body) {
      if (name === 'jobs.api' && body && body.ask === 'api') return Promise.resolve({ status: 200, body: { deskAgent: {} } });
      const a = body && body.ask && body.ask.deskAgent;
      const v = a ? Object.keys(a)[0] : '';
      if (v) calls.push({ verb: v, args: a[v] });
      return Promise.resolve(answer(v, a ? a[v] : {}));
    },
  });
  for (let i = 0; i < 8; i++) { await settled(); await sleep(25); }
  return { doc: doc, calls: calls };
}

async function faceHalf(world) {
  if (world) {
    test.subHeading('3b. the Remote over the refusing deskAgent');
    const live = await mount(function (v, args) { const q = {}; q[v] = args || {}; return client.ask({ deskAgent: q }); });
    await until(async function () { return /could not be read/.test(live.doc.getElementById('dur-models').innerHTML); }, 4000);
    const box = live.doc.getElementById('dur-models').innerHTML;
    if (/model list could not be read/.test(box) && !/text required/.test(box)) test.check('the model box shows deskAgent\'s reason, not "text required"');
    else test.fail(OWED + 'the model box reads ' + short(box) + ' (the refusal was ' + short(world.refused) + ')');
  }

  test.subHeading('4. the connect tab\'s Workspace field');
  const STATE = { connected: false, persona: 'Levant', model: 'gpt-x', server: { url: 'http://o/v1', answers: true, error: '' }, connections: [{ name: 'openai', url: 'http://o/v1', use: true }] };
  const MODELS = { active: 'gpt-x', activeQuant: '', cached: false, load: {}, test: {}, models: [{ id: 'gpt-x', quant: '', loaded: true }] };
  const face = await mount(function (v) {
    const body = v === 'state' ? STATE : v === 'models' ? MODELS : v === 'connection.set' ? { url: 'http://n/v1', answers: true, error: '' } : { change: 1 };
    return { status: 200, body: body };
  });
  const form = face.doc.getElementById('dur-tab-connect').innerHTML;
  if (/<input[^>]*id="dur-server-workspace"/.test(form) && /id="dur-server-key"/.test(form)) test.check('the connect tab has a Workspace input (dur-server-workspace) beside the key');
  else test.fail(OWED + 'the connect tab reads ' + short(form));
  if (face.doc.getElementById('dur-server-workspace').value === '') test.check('it is empty at first');
  else test.fail(OWED + 'the workspace field starts as ' + short(face.doc.getElementById('dur-server-workspace').value));
  const n0 = face.calls.length;
  face.doc.getElementById('dur-pair-name').value = 'anthropic';
  face.doc.getElementById('dur-server-url').value = 'http://n/v1';
  face.doc.getElementById('dur-server-key').value = 'sk-n';
  face.doc.getElementById('dur-server-workspace').value = WORKSPACE;
  face.doc.getElementById('dur-server-save').fire('click', {});
  await settled(); await sleep(20); await settled();
  const sent = face.calls.slice(n0).filter(function (c) { return c.verb === 'connection.set'; })[0];
  if (sent && sent.args.name === 'anthropic' && sent.args.url === 'http://n/v1' && sent.args.key === 'sk-n' && sent.args.workspace === WORKSPACE) test.check('Save sends connection.set {name, url, key, workspace}');
  else test.fail(OWED + 'Save sent ' + short(face.calls.slice(n0)));
}

(async function () { const world = await serverHalf(); await faceHalf(world); })().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); plain.close(); work.close(); refuser.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
