'use strict';

// spirit/test/deskUnslothRecommend.js
// goal/G10.9: test tool calling of the allowed models; the desk-recommended mark. Red on today's code (d0c3a4b7);
// claude-windows wrote it and builds it (one agent). The item's box, Andy, 2026-10-12:
//   - "we need to offer a precise selection of models, that includes the quantization/flavor as well?"; only the
//     downloaded ones: "yes. i'll download extra flavors manually, if needed."
//   - "a list deskUnsloth keeps, (the cached list) where we mark models as desk-recommended, with the desk-icon
//     (ICON.THREAD:🧵)"; the result "a mark beside each model in the configure selector, stored in the selectors cache
//     file."; set by "a test, there is no use of it all if a model is not capable of using desk properly."
//   - "run it from a [test] button, and utomatically connect/disconnect Levant from the desk, depending on the outcome."
//   - "Connect should be refused while the loaded model has no 🧵."
//   - "the test button should disconnect Levant from desk before testing, and it should be arm-able, to make sure the
//     disconnect is wanted."
//
// WHAT IS ASSERTED (read live from the studio on 2026-10-12: api/models/gguf-variants?repo_id lists each variant with
// quant and downloaded; api/inference/status names gguf_variant; api/inference/load takes gguf_variant)
//   1. models: one entry per downloaded model and quantization, the loaded pair marked from status.
//   2. model.load {id, quant} sends the studio model_path and gguf_variant.
//   3. model.test {id, quant} answers at once; loads the pair, asks the model once with its tools; a real tool call
//      back marks the pair recommended in models.json and connects Levant; text back marks it not and disconnects.
//   4. connect on is refused while the loaded pair has no mark; taken when it has one; at start it is connected only
//      when models.json says the loaded pair is recommended.
//   5. the app: each option names its quantization and carries 🧵 when recommended; a [test] button, armed by the
//      first click, sends model.test for the chosen pair on the second.
//   6. model.test disconnects Levant before it tests: one signoff, the state published connected false while running.
// NOT ASSERTED: the test prompt's words; layout.
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

const OWED = 'OWED by goal/G10.9: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const APP = path.join(ROOT, 'spirit', 'run', 'shell', 'deskUnslothRemote', 'deskUnslothRemote.js');
const NODE_NAME = 'ollama agent node';
const REPO = 'fake/Agent-9B-GGUF';
const GOOD = 'Q8_0';     // answers with a real tool call
const BAD = 'Q4_K_M';    // writes its tool call as text
const MISSING = 'Q2_K';  // offered by the hub, not downloaded
const THREAD = kernel.core.const.ICON.THREAD;
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: REPO, answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G10.9: tool calling tested per model and quantization; 🧵 decides Connect');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothrecommend-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}

// ── THE FAKE STUDIO, as read live 2026-10-12 ───────────────────────────
const studio = { loads: [], chats: [] };
let loaded = { model: REPO, variant: BAD };
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [{ repo_id: REPO, size_bytes: 15e9, has_vision: false, task: 'text-generation' }] });
    if (p === '/api/models/gguf-variants') {
      if (u.searchParams.get('repo_id') !== REPO) return answer(404, { detail: 'no such repo' });
      return answer(200, { repo_id: REPO, default_variant: BAD, variants: [
        { quant: GOOD, size_bytes: 9e9, downloaded: true, filename: 'a-Q8_0.gguf' },
        { quant: BAD, size_bytes: 5e9, downloaded: true, filename: 'a-Q4_K_M.gguf' },
        { quant: MISSING, size_bytes: 3e9, downloaded: false, filename: 'a-Q2_K.gguf' },
      ] });
    }
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: REPO, loaded: true, quant: loaded.variant }] });
    if (p === '/api/inference/status') return answer(200, { active_model: loaded.model, loaded: [loaded.model], gguf_variant: loaded.variant, context_length: 8192, supports_reasoning: false });
    if (p === '/api/inference/load' && req.method === 'POST') {
      studio.loads.push(body);
      return setTimeout(function () { loaded = { model: body.model_path, variant: body.gguf_variant || BAD }; answer(200, { status: 'loaded' }); }, 300);
    }
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push({ variant: loaded.variant, body: body });
      const tools = body && Array.isArray(body.tools) && body.tools.length;
      if (tools && loaded.variant === GOOD) {
        return answer(200, { choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: body.tools[0].function.name, arguments: '{}' } }] } }] });
      }
      return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '<tool_call>\n<function=desk_items_search>\n</function>\n</tool_call>' } }] });
    }
    answer(404, { detail: 'not found' });
  });
});

