'use strict';

// spirit/test/deskAgentModelsSearch.js
// goal/G27.17: deskAgent models travel as a bounded search. Red on today's code; claude-windows wrote it and builds it.
// The item's box (v2):
//   R1. the published state carries no model list, only the loaded model's entry (the Remote reads it for its warning,
//       the load check and the chat title).
//   R2. the Remote's picker is filled by a models search: the search box's text and the pressed filter icons.
//   R3. the answer is a bounded bucket with a partial flag; when partial the picker says more match.
//   R4. the loaded model always comes back, whatever the search.
//   R5. the answer names the marks present in the whole list, so the icons show only what applies.
//   R7. the answer fits one tunnelled reply (about 15 KB).
//
// THE SHAPES THIS RED NAMES: the state's `loaded` (the loaded entry, or null) in place of `models`; the verb
// models.search {text, marks} -> {models, more, marks, active, activeQuant, cached, load, test}; marks are
// desk-tested (the 🧵, recommended), vision, reasoning, audio; the Remote sends models.search as typed and pressed.
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

const OWED = 'OWED by goal/G27.17: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const APP = path.join(ROOT, 'spirit', 'run', 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const TUNNEL_STATE = 15000;
const COUNT = 400;
const LOADED = 'gpt-0007';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function bytesOf(x) { return Buffer.byteLength(JSON.stringify(x === undefined ? null : x), 'utf8'); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
function idOf(i) { return 'gpt-' + String(i).padStart(4, '0'); }

test.startTest('goal/G27.17: deskAgent models travel as a bounded search');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskagent-models-search-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}
function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }

// A plain OpenAI-compatible server listing COUNT models, as OpenAI's long list does.
const fake = http.createServer(function (req, res) {
  const answer = answerer(res);
  const at = new URL(req.url, 'http://x').pathname;
  req.resume();
  if (at.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL' } });
  if (at === '/v1/models') { const data = []; for (let i = 0; i < COUNT; i++) data.push({ id: idOf(i), object: 'model', owned_by: 'a-long-owner-name-for-size' }); return answer(200, { object: 'list', data: data }); }
  answer(404, { error: { message: 'not found' } });
});

const published = [];
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient && ask.deskClient.desk) {
      const verb = String(ask.deskClient.desk.verb);
      const verbs = deskVerbFiles();
      if (verb === 'AGENTS') return answer(200, { text: 'Rules.' });
      if (verb === 'AGENTS.introspect') return answer(200, { items: Object.keys(verbs).map(function (v) { return { key: v, label: verbs[v].description }; }), more: false });
      if (verb.indexOf('AGENTS.') === 0) return answer(200, verbs[verb.slice(7)] || {});
      return answer(200, { change: 1 });
    }
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'ollama agent node', publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent-search', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskAgent && r.body.deskAgent.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };

async function serverHalf() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { fake.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify({ persona: 'Levant', preamble: 'you are Levant', model: LOADED, answerTokens: 1000, bytesPerToken: 4, effort: [] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify([{ name: 'openai', url: 'http://127.0.0.1:' + fake.address().port + '/v1', key: 'k', use: true, model: LOADED, workspace: '' }]));
  // gpt-0001 tested 🧵 and reasoning, so two marks are present in the list; no model has vision or audio.
  const marked = []; for (let i = 0; i < COUNT; i++) marked.push({ id: idOf(i), quant: '', loaded: idOf(i) === LOADED, bytes: 0, task: '', vision: false, reasoning: i === 1, audio: false, recommended: i === 1, tested: i === 1 ? '2026-10-01T00:00:00.000Z' : '' });
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ pairs: { openai: { active: LOADED, activeQuant: '', studio: false, models: marked } } }));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  start();
  if (!await up()) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  await until(function () { return published.length > 0; }, 6000);
  await ask('models', {});
  await sleep(800);

  test.subHeading('R1. the published state carries no list, only the loaded entry');
  const last = published.filter(function (o) { return o && typeof o.connected === 'boolean'; }).pop() || {};
  const s = await ask('state', {});
  if (!Array.isArray(last.models) && last.loaded && last.loaded.id === LOADED && bytesOf(last) < TUNNEL_STATE) test.check('the published state has no models list, its loaded entry is ' + LOADED + ', ' + bytesOf(last) + ' bytes');
  else test.fail(OWED + 'the published state reads ' + bytesOf(last) + ' bytes, models ' + (Array.isArray(last.models) ? last.models.length : 'none') + ', loaded ' + short(last.loaded) + '; publishes dropped as too large: ' + published.filter(function (o) { return o && o.dropped; }).length);
  if (s && s.loaded && s.loaded.id === LOADED) test.check('state answers the loaded entry too');
  else test.fail(OWED + 'state answers loaded ' + short(s && s.loaded));

  test.subHeading('R3, R4, R7. a bounded search, the loaded model always in it');
  const all = await ask('models.search', { text: '', marks: [] });
  const ids = (all.models || []).map(function (m) { return m.id; });
  if (Array.isArray(all.models) && all.more === true && bytesOf(all) < TUNNEL_STATE && ids.indexOf(LOADED) !== -1) test.check('an empty search answers ' + ids.length + ' of ' + COUNT + ' with more true, ' + bytesOf(all) + ' bytes, ' + LOADED + ' among them');
  else test.fail(OWED + 'models.search {} answered ' + short({ count: ids.length, more: all.more, bytes: bytesOf(all), loaded: ids.indexOf(LOADED) !== -1, why: all.extra }));
  const some = await ask('models.search', { text: 'gpt-03', marks: [] });
  const someIds = (some.models || []).map(function (m) { return m.id; });
  if (some.more === false && someIds.filter(function (x) { return x !== LOADED; }).every(function (x) { return x.indexOf('gpt-03') === 0; }) && someIds.length === 101 && someIds.indexOf(LOADED) !== -1) test.check('text gpt-03 answers its 100 models and the loaded one, more false');
  else test.fail(OWED + 'models.search gpt-03 answered ' + someIds.length + ' models, more ' + some.more);

  test.subHeading('R2, R5. the marks: filtering, and which exist');
  const tested = await ask('models.search', { text: '', marks: ['desk-tested'] });
  const testedIds = (tested.models || []).map(function (m) { return m.id; }).sort().join(',');
  if (testedIds === ['gpt-0001', LOADED].sort().join(',')) test.check('marks desk-tested answers gpt-0001 and the loaded one');
  else test.fail(OWED + 'marks desk-tested answered ' + short(testedIds));
  if (Array.isArray(all.marks) && all.marks.slice().sort().join(',') === 'desk-tested,reasoning') test.check('the answer names the marks present in the whole list: desk-tested, reasoning');
  else test.fail(OWED + 'the answer names marks ' + short(all.marks));
}

