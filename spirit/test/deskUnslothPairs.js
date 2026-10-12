'use strict';

// spirit/test/deskUnslothPairs.js
// goal/G18.6: deskUnslothRemote refinements. Red on today's code (006248a3); claude-windows wrote it and builds it
// (one agent). The item's box (v4), Andy, 2026-10-12: "i have an OpenAI account with 10 bucks to spend on it. I want my
// Account URL/token pairs saved in connection.json, now an array. i want to maintain that array in the connect tab.";
// asked whether the available-models list is kept by account as well, answered yes; on naming the pairs: "good Idea,
// yes."; "i have a hard cap on my OpenAI account" (no spending guard here); "the OpenAI caveats are noted. and
// accepted." (a plain OpenAI server has no studio routes: its list is /v1/models, and choosing a model loads nothing).
//
// WHAT IS ASSERTED
//   1. an old connection.json, one {url, key}, and an old models.json, one list, are read as one pair named studio:
//      the state lists it in use, and the models are still there. No key in the state.
//   2. connection.set {name, url, key} adds a pair and uses it; connection.json is then an array of {name, url, key};
//      a name over the label limit, or none, is refused with its reason.
//   3. a plain OpenAI server: models lists its /v1/models; model.load sets the model without a load; model.test marks
//      🧵 on that pair.
//   4. per pair: connection.use {name} brings back that pair's list, its chosen model and its marks; a switch
//      disconnects Levant.
//   5. connection.remove {name} takes a pair out; removing the pair in use is refused.
//   7. goal/G18.7: a plain OpenAI server is sent max_completion_tokens, never max_tokens (OpenAI refuses it, found live
//      2026-10-12), in the test and in the chat; the studio keeps max_tokens; a model whose answer counts reasoning
//      tokens is marked reasoning in its pair's list (Andy: "yes add reasoning.").
//   6. the connect tab: the pairs listed by name with use and remove, the one in use marked, the key never drawn; the
//      add form (name marked data-field="label", url, key) sends connection.set {name, url, key}; use and remove send
//      their verbs.
// NOT ASSERTED: layout, words.
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

const OWED = 'OWED by goal/G18.6: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const APP = path.join(ROOT, 'spirit', 'run', 'shell', 'deskUnslothRemote', 'deskUnslothRemote.js');
const NODE_NAME = 'ollama agent node';
const REPO = 'fake/Agent-9B-GGUF';
const QUANT = 'Q8_0';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: REPO, answerTokens: 100, bytesPerToken: 4 };
const OPENAI_KEY = 'sk-test-never-shown';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G18.6: named URL/key pairs in connection.json, kept in the connect tab, a model list per pair');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothpairs-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}
function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function bodyOf(req, fn) { let raw = ''; req.on('data', function (c) { raw += c; }); req.on('end', function () { let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; } fn(b); }); }

// ── THE FAKE STUDIO (the routes as read live 2026-10-12) ──────────────
const studioCalls = [];
const studioChats = [];
const studioServer = http.createServer(function (req, res) {
  bodyOf(req, function (body) {
    const answer = answerer(res);
    const p = new URL(req.url, 'http://x').pathname;
    studioCalls.push(p);
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [{ repo_id: REPO, size_bytes: 9e9, has_vision: false, task: 'text-generation' }] });
    if (p === '/api/models/gguf-variants') return answer(200, { repo_id: REPO, variants: [{ quant: QUANT, size_bytes: 9e9, downloaded: true }] });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: REPO, loaded: true, quant: QUANT }] });
    if (p === '/api/inference/status') return answer(200, { active_model: REPO, loaded: [REPO], gguf_variant: QUANT, context_length: 8192 });
    if (p === '/api/inference/load') return answer(200, { status: 'loaded' });
    if (p === '/v1/chat/completions' && req.method === 'POST') { studioChats.push(body); return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'studio hello' } }] }); }
    answer(404, { detail: 'not found' });
  });
});

