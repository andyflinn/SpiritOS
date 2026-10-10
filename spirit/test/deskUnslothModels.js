'use strict';

// spirit/test/deskUnslothModels.js
// goal/G14.4: the model line and the chat box of deskUnslothRemote. Written first, red on today's code
// (93c5af5e); claude-windows wrote it and builds it (one agent, Andy's word). The rulings are the item's box,
// Andy's of 2026-10-10:
//
//   "Model [model selector dropdown, showing currently loaded by default] [Load][ICON.EYE] [ICON.THINK][ICON.MUSIC]
//    etc... in small-print: flavor, GB size etc.... The dropdown will only show models that unsloth has cached
//    locally. The [Load] button will only be displayed if the models is not running, otherwise that spot shows the
//    RUNNING icon." "ICON.VIEW for vision". On choosing: "No. because the loading process is lengthy, changing the
//    selection only will bring more detailed info. That's why the [Load] button is separate".
//   The chat box: "Title Line containing model info / Fixed height scrolling display, height 25% of the windows /
//    [input string box][send-button]", "Enter = send, one line only", "the chat will only be shown on the node that
//    hosts deskUnsloth...."
//
// WHAT IS ASSERTED (the box, SHAPE 1 to 5)
//   1. deskUnsloth models {}: the cached list only (the studio's ollama entries absent), quant and loaded from
//      v1/models, vision from cached-gguf, reasoning and audio only on the loaded model; active named.
//   1b. with no model loaded the studio's status is an error: the cached list still comes, nothing loaded.
//   2. deskUnsloth model.load {id}: posts the studio's load for that id and answers AT ONCE, not waiting for the
//      studio's blocking load (minutes; a process must answer within 12 s), rewrites configuration.json's model,
//      and the next chat call names the new model.
//   3. deskUnsloth chat.send {lines} answers an id at once; chat.answer {id} turns done with the model's text; the
//      call carried the preamble and the lines.
//   4. the app's pure functions: the ask for models and model.load from the target (jobs.api here, owner.command on
//      the puppet, the same one function as the switch); the line for a model (Load or the running mark, the icons,
//      the small print) built from the models answer with no ask; the chat asks its own node only.
// Not asserted, the builder's: the layout and the words of the page; the poll pacing; the load fraction's display.
//
// THE FAKES: the studio (cached-gguf, v1/models, inference/status, inference/load, load-progress, chat/completions)
// and the node of deskUnslothSwitch.js (jobs.api for deskClient alone). rule/11: through testSupport only; its own
// folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.4: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const APP = path.join(RUN, 'shell', 'deskUnslothRemote', 'deskUnslothRemote.js');
const LOADED = 'unsloth/Qwen-AgentWorld-35B-A3B-GGUF';
const OTHER = 'unsloth/Ornith-1.0-9B-GGUF';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: LOADED, contextLimit: 2000, answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