// ── THE FAKE NODE ──────────────────────────────────────────────────────
let client = null;
const published = [];
const deskWords = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient && ask.deskClient.desk) {
      const verb = String(ask.deskClient.desk.verb);
      deskWords.push(verb);
      const verbs = deskVerbFiles();
      if (verb === 'AGENTS') return answer(200, { text: 'Rules.' });
      if (verb === 'AGENTS.introspect') return answer(200, { items: Object.keys(verbs).map(function (v) { return { key: v, label: verbs[v].description }; }), more: false });
      if (verb.indexOf('AGENTS.') === 0) return answer(200, verbs[verb.slice(7)] || {});
      return answer(200, { change: 1 });
    }
    if (ask && ask.deskUnsloth && client) return client.ask({ deskUnsloth: ask.deskUnsloth }).then(function (r) { answer(r.status || 200, r.body || {}); }, function () { answer(500, {}); });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskUnsloth', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  out.stderr = ''; out.code = null;
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskUnsloth: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };
// Since goal/G18.6 one list per pair: the old single connection is the pair named studio.
function knownFile() { try { return JSON.parse(fs.readFileSync(path.join(state, 'models.json'), 'utf8')).pairs.studio || null; } catch (e) { return null; } }
function pairIn(list, id, quant) { return (list || []).filter(function (m) { return m.id === id && m.quant === quant; })[0]; }

async function serverHalf() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studioServer.address().port + '/v1', key: 'k' }));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not start: ' + short(out.stderr)); return; }

  test.subHeading('1. one entry per downloaded model and quantization');
  let m = await ask('models', {});
  await until(function () { return !!knownFile(); }, 5000);
  m = await ask('models', {});
  const pairs = (m.models || []).map(function (x) { return x.id + ' ' + x.quant; }).sort();
  if (JSON.stringify(pairs) === JSON.stringify([REPO + ' ' + BAD, REPO + ' ' + GOOD].sort())) test.check('models lists ' + pairs.join(' and ') + ', not the one not downloaded');
  else test.fail(OWED + 'models listed ' + short(pairs));
  const lp = pairIn(m.models, REPO, BAD);
  const op = pairIn(m.models, REPO, GOOD);
  if (lp && lp.loaded === true && op && op.loaded === false) test.check('the loaded pair is marked from the studio status gguf_variant');
  else test.fail(OWED + 'loaded flags ' + short(m.models));

  test.subHeading('2. model.load names the quantization');
  await ask('model.load', { id: REPO, quant: BAD });
  await until(function () { return studio.loads.length >= 1; }, 3000);
  if (studio.loads[0] && studio.loads[0].model_path === REPO && studio.loads[0].gguf_variant === BAD) test.check('the studio load carries model_path and gguf_variant');
  else test.fail(OWED + 'the load sent ' + short(studio.loads[0]));

  test.subHeading('3. model.test: a real tool call marks 🧵 and connects; text clears it and disconnects');
  const t0 = Date.now();
  const bad = await ask('model.test', { id: REPO, quant: BAD });
  if (bad.ok !== false && Date.now() - t0 < 2000) test.check('model.test answers at once');
  else test.fail(OWED + 'model.test answered ' + short(bad) + ' after ' + (Date.now() - t0) + ' ms');
  await until(function () { const k = knownFile(); const e = k && pairIn(k.models, REPO, BAD); return !!(e && e.tested); }, 8000);
  const kb = knownFile();
  const eb = kb && pairIn(kb.models, REPO, BAD);
  const sb = await ask('state', {});
  if (eb && eb.recommended === false && sb.connected === false && studio.chats.some(function (c) { return c.variant === BAD && Array.isArray(c.body.tools) && c.body.tools.length; })) test.check('a model that writes its call as text: recommended false in models.json, Levant disconnected');
  else test.fail(OWED + 'after testing ' + BAD + ': entry ' + short(eb) + ', state ' + short(sb));
  const good = await ask('model.test', { id: REPO, quant: GOOD });
  await until(function () { const k = knownFile(); const e = k && pairIn(k.models, REPO, GOOD); return !!(e && e.tested); }, 8000);
  const kg = knownFile();
  const eg = kg && pairIn(kg.models, REPO, GOOD);
  const sg = await ask('state', {});
  if (good.ok !== false && eg && eg.recommended === true && sg.connected === true && loaded.variant === GOOD) test.check('a model that calls the tool for real: loaded, recommended true, Levant connected');
  else test.fail(OWED + 'after testing ' + GOOD + ': entry ' + short(eg) + ', state ' + short(sg) + ', loaded ' + short(loaded));

  test.subHeading('4. Connect follows 🧵');
  await ask('connect', { on: false });
  await ask('model.load', { id: REPO, quant: BAD });
  await until(function () { return loaded.variant === BAD; }, 3000);
  await ask('models', {}); await sleep(400);
  const refusedOn = await ask('connect', { on: true });
  const s1 = await ask('state', {});
  if (refusedOn.ok === false && s1.connected === false) test.check('connect on is refused while the loaded pair has no 🧵');
  else test.fail(OWED + 'connect on with ' + BAD + ' loaded answered ' + short(refusedOn) + ', state ' + short(s1));
  await ask('model.load', { id: REPO, quant: GOOD });
  await until(function () { return loaded.variant === GOOD; }, 3000);
  await ask('models', {}); await sleep(400);
  const takenOn = await ask('connect', { on: true });
  if (takenOn.connected === true) test.check('and taken while it has one');
  else test.fail(OWED + 'connect on with ' + GOOD + ' loaded answered ' + short(takenOn));
  await stop();
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not restart'); return; }
  const s2 = await ask('state', {});
  await stop();
  loaded = { model: REPO, variant: BAD };
  const k = knownFile(); k.active = REPO; k.activeQuant = BAD; fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ pairs: { studio: k } }));
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not restart'); return; }
  const s3 = await ask('state', {});
  if (s2.connected === true && s3.connected === false) test.check('at start it is connected only when models.json says the loaded pair is recommended');
  else test.fail(OWED + 'at start with the 🧵 pair ' + short(s2) + ', with the other ' + short(s3));
  await stop();

  test.subHeading('6. the test disconnects Levant first');
  loaded = { model: REPO, variant: GOOD };
  const k6 = knownFile(); k6.active = REPO; k6.activeQuant = GOOD; fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ pairs: { studio: k6 } }));
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not restart'); return; }
  const before6 = await ask('state', {});
  published.length = 0;
  const signoffsBefore = deskWords.filter(function (w) { return w === 'signoff'; }).length;
  await ask('model.test', { id: REPO, quant: GOOD });
  await until(function () { return published.some(function (o) { return o.test && o.test.state === 'passed'; }); }, 8000);
  const whileRunning = published.filter(function (o) { return o.test && o.test.state === 'running'; });
  const signoffs = deskWords.filter(function (w) { return w === 'signoff'; }).length - signoffsBefore;
  if (before6.connected === true && whileRunning.length && whileRunning.every(function (o) { return o.connected === false; }) && signoffs === 1) test.check('a test of a connected Levant signs him off first: connected false while it runs, one signoff');
  else test.fail(OWED + 'connected before ' + short(before6.connected) + ', while running ' + short(whileRunning.map(function (o) { return o.connected; })) + ', signoffs ' + signoffs);
  await stop();
}