// ── THE FAKE OPENAI: /v1/models and /v1/chat/completions, nothing of the studio's ──
const openai = { calls: [], loads: 0, auth: [], chats: [] };
const openaiServer = http.createServer(function (req, res) {
  bodyOf(req, function (body) {
    const answer = answerer(res);
    const p = new URL(req.url, 'http://x').pathname;
    openai.calls.push(p);
    openai.auth.push(String(req.headers.authorization || ''));
    if (p.indexOf('/api/') === 0) { if (p === '/api/inference/load') openai.loads++; return answer(404, { error: { message: 'Invalid URL (GET ' + p + ')' } }); }
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: 'gpt-x', object: 'model' }, { id: 'gpt-y', object: 'model' }] });
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      openai.chats.push(body);
      // As OpenAI answered live on 2026-10-12 (goal/G18.7).
      if (body && body.max_tokens !== undefined) return answer(400, { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", type: 'invalid_request_error', param: 'max_tokens', code: 'unsupported_parameter' } });
      const usage = { prompt_tokens: 10, completion_tokens: 40, total_tokens: 50, completion_tokens_details: { reasoning_tokens: body && body.model === 'gpt-x' ? 32 : 0 } };
      const tools = body && Array.isArray(body.tools) && body.tools.length;
      if (tools) return answer(200, { usage: usage, choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: body.tools[0].function.name, arguments: '{}' } }] } }] });
      return answer(200, { usage: usage, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'hello' } }] });
    }
    answer(404, { error: { message: 'not found' } });
  });
});

// ── THE FAKE NODE ──────────────────────────────────────────────────────
let client = null;
const deskWords = [];
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
function readJson(name) { try { return JSON.parse(fs.readFileSync(path.join(state, name), 'utf8')); } catch (e) { return null; } }
function names(s) { return ((s && s.connections) || []).map(function (c) { return c.name + (c.use ? '*' : ''); }).join(','); }
function ids(m) { return ((m && m.models) || []).map(function (x) { return x.id + (x.quant ? ' ' + x.quant : ''); }).sort().join(','); }