// ── THE FAKE STUDIO, as read live 2026-10-10 ───────────────────────────
let loaded = LOADED;
const LOAD_MS = 1500;
const studio = { calls: [], chats: [] };
const CACHED = [
  { repo_id: LOADED, size_bytes: 23814715904, cache_path: '', has_vision: false, task: 'text-generation', last_modified: 1, cache_ref: 'ref:1' },
  { repo_id: OTHER, size_bytes: 5855732832, cache_path: '', has_vision: true, task: 'text-generation', last_modified: 2, cache_ref: 'ref:2' },
  { repo_id: 'unsloth/Qwen-Image-2.1-GGUF', size_bytes: 7640860384, cache_path: '', has_vision: false, task: 'text-to-image', last_modified: 3, cache_ref: 'ref:3' },
];
function v1Models() {
  return { object: 'list', data: [
    { id: LOADED, object: 'model', owned_by: 'unsloth-studio', quant: 'UD-Q2_K_XL', context_length: 58880, loaded: loaded === LOADED },
    { id: OTHER, object: 'model', owned_by: 'unsloth-studio', quant: 'Q4_1', loaded: loaded === OTHER, display_name: 'Ornith-1.0-9B-GGUF' },
    { id: 'unsloth/Qwen-Image-2.1-GGUF', object: 'model', owned_by: 'unsloth-studio', quant: 'Q8_0', loaded: false },
    { id: 'ollama/qwen3-coder:30b', object: 'model', owned_by: 'unsloth-studio', loaded: false, display_name: 'qwen3-coder:30b' },
  ] };
}
function status() {
  return { active_model: loaded, loaded: [loaded], supports_reasoning: loaded === LOADED, supports_tools: true, is_vision: loaded === OTHER, is_audio: loaded === OTHER, context_length: 58880 };
}
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    studio.calls.push({ method: req.method, url: req.url, auth: String(req.headers.authorization || ''), body: body });
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    if (p === '/api/models/cached-gguf') return answer(200, { cached: CACHED });
    if (p === '/v1/models') return answer(200, v1Models());
    // WITH NO MODEL LOADED the studio's status is an error (Andy, 2026-10-10: "when no model is loaded, the model
    // selector doesn't show up."); the fake answers so while `loaded` is empty.
    if (p === '/api/inference/status') return loaded ? answer(200, status()) : answer(404, { detail: 'No model loaded' });
    if (p === '/api/inference/load-progress') return answer(200, { phase: null, bytes_loaded: 0, bytes_total: 0, fraction: 0 });
    // THE STUDIO'S LOAD BLOCKS until the model is in (minutes for a big one, read live 2026-10-10): the fake holds
    // its answer LOAD_MS, longer than the suite tolerates for model.load's own answer.
    if (p === '/api/inference/load' && req.method === 'POST') {
      if (!body || !body.model_path) return answer(422, { detail: 'model_path required' });
      return setTimeout(function () {
        loaded = body.model_path;
        answer(200, { status: 'loaded', model_path: body.model_path, inference: { temperature: 0.7 } });
      }, LOAD_MS);
    }
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push(body);
      const last = body && Array.isArray(body.messages) ? body.messages[body.messages.length - 1] : null;
      return setTimeout(function () {
        answer(200, { id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: 'echo of: ' + String(last && last.content) }, finish_reason: 'stop' }] });
      }, 300);
    }
    answer(404, { detail: 'API endpoint not found' });
  });
});

// ── THE FAKE NODE: jobs.api for deskClient, as deskUnslothSwitch.js ─────
let nextQueue = [];
const deskWords = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node answers jobs.api for deskClient alone' });
    if (dc.next) {
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      deskWords.push({ verb: String(dc.desk.verb || ''), args: args });
      const v = dc.desk.verb;
      if (v === 'AGENTS') return answer(200, { text: 'rules' });
      if (v === 'item.get') return answer(200, { item: JSON.stringify({ id: args.id, title: 't', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], go: true }), version: 1, change: 1 });
      if (v === 'item.box') return answer(200, { box: 'the box', version: 1 });
      if (v === 'item.chat') return answer(200, { chat: [{ by: 'andy', at: 't', text: 'levant: which model are you', taken: '' }], chatMore: false });
      if (v === 'chat.add') return answer(200, { change: 2 });
      if (v === 'signoff') return answer(200, { change: 3 });
      return answer(404, { ok: false, code: 'no-such-item', error: 'the fake desk holds nothing' });
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});

// ── THE AGENT ────────────────────────────────────────────────────────────
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-models-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskUnsloth', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() {
  return new Promise(function (r) {
    const k = kid;
    if (!k || out.code !== null) return r();
    k.once('exit', function () { r(); });
    try { k.disconnect(); } catch (e) { /* no channel */ }
    setTimeout(function () { try { k.kill(); } catch (e) { /* gone */ } }, 500);
    setTimeout(r, 3000);
  });
}
async function doorUp(client, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await client.ask('api');
      if (r && r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return r.body.deskUnsloth;
    } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}