// ── THE REMOTE ──────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0, hidden: false,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || { target: el }); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function clickOn(attrs) { return { target: { getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, closest: function () { return { getAttribute: function (n) { return n in attrs ? attrs[n] : null; } }; } }, preventDefault: function () {}, stopPropagation: function () {} }; }

async function faceHalf() {
  test.subHeading('R2, R3. the Remote fills its picker from models.search');
  const loadedEntry = { id: LOADED, quant: '', loaded: true, recommended: false, reasoning: false, vision: false, audio: false };
  const STATE = { connected: false, persona: 'Levant', model: LOADED, server: { url: 'http://o/v1', answers: true, error: '' }, connections: [{ name: 'openai', url: 'http://o/v1', use: true }], working: false, effort: { supported: false, level: 'medium' }, loaded: loadedEntry, active: LOADED, activeQuant: '', cached: false, load: {}, test: {} };
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core, keyTail: function (k) { return String(k).slice(-6); } }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  ctx.window.spiritFieldRules = fieldRules;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  behavior.mount(doc.getElementById('container'), {
    escapeHtml: kernel.core.util.escapeHtml, onPublished: function () { return function () {}; },
    fs: { loadFile: function () { return null; } },
    verb: function (name, body) {
      const a = body && body.ask && body.ask.deskAgent;
      if (name === 'jobs.api' && body && body.ask === 'api') return Promise.resolve({ status: 200, body: { desk: {}, deskAgent: {} } });
      const v = a ? Object.keys(a)[0] : '';
      if (v) calls.push({ verb: v, args: a[v] });
      if (v === 'state') return Promise.resolve({ status: 200, body: STATE });
      if (v === 'models.search') {
        const text = String((a[v] || {}).text || '');
        const list = text === 'gpt-03' ? [{ id: 'gpt-0300', quant: '', loaded: false }, loadedEntry] : [{ id: 'gpt-0000', quant: '', loaded: false }, { id: 'gpt-0001', quant: '', loaded: false, recommended: true }, loadedEntry];
        return Promise.resolve({ status: 200, body: { models: list, more: text !== 'gpt-03', marks: ['desk-tested', 'reasoning'], active: LOADED, activeQuant: '', cached: false, load: {}, test: {} } });
      }
      return Promise.resolve({ status: 200, body: { change: 1 } });
    },
  });
  for (let i = 0; i < 8; i++) { await settled(); await sleep(20); }
  const box = function () { return doc.getElementById('dur-models').innerHTML; };
  const searches = function () { return calls.filter(function (c) { return c.verb === 'models.search'; }); };
  if (searches().length >= 1 && /gpt-0001/.test(box()) && /more/i.test(box())) test.check('opened, it asks models.search and shows its answer, saying more models match');
  else test.fail(OWED + 'opened, it asked ' + short(calls.map(function (c) { return c.verb; })) + ' and shows ' + short(box()));
  const search = doc.getElementById('dur-model-search');
  search.value = 'gpt-03';
  search.fire('input', { target: search });
  for (let i = 0; i < 4; i++) { await settled(); await sleep(20); }
  const last = searches()[searches().length - 1];
  if (last && last.args.text === 'gpt-03' && /gpt-0300/.test(box()) && !/gpt-0001/.test(box())) test.check('typing gpt-03 sends models.search {text: gpt-03} and shows its answer');
  else test.fail(OWED + 'after typing the last search was ' + short(last) + ', the picker ' + short(box()));
  doc.getElementById('dur-models').fire('click', clickOn({ 'data-filter': 'reasoning' }));
  for (let i = 0; i < 4; i++) { await settled(); await sleep(20); }
  const marked = searches()[searches().length - 1];
  if (marked && Array.isArray(marked.args.marks) && marked.args.marks.indexOf('reasoning') !== -1) test.check('pressing the reasoning filter sends it as a mark');
  else test.fail(OWED + 'after the filter press the last search was ' + short(marked));
  const warn = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (!/No model is loaded/.test(warn)) test.check('with the loaded entry in the state, no "no model loaded" warning');
  else test.fail(OWED + 'the Remote warns no model is loaded although the state names ' + LOADED);
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); fake.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
