'use strict';

// spirit/test/deskAgentEffort.js
// goal/G27.8: effort, the answer's length, and the model search. Red on today's code; claude-windows wrote it and
// builds it (one agent). The item's box is the requirement:
//   R1. no new time limit on the model's answer (only abort ends it; not asserted here, nothing is owed).
//   R2. effort is the control for how much work a task gets: a slider in the configuration, per api/model that
//       supports it. Design A: a configuration table of api/model combinations with the request field each maps to
//       (OpenAI: reasoning_effort; Anthropic: a thinking budget; the studio: none). Levels off, low, medium, high;
//       off sends nothing. A combination not in the table: slider disabled, nothing extra sent. Only the mapped
//       field is added. The slider defaults to medium (Andy, 2026-10-17).
//   R3. design C: a reply that finishes on the length limit (finish_reason length) is marked truncated, never sent
//       as if complete.
//   R4. a model search above the picker, with filter icons for the marks a model carries; each list offers only
//       the filters that apply to it.
//
// THE SHAPES THIS RED NAMES (the box leaves them to the builder; named here so the red can be run):
//   - configuration.json carries `effort`: [{server, model, field}]. A row applies when its `server` is part of the
//     pair's url and its `model` begins the model's id; `field` is reasoning_effort or thinking.
//   - the level is kept per pair and model, on the pair in connection.json; unset reads medium.
//   - verb effort.set {model, level} on deskAgent; a level outside off/low/medium/high, or a model no row applies to,
//     is refused with its reason.
//   - the state carries effort {supported, level} for the model in use.
//   - thinking is sent as {type: 'enabled', budget_tokens}, the budget above zero and below the answer's length
//     mark, and larger for high than for medium.
//   - the Remote: in #dur-models, an <input id="dur-model-search"> before the picker, filtering the options by id
//     as typed (its input event); filter buttons carrying data-filter (desk-tested, vision, reasoning, audio),
//     pressed through a click on #dur-models; a range input id="dur-effort" (0 off .. 3 high) whose change sends
//     effort.set {model, level}, disabled when the state says unsupported.
// NOT ASSERTED: layout, words, icons.
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

const OWED = 'OWED by goal/G27.8: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const APP = path.join(ROOT, 'spirit', 'run', 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const NODE_NAME = 'ollama agent node';
const STUDIO_REPO = 'fake/Agent-9B-GGUF';
const ANSWER_TOKENS = 4096;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G27.8: the effort per api and model, the truncated mark, the model search');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskagenteffort-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}
function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function bodyOf(req, fn) { let raw = ''; req.on('data', function (c) { raw += c; }); req.on('end', function () { let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; } fn(b); }); }

// ── THE FAKE SERVERS: two plain OpenAI-compatible ones (openai, anthropic) and a studio ──
function fakePlain(ids) {
  const p = { ids: ids, chats: [], server: null };
  p.server = http.createServer(function (req, res) {
    bodyOf(req, function (body) {
      const answer = answerer(res);
      const at = new URL(req.url, 'http://x').pathname;
      if (at.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + at + ')' } });
      if (at === '/v1/models') return answer(200, { object: 'list', data: p.ids.map(function (id) { return { id: id, object: 'model' }; }) });
      if (at === '/v1/chat/completions' && req.method === 'POST') {
        p.chats.push(body);
        const last = body && Array.isArray(body.messages) ? String((body.messages[body.messages.length - 1] || {}).content || '') : '';
        const long = /make it long/.test(last);
        return answer(200, { choices: [{ index: 0, finish_reason: long ? 'length' : 'stop', message: { role: 'assistant', content: long ? 'the start of a long answer' : 'hello' } }] });
      }
      answer(404, { error: { message: 'not found' } });
    });
  });
  return p;
}
const openai = fakePlain(['gpt-x', 'gpt-y']);
const anthropic = fakePlain(['claude-z']);
const studioChats = [];
const studioServer = http.createServer(function (req, res) {
  bodyOf(req, function (body) {
    const answer = answerer(res);
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [{ repo_id: STUDIO_REPO, size_bytes: 9e9, has_vision: false, task: 'text-generation' }] });
    if (p === '/api/models/gguf-variants') return answer(200, { repo_id: STUDIO_REPO, variants: [{ quant: 'Q8_0', size_bytes: 9e9, downloaded: true }] });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: STUDIO_REPO, loaded: true, quant: 'Q8_0' }] });
    if (p === '/api/inference/status') return answer(200, { active_model: STUDIO_REPO, loaded: [STUDIO_REPO], gguf_variant: 'Q8_0', context_length: 8192 });
    if (p === '/v1/chat/completions' && req.method === 'POST') { studioChats.push(body); return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'studio hello' } }] }); }
    answer(404, { detail: 'not found' });
  });
});