function loadApp() {
  if (!fs.existsSync(APP)) return null;
  const ctx = { app: null, spirit: { shell: { activateApp: function (a) { ctx.app = a; } }, core: { const: { ICON: { VIEW: '👁️', THINK: '🤔', MUSIC: '🎵', ON: '🟢', LOADING: '⏳' } } } }, document: {}, window: {}, console: console };
  ctx.window = ctx;
  try { vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP }); } catch (e) { return { error: String(e && e.message) }; }
  return ctx;
}

test.startTest('goal/G14.4: the model line and the chat box');

async function suite() {
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'studio-key', url: 'http://127.0.0.1:' + studioServer.address().port + '/v1' }, null, 1));
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskUnsloth never answered api on its pipe (' + JSON.stringify((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  function ask(verb, args) { const a = {}; a[verb] = args || {}; return client.ask({ deskUnsloth: a }).then(function (r) { return r.body || {}; }); }

  test.subHeading('1. models: the cached list, merged');
  const verbs = Object.keys(tree).sort();
  if (['models', 'model.load', 'chat.send', 'chat.answer'].every(function (v) { return verbs.indexOf(v) !== -1; })) test.check('its api declares models, model.load, chat.send and chat.answer: ' + verbs.join(', '));
  else { test.fail(OWED + 'the verb tree reads ' + verbs.join(', ')); return; }
  const m1 = await ask('models', {});
  const ids = (m1.models || []).map(function (m) { return m.id; });
  if (m1.active === LOADED && ids.length === 3 && ids.indexOf('ollama/qwen3-coder:30b') === -1 && ids.indexOf(LOADED) !== -1 && ids.indexOf(OTHER) !== -1) test.check('models lists the three cached models and none of the studio\'s ollama entries; active names the loaded one');
  else test.fail(OWED + 'models answered ' + short(m1));
  const byId = {}; (m1.models || []).forEach(function (m) { byId[m.id] = m; });
  const q = byId[LOADED], o = byId[OTHER], img = byId['unsloth/Qwen-Image-2.1-GGUF'];
  if (q && q.loaded === true && q.quant === 'UD-Q2_K_XL' && q.bytes === 23814715904 && q.task === 'text-generation' && o && o.loaded === false && o.quant === 'Q4_1' && img && img.task === 'text-to-image') test.check('each carries loaded and quant from v1/models, bytes and task from cached-gguf');
  else test.fail(OWED + 'the entries: ' + short([q, o, img]));
  if (q && q.vision === false && q.reasoning === true && q.audio === false && o && o.vision === true && o.reasoning === false && o.audio === false) test.check('vision from cached-gguf for every model; reasoning and audio from inference/status for the loaded one and false for the others');
  else test.fail(OWED + 'the flags: ' + short([q, o]));
  const studioAsked = studio.calls.map(function (c) { return c.url.split('?')[0]; });
  if (studioAsked.indexOf('/api/models/cached-gguf') !== -1 && studioAsked.indexOf('/v1/models') !== -1 && studioAsked.indexOf('/api/inference/status') !== -1 && studio.calls.every(function (c) { return c.auth === 'Bearer studio-key'; }) && studioAsked.every(function (u) { return u.indexOf('/api/models/config') === -1; })) test.check('three studio calls with the connection\'s key, and no per-model config call');
  else test.fail(OWED + 'studio asked ' + short(studioAsked));

  test.subHeading('1b. with no model loaded, the list still comes');
  loaded = '';
  const m0 = await ask('models', {});
  if (m0.active === '' && Array.isArray(m0.models) && m0.models.length === 3 && m0.models.every(function (m) { return m.loaded === false && m.reasoning === false && m.audio === false; })) test.check('with the studio\'s status an error, models still lists the three cached models, none loaded, active empty');
  else test.fail(OWED + 'with no model loaded, models answered ' + short(m0));
  loaded = LOADED;

  test.subHeading('2. model.load: the studio loads it, the configuration follows, the next call names it');
  studio.calls.length = 0;
  const tl = Date.now();
  const l1 = await ask('model.load', { id: OTHER });
  const loadMs = Date.now() - tl;
  // The studio's call lands a moment after the answer: that is the point. Waited for, then read.
  await until(function () { return studio.calls.some(function (c) { return c.url.split('?')[0] === '/api/inference/load'; }); }, 2000);
  const loadCall = studio.calls.filter(function (c) { return c.url.split('?')[0] === '/api/inference/load'; })[0];
  if (l1.model === OTHER && l1.loaded === false && loadMs < LOAD_MS && loadCall && loadCall.method === 'POST' && loadCall.body && loadCall.body.model_path === OTHER) test.check('model.load posts the studio\'s load with model_path and answers {model, loaded: false} at once (' + loadMs + ' ms), not waiting for the studio\'s blocking load');
  else test.fail(OWED + 'model.load answered ' + short(l1) + ' in ' + loadMs + ' ms (the studio holds its load ' + LOAD_MS + '), studio load call ' + short(loadCall));
  let conf = null; try { conf = JSON.parse(fs.readFileSync(path.join(state, 'configuration.json'), 'utf8')); } catch (e) { conf = null; }
  if (conf && conf.model === OTHER && conf.persona === CONFIGURATION.persona && conf.preamble === CONFIGURATION.preamble && conf.contextLimit === CONFIGURATION.contextLimit) test.check('configuration.json now names the new model and keeps everything else');
  else test.fail(OWED + 'configuration.json reads ' + short(conf));
  await until(function () { return loaded === OTHER; }, LOAD_MS + 2000);
  const m2 = await ask('models', {});
  const o2 = (m2.models || []).filter(function (m) { return m.id === OTHER; })[0];
  if (m2.active === OTHER && o2 && o2.loaded === true && o2.vision === true && o2.audio === true) test.check('once the studio is done, models shows the new one loaded and active, with its flags');
  else test.fail(OWED + 'models after the load: ' + short(m2));
  const m3 = await ask('models', {});
  if (JSON.stringify(m3) === JSON.stringify(m2)) test.check('nothing is kept: two asks in a row read the same studio and agree');
  else test.fail(OWED + 'two asks disagree: ' + short(m2) + ' vs ' + short(m3));
  studio.chats.length = 0;
  nextQueue.push([]);
  await sleep(600);
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'x/G1', text: 'levant: which model are you' })]);
  if (await until(function () { return studio.chats.length >= 1; }, 10000) && studio.chats[0].model === OTHER) test.check('the next desk-driven call names the new model');
  else test.fail(OWED + 'the desk-driven call named ' + short(studio.chats[0] && studio.chats[0].model));
  await until(function () { return deskWords.some(function (w) { return w.verb === 'chat.add'; }); }, 8000);

  test.subHeading('3. the chat: send at once, answer when done');
  studio.chats.length = 0;
  const lines = [{ role: 'user', text: 'hello there' }, { role: 'assistant', text: 'hi' }, { role: 'user', text: 'what is two and two' }];
  const t0 = Date.now();
  const s1 = await ask('chat.send', { lines: lines });
  const sendMs = Date.now() - t0;
  if (s1.id && typeof s1.id === 'string' && sendMs < 250) test.check('chat.send answers an id at once (' + sendMs + ' ms), before the model has spoken');
  else test.fail(OWED + 'chat.send answered ' + short(s1) + ' in ' + sendMs + ' ms');
  const a0 = s1.id ? await ask('chat.answer', { id: s1.id }) : {};
  if (s1.id && a0.done === false) test.check('chat.answer says not done while the model works');
  else test.fail(OWED + 'chat.answer at once: ' + short(a0));
  let a1 = {};
  if (s1.id) { const t1 = Date.now(); while (Date.now() - t1 < 8000) { a1 = await ask('chat.answer', { id: s1.id }); if (a1.done) break; await sleep(100); } }
  if (a1.done === true && a1.text === 'echo of: what is two and two') test.check('chat.answer turns done with the model\'s text');
  else test.fail(OWED + 'chat.answer ended ' + short(a1));
  const call = studio.chats[0];
  const msgs = call && Array.isArray(call.messages) ? call.messages : [];
  const sys = msgs.filter(function (m) { return m.role === 'system'; }).map(function (m) { return String(m.content); }).join('\n');
  const rest = msgs.filter(function (m) { return m.role !== 'system'; });
  if (call && call.model === OTHER && sys.indexOf(CONFIGURATION.preamble) !== -1 && rest.length === 3 && rest[0].role === 'user' && rest[0].content === 'hello there' && rest[1].role === 'assistant' && rest[2].content === 'what is two and two') test.check('the call named the loaded model, carried the preamble as system and the lines in order with their roles');
  else test.fail(OWED + 'the chat call: ' + short(call));
  const gone = await ask('chat.answer', { id: 'no-such-id' });
  if (gone.ok === false || gone.done === false) test.check('an unknown id is not an answer');
  else test.fail(OWED + 'an unknown id answered ' + short(gone));

  test.subHeading('4. the app\'s functions');
  const ctx = loadApp();
  if (!ctx || ctx.error) { test.fail(OWED + 'deskUnslothRemote.js ' + (ctx ? 'failed to load: ' + ctx.error : 'missing')); return; }
  const KEY = 'MCowBQYDK2VwAyEAZQ/IHHn57kdPt0Vf1wZsAJoAMivrFUEN3co7yzq9ki0=';
  const askFor = ctx.deskUnslothRemoteAskFor;
  const local = askFor && askFor({ kind: 'node' }, 'models', {});
  const remote = askFor && askFor({ kind: 'puppet', key: KEY }, 'model.load', { id: OTHER });
  if (local && local.verb === 'jobs.api' && local.ask.deskUnsloth.models && remote && remote.verb === 'owner.command' && remote.to === KEY && remote.body.ask.deskUnsloth['model.load'].id === OTHER) test.check('models and model.load go through the same one function as the switch: jobs.api here, owner.command on the puppet');
  else test.fail(OWED + 'the asks: ' + short([local, remote]));
  const lineFor = ctx.deskUnslothRemoteLineFor;
  if (typeof lineFor !== 'function') { test.fail(OWED + 'no deskUnslothRemoteLineFor(model) in the script'); return; }
  const L = lineFor({ id: OTHER, loaded: false, quant: 'Q4_1', bytes: 5855732832, task: 'text-generation', vision: true, reasoning: false, audio: true });
  const R = lineFor({ id: LOADED, loaded: true, quant: 'UD-Q2_K_XL', bytes: 23814715904, task: 'text-generation', vision: false, reasoning: true, audio: false });
  if (L && L.load === true && L.mark === '' && L.icons.join('') === '👁️🎵' && /Q4_1/.test(L.small) && /5\.9 GB/.test(L.small)) test.check('a model not loaded gets the Load button, VIEW and MUSIC for vision and audio, "Q4_1" and "5.9 GB" in small print');
  else test.fail(OWED + 'the line for a model not loaded: ' + short(L));
  if (R && R.load === false && R.mark === '🟢' && R.icons.join('') === '🤔' && /23\.8 GB/.test(R.small)) test.check('the loaded model gets the running mark ON instead of Load, THINK for reasoning, "23.8 GB"');
  else test.fail(OWED + 'the line for the loaded model: ' + short(R));
  const chatAsk = ctx.deskUnslothRemoteChatAskFor;
  const c1 = chatAsk && chatAsk('chat.send', { lines: [] });
  if (c1 && c1.verb === 'jobs.api' && c1.ask.deskUnsloth['chat.send']) test.check('the chat asks its own node only: jobs.api, never owner.command');
  else test.fail(OWED + 'the chat ask: ' + short(c1));
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); } catch (e) { /* closed */ }
  try { studioServer.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