async function serverHalf() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { openaiServer.listen(0, '127.0.0.1', r); });
  const STUDIO_URL = 'http://127.0.0.1:' + studioServer.address().port + '/v1';
  const OPENAI_URL = 'http://127.0.0.1:' + openaiServer.address().port + '/v1';
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  // The files as a node has them today: one connection, one known list, the loaded pair marked.
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: STUDIO_URL, key: 'studio-key' }));
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: REPO, activeQuant: QUANT, models: [{ id: REPO, quant: QUANT, loaded: true, bytes: 9e9, task: 'text-generation', vision: false, reasoning: false, audio: false, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not start: ' + short(out.stderr)); return; }

  test.subHeading('1. the old files read as one pair named studio');
  const s0 = await ask('state', {});
  if (names(s0) === 'studio*' && s0.connections[0].url === STUDIO_URL) test.check('the state lists one pair, studio, in use, with its url');
  else test.fail(OWED + 'state.connections reads ' + short(s0.connections));
  const m0 = await ask('models', {});
  const kept = (m0.models || []).filter(function (x) { return x.id === REPO && x.quant === QUANT; })[0];
  if (kept && kept.recommended === true) test.check('the old known list is still there, its 🧵 kept');
  else test.fail(OWED + 'models after the old files: ' + short(m0.models));
  if (JSON.stringify(s0).indexOf('studio-key') === -1) test.check('no key in the state');
  else test.fail(OWED + 'the state carries the key: ' + short(s0));

  test.subHeading('2. connection.set {name, url, key} adds a pair and uses it');
  const set = await ask('connection.set', { name: 'openai', url: OPENAI_URL, key: OPENAI_KEY });
  const file = readJson('connection.json');
  const pairOf = function (n) { return Array.isArray(file) ? file.filter(function (c) { return c && c.name === n; })[0] : null; };
  if (set.answers === true && Array.isArray(file) && file.length === 2 && pairOf('openai') && pairOf('openai').url === OPENAI_URL && pairOf('openai').key === OPENAI_KEY && pairOf('studio') && pairOf('studio').key === 'studio-key') test.check('connection.json is now an array of {name, url, key}: studio and openai');
  else test.fail(OWED + 'connection.set answered ' + short(set) + '; connection.json reads ' + short(file));
  const s1 = await ask('state', {});
  if (names(s1).split(',').sort().join() === 'openai*,studio' && JSON.stringify(s1).indexOf(OPENAI_KEY) === -1) test.check('the state: openai in use, studio kept, no key');
  else test.fail(OWED + 'state after set: ' + short(s1.connections));
  const long = await ask('connection.set', { name: 'x'.repeat(65), url: OPENAI_URL, key: '' });
  const none = await ask('connection.set', { name: '', url: OPENAI_URL, key: '' });
  if (long.ok === false && long.extra && /64|bytes|long/.test(String(long.extra.why)) && none.ok === false && none.extra && none.extra.why) test.check('a name over 64 bytes, or none, is refused with its reason');
  else test.fail(OWED + 'a 65-byte name answered ' + short(long) + '; no name ' + short(none));

  test.subHeading('3. a plain OpenAI server: its /v1/models, no load, a test');
  await until(async function () { return ids(await ask('models', {})) === 'gpt-x,gpt-y'; }, 6000);
  const m1 = await ask('models', {});
  if (ids(m1) === 'gpt-x,gpt-y') test.check('models lists the server\'s /v1/models: gpt-x and gpt-y');
  else test.fail(OWED + 'models with the openai pair in use: ' + short(m1.models));
  if (openai.auth.some(function (a) { return a === 'Bearer ' + OPENAI_KEY; })) test.check('the calls carry that pair\'s key');
  else test.fail(OWED + 'the openai server saw ' + short(openai.auth));
  await ask('model.load', { id: 'gpt-x', quant: '' });
  await sleep(300);
  const s2 = await ask('state', {});
  const m2 = await ask('models', {});
  const gx = (m2.models || []).filter(function (x) { return x.id === 'gpt-x'; })[0];
  if (openai.loads === 0 && s2.model === 'gpt-x' && gx && gx.loaded === true && m2.load && m2.load.state === 'done') test.check('model.load sets gpt-x without a load: the model named, the entry loaded');
  else test.fail(OWED + 'after model.load gpt-x: loads ' + openai.loads + ', model ' + short(s2.model) + ', load ' + short(m2.load) + ', entry ' + short(gx));
  await ask('model.test', { id: 'gpt-x', quant: '' });
  await until(async function () { const m = await ask('models', {}); const e = (m.models || []).filter(function (x) { return x.id === 'gpt-x'; })[0]; return !!(e && e.tested); }, 8000);
  const m3 = await ask('models', {});
  const gt = (m3.models || []).filter(function (x) { return x.id === 'gpt-x'; })[0];
  if (gt && gt.recommended === true) test.check('model.test against it: a real tool call marks gpt-x 🧵');
  else test.fail(OWED + 'after model.test gpt-x: ' + short(gt));

  test.subHeading('7. goal/G18.7: max_completion_tokens for OpenAI, the reasoning mark');
  const sentToOpenai = openai.chats.filter(function (b) { return b && Array.isArray(b.tools) && b.tools.length; });
  if (sentToOpenai.length && sentToOpenai.every(function (b) { return b.max_tokens === undefined && Number(b.max_completion_tokens) > 0; })) test.check('the test asked OpenAI with max_completion_tokens and no max_tokens');
  else test.fail('OWED by goal/G18.7: the test sent OpenAI ' + short(sentToOpenai.map(function (b) { return { max_tokens: b.max_tokens, max_completion_tokens: b.max_completion_tokens }; })));
  if (gt && gt.reasoning === true) test.check('gpt-x counted reasoning tokens in its answer: marked reasoning in the openai pair\'s list');
  else test.fail('OWED by goal/G18.7: gpt-x after its test: ' + short(gt));
  const gy = (m3.models || []).filter(function (x) { return x.id === 'gpt-y'; })[0];
  if (gy && gy.reasoning === false) test.check('gpt-y, never asked, is not marked reasoning');
  else test.fail('OWED by goal/G18.7: gpt-y reads ' + short(gy));
  const chatsBefore = openai.chats.length;
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'hello there' }] });
  await until(async function () { const a = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return a.done === true; }, 8000);
  const chatBody = openai.chats.slice(chatsBefore).filter(function (b) { return b && !(Array.isArray(b.tools) && b.tools.length); })[0] || openai.chats.slice(chatsBefore)[0];
  if (chatBody && chatBody.max_tokens === undefined && Number(chatBody.max_completion_tokens) > 0) test.check('the chat asks OpenAI with max_completion_tokens too');
  else test.fail('OWED by goal/G18.7: the chat sent OpenAI ' + short(chatBody));

  test.subHeading('4. per pair: the list, the chosen model and the marks');
  const connectedBefore = (await ask('state', {})).connected;
  const signoffsBefore = deskWords.filter(function (w) { return w === 'signoff'; }).length;
  await ask('connection.use', { name: 'studio' });
  await until(async function () { return ids(await ask('models', {})) === REPO + ' ' + QUANT; }, 6000);
  const s3 = await ask('state', {});
  const m4 = await ask('models', {});
  const back = (m4.models || []).filter(function (x) { return x.id === REPO; })[0];
  if (names(s3).split(',').sort().join() === 'openai,studio*' && s3.model === REPO && back && back.recommended === true) test.check('connection.use studio: its list, its model ' + REPO + ', its 🧵');
  else test.fail(OWED + 'after use studio: ' + short(names(s3)) + ', model ' + short(s3.model) + ', list ' + short(m4.models));
  const studioBefore = studioChats.length;
  const sentStudio = await ask('chat.send', { lines: [{ role: 'user', text: 'hello studio' }] });
  await until(async function () { const a = sentStudio.id ? await ask('chat.answer', { id: sentStudio.id }) : {}; return a.done === true; }, 8000);
  const studioBody = studioChats.slice(studioBefore)[0];
  if (studioBody && Number(studioBody.max_tokens) > 0 && studioBody.max_completion_tokens === undefined) test.check('goal/G18.7: the studio is still asked with max_tokens');
  else test.fail('OWED by goal/G18.7: the studio was sent ' + short(studioBody));
  if (connectedBefore === true && s3.connected === false && deskWords.filter(function (w) { return w === 'signoff'; }).length > signoffsBefore) test.check('the switch disconnected Levant, with a signoff');
  else test.fail(OWED + 'connected before ' + connectedBefore + ', after ' + s3.connected + '; signoffs ' + signoffsBefore + ' -> ' + deskWords.filter(function (w) { return w === 'signoff'; }).length);
  await ask('connection.use', { name: 'openai' });
  await until(async function () { return ids(await ask('models', {})) === 'gpt-x,gpt-y'; }, 6000);
  const s4 = await ask('state', {});
  const m5 = await ask('models', {});
  const again = (m5.models || []).filter(function (x) { return x.id === 'gpt-x'; })[0];
  if (s4.model === 'gpt-x' && again && again.recommended === true) test.check('and back to openai: gpt-x chosen, its 🧵 as left');
  else test.fail(OWED + 'back on openai: model ' + short(s4.model) + ', gpt-x ' + short(again));

  test.subHeading('5. connection.remove');
  const inUse = await ask('connection.remove', { name: 'openai' });
  if (inUse.ok === false && inUse.extra && inUse.extra.why) test.check('removing the pair in use is refused: ' + inUse.extra.why);
  else test.fail(OWED + 'removing the pair in use answered ' + short(inUse));
  await ask('connection.remove', { name: 'studio' });
  const after = readJson('connection.json');
  const s5 = await ask('state', {});
  if (Array.isArray(after) && after.length === 1 && after[0].name === 'openai' && names(s5) === 'openai*') test.check('removing studio takes it out of connection.json and the state');
  else test.fail(OWED + 'after removing studio: file ' + short(after) + ', state ' + short(s5.connections));
}