// ── THE FAKE NODE ──────────────────────────────────────────────────────
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
    if (ask && ask.deskClient && ask.deskClient.desk) {
      const verb = String(ask.deskClient.desk.verb);
      const verbs = deskVerbFiles();
      if (verb === 'AGENTS') return answer(200, { text: 'Rules.' });
      if (verb === 'AGENTS.introspect') return answer(200, { items: Object.keys(verbs).map(function (v) { return { key: v, label: verbs[v].description }; }), more: false });
      if (verb.indexOf('AGENTS.') === 0) return answer(200, verbs[verb.slice(7)] || {});
      return answer(200, { change: 1 });
    }
    if (ask && ask.deskAgent && client) return client.ask({ deskAgent: ask.deskAgent }).then(function (r) { answer(r.status || 200, r.body || {}); }, function () { answer(500, {}); });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent-effort', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
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
function listen(server) { return new Promise(function (r) { server.listen(0, '127.0.0.1', r); }); }

// One chat round: what the server named was sent, and the answer's text.
async function chatOnce(server, text) {
  const before = server.chats.length;
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: text }] });
  let answer = {};
  await until(async function () { answer = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return answer.done === true; }, 8000);
  return { body: server.chats.slice(before)[0] || null, text: String(answer.text || '') };
}
async function useModel(id) {
  await ask('model.load', { id: id, quant: '' });
  await until(async function () { return (await ask('state', {})).model === id; }, 4000);
}