// ── THE APP ────────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
async function faceHalf() {
  test.subHeading('5. the app: 🧵 and the quantization in the selector, a [test] button');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core, keyTail: function (x) { return String(x).slice(-6); } }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  const STATE = { connected: true, persona: 'Levant', model: REPO, server: { url: 'u', answers: true, error: '' } };
  const MODELS = { active: REPO, cached: false, load: {}, models: [
    { id: REPO, quant: GOOD, loaded: true, bytes: 9e9, task: 'text-generation', recommended: true, tested: '2026-10-12T00:00:00Z' },
    { id: REPO, quant: BAD, loaded: false, bytes: 5e9, task: 'text-generation', recommended: false, tested: '2026-10-12T00:00:00Z' },
  ] };
  const calls = [];
  behavior.mount(doc.getElementById('container'), {
    escapeHtml: kernel.core.util.escapeHtml, onPublished: function () {},
    fs: { loadFile: function () { return null; } },
    verb: function (name, body) {
      calls.push({ name: name, body: body });
      if (name === 'jobs.api' && body && body.ask === 'api') return Promise.resolve({ status: 200, body: { deskUnsloth: {} } });
      const a = body && body.ask && body.ask.deskUnsloth;
      const v = a ? Object.keys(a)[0] : '';
      if (v === 'state') return Promise.resolve({ status: 200, body: STATE });
      if (v === 'models') return Promise.resolve({ status: 200, body: MODELS });
      return Promise.resolve({ status: 200, body: {} });
    },
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const sel = doc.getElementById('dur-models').innerHTML;
  const opts = sel.match(/<option[^>]*>[^<]*<\/option>/g) || [];
  const goodOpt = opts.filter(function (o) { return o.indexOf(GOOD) !== -1; })[0] || '';
  const badOpt = opts.filter(function (o) { return o.indexOf(BAD) !== -1; })[0] || '';
  if (opts.length === 2 && goodOpt.indexOf(THREAD) !== -1 && badOpt && badOpt.indexOf(THREAD) === -1) test.check('each option names its quantization; 🧵 beside the recommended one only');
  else test.fail(OWED + 'the options read ' + short(opts));
  if (/id="dur-test"/.test(sel)) test.check('a [test] button beside the selector');
  else test.fail(OWED + 'no [test] button in ' + short(sel));
  const before = calls.length;
  const sentOf = function () { return calls.slice(before).map(function (c) { const a = c.body && c.body.ask && c.body.ask.deskUnsloth; return a && a['model.test']; }).filter(Boolean); };
  doc.getElementById('dur-test').fire('click', {});
  await settled();
  const armedHtml = doc.getElementById('dur-models').innerHTML;
  if (!sentOf().length && /id="dur-test"[^>]*data-armed="1"/.test(armedHtml)) test.check('the first click on [test] arms it and sends nothing');
  else test.fail(OWED + 'after one click: sent ' + short(sentOf()) + ', button ' + short((/<button[^>]*id="dur-test"[^>]*>[^<]*/.exec(armedHtml) || [''])[0]));
  doc.getElementById('dur-test').fire('click', {});
  await settled();
  const sent = sentOf()[0];
  if (sentOf().length === 1 && sent.id === REPO && (sent.quant === GOOD || sent.quant === BAD)) test.check('the second click sends model.test for the chosen model and quantization');
  else test.fail(OWED + 'after two clicks: ' + short(calls.slice(before)));
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); studioServer.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