// ── THE CONNECT TAB ────────────────────────────────────────────────────
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
function clickOn(attrs) { return { target: { getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, closest: function () { return null; } }, preventDefault: function () {}, stopPropagation: function () {} }; }

async function faceHalf() {
  test.subHeading('6. the connect tab keeps the pairs');
  const STATE = { connected: false, persona: 'Levant', model: 'gpt-x', server: { url: 'http://o/v1', answers: true, error: '' },
    connections: [{ name: 'studio', url: 'http://s/v1', use: false }, { name: 'openai', url: 'http://o/v1', use: true }] };
  const MODELS = { active: 'gpt-x', activeQuant: '', cached: false, load: {}, test: {}, models: [{ id: 'gpt-x', quant: '', loaded: true, recommended: true }] };
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
      const a = body && body.ask && body.ask.deskUnsloth;
      if (name === 'jobs.api' && body && body.ask === 'api') return Promise.resolve({ status: 200, body: { desk: {}, deskUnsloth: {} } });
      const v = a ? Object.keys(a)[0] : '';
      if (v) calls.push({ verb: v, args: a[v] });
      const said = v === 'state' ? STATE : v === 'models' ? MODELS : v === 'connection.set' ? { url: 'http://n/v1', answers: true, error: '' } : { change: 1 };
      return Promise.resolve({ status: 200, body: said });
    },
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const tab = function () { return Object.keys(byId).filter(function (k) { return /^dur-/.test(k); }).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const list = doc.getElementById('dur-pairs').innerHTML;
  const useBtn = /data-use="studio"/.test(list);
  const rmBtn = /data-remove="studio"/.test(list);
  if (/studio/.test(list) && /openai/.test(list) && useBtn && rmBtn && !/data-use="openai"/.test(list) && /in use/.test(list)) test.check('#dur-pairs lists studio and openai by name, use and remove on studio, openai marked in use');
  else test.fail(OWED + '#dur-pairs reads ' + short(list));
  if (tab().indexOf('http://s/v1') === -1) test.check('the pairs are named, not shown by url');
  else test.fail(OWED + 'a url is drawn in the connect tab: ' + short(list));
  const form = doc.getElementById('dur-tab-connect').innerHTML;
  if (/<input[^>]*id="dur-pair-name"[^>]*data-field="label"|<input[^>]*data-field="label"[^>]*id="dur-pair-name"/.test(form) && /id="dur-server-url"/.test(form) && /id="dur-server-key"/.test(form)) test.check('the add form: a name marked data-field="label", a url and a key');
  else test.fail(OWED + 'the connect tab reads ' + short(form));

  const n0 = calls.length;
  doc.getElementById('dur-pair-name').value = 'openai2';
  doc.getElementById('dur-server-url').value = 'http://n/v1';
  doc.getElementById('dur-server-key').value = 'sk-n';
  doc.getElementById('dur-server-save').fire('click', {});
  await settled(); await sleep(20); await settled();
  const sent = calls.slice(n0).filter(function (c) { return c.verb === 'connection.set'; })[0];
  if (sent && JSON.stringify(sent.args) === JSON.stringify({ name: 'openai2', url: 'http://n/v1', key: 'sk-n' })) test.check('Save sends connection.set {name, url, key}');
  else test.fail(OWED + 'Save sent ' + short(calls.slice(n0)));
  if (doc.getElementById('dur-server-key').value === '') test.check('and the key field is emptied');
  else test.fail(OWED + 'the key stays in the field');

  const n1 = calls.length;
  doc.getElementById('dur-pairs').fire('click', clickOn({ 'data-use': 'studio' }));
  await settled();
  doc.getElementById('dur-pairs').fire('click', clickOn({ 'data-remove': 'studio' }));
  await settled();
  const used = calls.slice(n1).filter(function (c) { return c.verb === 'connection.use'; })[0];
  const removed = calls.slice(n1).filter(function (c) { return c.verb === 'connection.remove'; })[0];
  if (used && used.args.name === 'studio') test.check('use sends connection.use {name}');
  else test.fail(OWED + 'use sent ' + short(calls.slice(n1)));
  if (removed && removed.args.name === 'studio') test.check('remove sends connection.remove {name}');
  else test.fail(OWED + 'remove sent ' + short(calls.slice(n1)));
}

(async function () { await serverHalf(); await faceHalf(); })().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); studioServer.close(); openaiServer.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