async function serverHalf() {
  await listen(node); await listen(openai.server); await listen(anthropic.server); await listen(studioServer);
  const OPENAI_URL = 'http://127.0.0.1:' + openai.server.address().port + '/v1';
  const ANTHROPIC_URL = 'http://127.0.0.1:' + anthropic.server.address().port + '/v1';
  const STUDIO_URL = 'http://127.0.0.1:' + studioServer.address().port + '/v1';
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  // The table: gpt-x on the openai server maps to reasoning_effort, claude- on the anthropic one to thinking; gpt-y
  // and the studio have no row.
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify({
    persona: 'Levant', preamble: 'you are Levant', model: 'gpt-x', answerTokens: ANSWER_TOKENS, bytesPerToken: 4,
    effort: [
      { server: '127.0.0.1:' + openai.server.address().port, model: 'gpt-x', field: 'reasoning_effort' },
      { server: '127.0.0.1:' + anthropic.server.address().port, model: 'claude-', field: 'thinking' },
    ],
  }, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify([
    { name: 'openai', url: OPENAI_URL, key: 'sk-o', use: true, model: 'gpt-x', workspace: '' },
    { name: 'anthropic', url: ANTHROPIC_URL, key: 'sk-a', use: false, model: 'claude-z', workspace: '' },
    { name: 'studio', url: STUDIO_URL, key: '', use: false, model: STUDIO_REPO, workspace: '' },
  ]));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  start();
  if (!await up()) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  await until(async function () { return ((await ask('models.search', { text: '', marks: [] })).models || []).length === 2; }, 6000);

  test.subHeading('1. medium by default, on a model the table names');
  const s0 = await ask('state', {});
  if (s0.effort && s0.effort.supported === true && s0.effort.level === 'medium') test.check('the state says effort supported, level medium, for gpt-x');
  else test.fail(OWED + 'the state carries effort ' + short(s0.effort));
  const c0 = await chatOnce(openai, 'hello');
  if (c0.body && c0.body.reasoning_effort === 'medium' && c0.body.model === 'gpt-x' && Number(c0.body.max_completion_tokens) === ANSWER_TOKENS && Array.isArray(c0.body.messages)) test.check('the chat asked gpt-x with reasoning_effort medium, the rest of the body as before');
  else test.fail(OWED + 'the chat to gpt-x sent ' + short(c0.body && { reasoning_effort: c0.body.reasoning_effort, model: c0.body.model, max_completion_tokens: c0.body.max_completion_tokens }));

  test.subHeading('2. effort.set: high, then off');
  const high = await ask('effort.set', { model: 'gpt-x', level: 'high' });
  const c1 = await chatOnce(openai, 'hello again');
  const kept = (readJson('connection.json') || []).filter(function (p) { return p && p.name === 'openai'; })[0];
  if (high.ok !== false && c1.body && c1.body.reasoning_effort === 'high') test.check('effort.set high: the next chat sends reasoning_effort high');
  else test.fail(OWED + 'effort.set high answered ' + short(high) + '; the chat sent ' + short(c1.body && c1.body.reasoning_effort));
  if (kept && JSON.stringify(kept).indexOf('high') !== -1) test.check('the level is kept on the openai pair in connection.json');
  else test.fail(OWED + 'connection.json holds for openai ' + short(kept));
  await ask('effort.set', { model: 'gpt-x', level: 'off' });
  const c2 = await chatOnce(openai, 'hello off');
  if (c2.body && !('reasoning_effort' in c2.body) && !('thinking' in c2.body)) test.check('effort off: nothing extra is sent');
  else test.fail(OWED + 'with effort off the chat sent ' + short(c2.body && { reasoning_effort: c2.body.reasoning_effort, thinking: c2.body.thinking }));
  const bad = await ask('effort.set', { model: 'gpt-x', level: 'max' });
  if (bad.ok === false && bad.extra && bad.extra.why) test.check('a level outside off/low/medium/high is refused: ' + bad.extra.why);
  else test.fail(OWED + 'effort.set level max answered ' + short(bad));
  await ask('effort.set', { model: 'gpt-x', level: 'medium' });

  test.subHeading('3. a model the table does not name: nothing extra, the slider disabled');
  await useModel('gpt-y');
  const s1 = await ask('state', {});
  const c3 = await chatOnce(openai, 'hello y');
  if (s1.effort && s1.effort.supported === false && c3.body && c3.body.model === 'gpt-y' && !('reasoning_effort' in c3.body) && !('thinking' in c3.body)) test.check('gpt-y: effort unsupported in the state, and nothing extra in its chat');
  else test.fail(OWED + 'gpt-y: state effort ' + short(s1.effort) + ', chat sent ' + short(c3.body && { model: c3.body.model, reasoning_effort: c3.body.reasoning_effort }));
  const notHere = await ask('effort.set', { model: 'gpt-y', level: 'high' });
  if (notHere.ok === false && notHere.extra && notHere.extra.why) test.check('effort.set for a model no row names is refused: ' + notHere.extra.why);
  else test.fail(OWED + 'effort.set for gpt-y answered ' + short(notHere));

  test.subHeading('4. the anthropic row: a thinking budget');
  await ask('connection.use', { name: 'anthropic' });
  await until(async function () { return (await ask('state', {})).model === 'claude-z'; }, 6000);
  const c4 = await chatOnce(anthropic, 'hello claude');
  const t4 = c4.body && c4.body.thinking;
  const room = c4.body ? Number(c4.body.max_completion_tokens || c4.body.max_tokens) : 0;
  if (t4 && t4.type === 'enabled' && Number(t4.budget_tokens) > 0 && Number(t4.budget_tokens) < room && !('reasoning_effort' in c4.body)) test.check('claude-z at medium: thinking enabled, budget ' + t4.budget_tokens + ' under the answer\'s ' + room);
  else test.fail(OWED + 'the chat to claude-z sent thinking ' + short(t4) + ' with room ' + room);
  await ask('effort.set', { model: 'claude-z', level: 'high' });
  const c5 = await chatOnce(anthropic, 'hello claude high');
  const t5 = c5.body && c5.body.thinking;
  if (t4 && t5 && Number(t5.budget_tokens) > Number(t4.budget_tokens) && Number(t5.budget_tokens) < room) test.check('at high the budget is larger: ' + t5.budget_tokens);
  else test.fail(OWED + 'at high the chat sent thinking ' + short(t5));

  test.subHeading('5. the studio: no row, nothing extra');
  await ask('connection.use', { name: 'studio' });
  await until(async function () { return ((await ask('models.search', { text: '', marks: [] })).models || []).some(function (m) { return m.id === STUDIO_REPO; }); }, 6000);
  const before = studioChats.length;
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'hello studio' }] });
  await until(async function () { const a = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return a.done === true; }, 8000);
  const sb = studioChats.slice(before)[0];
  if (sb && !('reasoning_effort' in sb) && !('thinking' in sb)) test.check('the studio is asked with neither reasoning_effort nor thinking');
  else test.fail(OWED + 'the studio was sent ' + short(sb && { reasoning_effort: sb.reasoning_effort, thinking: sb.thinking }));

  test.subHeading('6. a reply cut at the length limit is marked truncated');
  await ask('connection.use', { name: 'openai' });
  await until(async function () { return (await ask('state', {})).server && (await ask('state', {})).server.url.indexOf(String(openai.server.address().port)) !== -1; }, 6000);
  const c6 = await chatOnce(openai, 'make it long');
  if (/the start of a long answer/.test(c6.text) && /truncated/i.test(c6.text)) test.check('finish_reason length: the answer carries a truncated mark: ' + short(c6.text));
  else test.fail(OWED + 'a reply cut at the length limit reads ' + short(c6.text));
  const c7 = await chatOnce(openai, 'hello short');
  if (c7.text && !/truncated/i.test(c7.text)) test.check('a reply that stopped on its own carries no mark');
  else test.fail(OWED + 'a complete reply reads ' + short(c7.text));
}

// ── THE REMOTE: the slider, the search, the filters ────────────────────
function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
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
function optionIds(html) { const out = []; const re = /<option value="([^"|]*)\|/g; let m; while ((m = re.exec(html))) out.push(m[1]); return out.sort().join(','); }

async function mountRemote(effort) {
  const STATE = { connected: false, persona: 'Levant', model: 'gpt-x', server: { url: 'http://o/v1', answers: true, error: '' }, connections: [{ name: 'openai', url: 'http://o/v1', use: true }], effort: effort };
  const MODELS = { active: 'gpt-x', activeQuant: '', cached: false, load: {}, test: {}, models: [
    { id: 'gpt-x', quant: '', loaded: true, recommended: true, reasoning: true, vision: false, audio: false },
    { id: 'gpt-y', quant: '', loaded: false, recommended: false, reasoning: false, vision: false, audio: false },
    { id: 'gpt-z', quant: '', loaded: false, recommended: false, reasoning: true, vision: false, audio: false },
  ] };
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
    verb: function (name, body) {
      const a = body && body.ask && body.ask.deskAgent;
      if (name === 'jobs.api' && body && body.ask === 'api') return Promise.resolve({ status: 200, body: { desk: {}, deskAgent: {} } });
      const v = a ? Object.keys(a)[0] : '';
      if (v) calls.push({ verb: v, args: a[v] });
      // goal/G27.17: the picker asks models.search, and deskAgent does the matching; this fake answers as it would, by
      // text and by the marks pressed, naming the marks its whole list carries.
      const MARK = { 'desk-tested': 'recommended', vision: 'vision', reasoning: 'reasoning', audio: 'audio' };
      const searched = function (q) {
        const text = String((q && q.text) || ''); const marks = (q && q.marks) || [];
        const list = MODELS.models.filter(function (m) { return (!text || m.id.indexOf(text) !== -1) && marks.every(function (k) { return m[MARK[k]] === true; }); });
        return Object.assign({}, MODELS, { models: list, more: false, marks: Object.keys(MARK).filter(function (k) { return MODELS.models.some(function (m) { return m[MARK[k]] === true; }); }) });
      };
      const said = v === 'state' ? STATE : v === 'models' ? MODELS : v === 'models.search' ? searched(a[v]) : { change: 1 };
      return Promise.resolve({ status: 200, body: said });
    },
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  return { doc: doc, calls: calls };
}

async function faceHalf() {
  test.subHeading('7. the model search and its filters (R4)');
  const r = await mountRemote({ supported: true, level: 'medium' });
  const box = function () { return r.doc.getElementById('dur-models').innerHTML; };
  const html = box();
  const searchAt = html.search(/<input[^>]*id="dur-model-search"/);
  const pickerAt = html.indexOf('id="dur-model"');
  if (searchAt !== -1 && pickerAt !== -1 && searchAt < pickerAt) test.check('#dur-model-search sits above the picker');
  else test.fail(OWED + '#dur-models reads ' + short(html));
  const filters = ['desk-tested', 'vision', 'reasoning', 'audio'].filter(function (f) { return new RegExp('data-filter="' + f + '"').test(html); });
  if (filters.join() === 'desk-tested,reasoning') test.check('only the filters that apply: desk-tested and reasoning, no vision, no audio');
  else test.fail(OWED + 'the filters offered: ' + short(filters));
  const search = r.doc.getElementById('dur-model-search');
  search.value = 'gpt-y';
  search.fire('input', { target: search });
  await settled();
  if (optionIds(box()) === 'gpt-y') test.check('typing gpt-y leaves gpt-y alone in the picker');
  else test.fail(OWED + 'after typing gpt-y the picker offers ' + short(optionIds(box())));
  search.value = '';
  search.fire('input', { target: search });
  await settled();
  r.doc.getElementById('dur-models').fire('click', clickOn({ 'data-filter': 'reasoning' }));
  await settled();
  if (optionIds(box()) === 'gpt-x,gpt-z') test.check('the reasoning filter leaves gpt-x and gpt-z');
  else test.fail(OWED + 'with the reasoning filter the picker offers ' + short(optionIds(box())));
  r.doc.getElementById('dur-models').fire('click', clickOn({ 'data-filter': 'reasoning' }));
  r.doc.getElementById('dur-models').fire('click', clickOn({ 'data-filter': 'desk-tested' }));
  await settled();
  if (optionIds(box()) === 'gpt-x') test.check('the desk-tested filter, alone, leaves gpt-x');
  else test.fail(OWED + 'with the desk-tested filter the picker offers ' + short(optionIds(box())));

  test.subHeading('8. the effort slider (R2)');
  const allHtml = function (doc) { return ['dur-models', 'dur-tab-configure'].map(function (id) { return doc.getElementById(id).innerHTML; }).join('\n'); };
  const on = allHtml(r.doc);
  const slider = /<input[^>]*type="range"[^>]*id="dur-effort"|<input[^>]*id="dur-effort"[^>]*type="range"/.exec(on);
  if (slider && !/disabled/.test(slider[0]) && /value="2"/.test(on.slice(slider.index, slider.index + 300))) test.check('the configure tab has the effort slider, enabled, at medium');
  else test.fail(OWED + 'no enabled #dur-effort range at medium: ' + short(on));
  const range = r.doc.getElementById('dur-effort');
  range.value = '3';
  const n0 = r.calls.length;
  range.fire('change', { target: range });
  await settled();
  const sent = r.calls.slice(n0).filter(function (c) { return c.verb === 'effort.set'; })[0];
  if (sent && sent.args.model === 'gpt-x' && sent.args.level === 'high') test.check('moving it to high sends effort.set {model: gpt-x, level: high}');
  else test.fail(OWED + 'moving the slider sent ' + short(r.calls.slice(n0)));
  const off = await mountRemote({ supported: false, level: 'medium' });
  const offHtml = allHtml(off.doc);
  const offSlider = /<input[^>]*id="dur-effort"[^>]*>/.exec(offHtml);
  if (offSlider && /disabled/.test(offSlider[0])) test.check('for a model the table does not name, the slider is disabled');
  else test.fail(OWED + 'with effort unsupported the slider reads ' + short(offSlider ? offSlider[0] : offHtml));
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); openai.server.close(); anthropic.server.close(); studioServer.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
