'use strict';

// spirit/test/deskUnslothRemoteTabs.js
// goal/G10.7: no context limit of ours, the connection set from the app, and deskUnslothRemote in three tabs. Red on
// today's code (c084d78c); claude-windows wrote it and builds it (one agent). The rulings are the item's box, Andy's
// of 2026-10-12:
//
//   "remove  contextLimit from the configuration file. we will not work on stuff that unsloth does already well. we
//   will never pass context limits to unslot. that's a decision." "the connection.json file must be gitignored."
//   "actually, make that 3 tabs [test] [configure][connect]", and the four warning bubbles in all three tabs: no node
//   with deskUnsloth, no OpenAI compatible server, no model loaded and selected, a model loading ("be patient, a
//   model (name of model) is currently loading."). The test tab: "if an model is ready in the OpenAI compatible
//   server, the test tab will show the chat interface." The configure tab: "the model selector bubble." The connect
//   tab: "the "where" bubble: "select the node where your local agent lives"", "the new "connect to and OpenAI
//   compatible server bubble", "the connect/disconnect "Levant" to the desk bubble." The where default: "when
//   deskUnsloth does not find desk installed on it's own node, it will default to "this" node. if it does find desk
//   is installed on its own node it, will default to the first puppet it finds that has deskUnsloth installed."
//   Q7, the server bubble writes a url and a key into connection.json through a new verb of deskUnsloth's: "yes."
//
// WHAT IS ASSERTED
//   1. contextLimit is gone: from the shipped configuration.json and from deskUnsloth.js; the studio's load carries
//      the model path alone.
//   2. connection.json is ignored by git, beside the code and in the state folder.
//   3. deskUnsloth starts without connection.json and says so: state.server {url '', answers false}; connection.set
//      {url, key} writes connection.json, answers {url, answers, error} from a probe of the server, and the state and the
//      published object carry server {url, answers} and never the key; a dead url answers false.
//   4. the app's pure functions: the warnings, in his order, each with ICON.WARNING; the where default.
//   5. the app mounted: [test] [configure] [connect] in that order; the warnings in every tab; the where, server and
//      switch bubbles in connect; the model selector in configure; the chat in test only when a model is ready;
//      connection.set sent from the server bubble; the where default chosen at mount.
// NOT ASSERTED, the builder's: layout, colours and the exact words beyond the ones quoted.
//
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G10.7: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const CODE = path.join(RUN, 'process', 'js', 'deskUnsloth');
const AGENT = path.join(CODE, 'deskUnsloth.js');
const APP = path.join(RUN, 'shell', 'deskUnslothRemote', 'deskUnslothRemote.js');
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };
const WARN = kernel.core.const.ICON.WARNING;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G10.7: no context limit, the connection from the app, deskUnslothRemote in three tabs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothtabs-'));

// ── THE FAKE STUDIO ────────────────────────────────────────────────────
const studio = { calls: [] };
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    studio.calls.push({ method: req.method, url: req.url, auth: String(req.headers.authorization || ''), body: body });
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: CONFIGURATION.model, object: 'model', loaded: true }] });
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [{ repo_id: CONFIGURATION.model, size_bytes: 1, has_vision: false, task: 'text-generation' }] });
    if (p === '/api/inference/status') return answer(200, { active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], context_length: 4096 });
    if (p === '/api/inference/load' && req.method === 'POST') return answer(200, { status: 'loaded' });
    answer(404, { detail: 'not found' });
  });
});

// ── THE FAKE NODE: deskClient's next and jobs.update, as deskUnslothSwitch.js ─
const published = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    if (dc && dc.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (dc && dc.desk) return answer(200, { ok: true });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskUnsloth', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stdout: '', stderr: '', code: null };
function start() {
  out.stdout = ''; out.stderr = ''; out.code = null;
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() {
  return new Promise(function (r) {
    if (!kid || out.code !== null) return r();
    kid.once('exit', function () { r(); });
    try { kid.kill(); } catch (e) { r(); }
    setTimeout(r, 3000);
  });
}

async function serverHalf() {
  test.subHeading('1. contextLimit is gone, and connection.json is ignored');
  // Since goal/G19.11 no configuration.json is shipped (it is gitignored and untracked; deskUnsloth starts on its
  // defaults without one, goal/G19.12). So nothing shipped can carry contextLimit, and a local one must not either.
  const confPath = path.join(CODE, 'configuration.json');
  let local = null;
  const present = fs.existsSync(confPath);
  if (present) { try { local = JSON.parse(fs.readFileSync(confPath, 'utf8')); } catch (e) { local = null; } }
  if (!present || (local && !('contextLimit' in local))) test.check('no configuration.json carries contextLimit (none is shipped since goal/G19.11)');
  else test.fail(OWED + 'the local configuration.json reads ' + short(local));
  if (!/CONFIGURATION\.contextLimit|contextLimit"|'contextLimit'/.test(fs.readFileSync(AGENT, 'utf8'))) test.check('deskUnsloth.js reads no contextLimit: the context is the studio\'s');
  else test.fail(OWED + 'deskUnsloth.js still reads contextLimit');
  const ignored = ['spirit/run/process/js/deskUnsloth/connection.json', 'spirit/run/relay-state/process/deskUnsloth/connection.json'].filter(function (p) {
    return spawnSync('git', ['check-ignore', '-q', p], { cwd: ROOT }).status === 0;
  });
  if (ignored.length === 2) test.check('connection.json is ignored by git beside the code and in the state folder');
  else test.fail(OWED + 'git ignores only ' + short(ignored));

  test.subHeading('2. deskUnsloth without connection.json, and connection.set');
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false); } catch (e) { /* not yet */ } }
  if (up) test.check('it starts without connection.json');
  else { test.fail(OWED + 'without connection.json it ' + (out.code === null ? 'never answered' : 'exited ' + out.code) + ': ' + short(out.stderr)); return; }
  const s0 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  if (s0.server && s0.server.url === '' && s0.server.answers === false) test.check('state says it is connected to no server: server {url \'\', answers false}');
  else test.fail(OWED + 'state without a connection answered ' + short(s0));

  const url = 'http://127.0.0.1:' + studioServer.address().port + '/v1';
  // Since goal/G18.6 a named pair, and connection.json an array of them.
  const set = (await client.ask({ deskUnsloth: { 'connection.set': { name: 'studio', url: url, key: 'secret-key' } } })).body || {};
  let file = null;
  try { file = JSON.parse(fs.readFileSync(path.join(state, 'connection.json'), 'utf8')); } catch (e) { file = null; }
  const pair = Array.isArray(file) ? file.filter(function (c) { return c && c.name === 'studio'; })[0] : null;
  if (set.answers === true && set.url === url && pair && pair.url === url && pair.key === 'secret-key') test.check('connection.set writes connection.json and says whether a server answers, from a probe of the server');
  else test.fail(OWED + 'connection.set answered ' + short(set) + '; the file reads ' + short(file));
  if (studio.calls.some(function (c) { return c.auth === 'Bearer secret-key'; })) test.check('the probe carried the new key');
  else test.fail(OWED + 'the studio was asked ' + short(studio.calls));
  const s1 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  await until(function () { return published.some(function (o) { return o.server && o.server.answers === true; }); }, 3000);
  const pub = published.filter(function (o) { return o.server && o.server.answers === true; }).pop();
  if (s1.server && s1.server.url === url && s1.server.answers === true && pub && pub.server.url === url) test.check('the state and the published object carry server {url, answers}');
  else test.fail(OWED + 'state ' + short(s1) + '; published ' + short(published.slice(-1)));
  if (!JSON.stringify(s1).includes('secret-key') && !published.some(function (o) { return JSON.stringify(o).includes('secret-key'); })) test.check('and never the key');
  else test.fail(OWED + 'the key went out in the state or a published object');

  await client.ask({ deskUnsloth: { 'model.load': { id: CONFIGURATION.model, quant: '' } } });
  await until(function () { return studio.calls.some(function (c) { return c.url === '/api/inference/load'; }); }, 3000);
  const ld = studio.calls.filter(function (c) { return c.url === '/api/inference/load'; })[0];
  if (ld && ld.body && JSON.stringify(Object.keys(ld.body)) === '["model_path"]') test.check('the studio\'s load carries the model path alone, never a context limit');
  else test.fail(OWED + 'the load sent ' + short(ld && ld.body));

  const dead = (await client.ask({ deskUnsloth: { 'connection.set': { name: 'studio', url: 'http://127.0.0.1:1/v1', key: 'k' } } })).body || {};
  const s2 = (await client.ask({ deskUnsloth: { state: {} } })).body || {};
  if (dead.answers === false && dead.error && s2.server && s2.server.answers === false) test.check('a url nothing answers: answers false, with the reason, and the state says so');
  else test.fail(OWED + 'a dead url answered ' + short(dead) + '; state ' + short(s2));
  await stop();
}

// ── THE APP ────────────────────────────────────────────────────────────
function loadApp() {
  const ctx = { app: null, spirit: { shell: { activateApp: function (a) { ctx.app = a; } }, core: kernel.core, keyTail: function (k) { return String(k).slice(-6); } }, document: {}, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  try { vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP }); } catch (e) { return { error: String(e && e.message) }; }
  return ctx;
}

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

const PUPPETS = { puppets: [{ name: 'gone', key: 'KEY-GONE' }, { name: 'agent node', key: 'KEY-AGENT' }] };
const READY = { connected: true, persona: 'Levant', model: 'fake/Levant-GGUF', server: { url: 'http://studio/v1', answers: true, error: '' } };
const MODELS = { active: 'fake/Levant-GGUF', cached: false, load: { model: '', state: '', error: '' }, models: [{ id: 'fake/Levant-GGUF', loaded: true, quant: 'Q4', bytes: 1e9, task: 'text-generation', vision: false, reasoning: false, audio: false }] };

// hasDesk: what this node's api answers; local: deskUnsloth on this node's answers ({state, models} or null).
async function mount(opts) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let behavior = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core, keyTail: function (k) { return String(k).slice(-6); } }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  const answerOf = function (who, verb, args) {
    const one = who === 'local' ? opts.local : (opts.puppets || {})[who];
    if (!one) return null;
    if (verb === 'state') return one.state;
    if (verb === 'models') return one.models;
    return { ok: true };
  };
  const api = {
    escapeHtml: kernel.core.util.escapeHtml,
    fs: { loadFile: function (name) { return name === 'puppets.json' ? JSON.stringify(PUPPETS) : null; } },
    onPublished: function () {},
    verb: function (name, body) {
      calls.push({ name: name, body: body });
      if (name === 'jobs.api' && body && body.ask === 'api') {
        const apps = { deskUnsloth: {} };
        if (opts.hasDesk) apps.desk = {};
        return Promise.resolve({ status: 200, body: apps });
      }
      if (name === 'jobs.api' && body && body.ask && body.ask.deskUnsloth) {
        const verb = Object.keys(body.ask.deskUnsloth)[0];
        const said = answerOf('local', verb, body.ask.deskUnsloth[verb]);
        return Promise.resolve(said ? { status: 200, body: said } : { status: 404, body: { ok: false, code: 'app-not-served', error: 'deskUnsloth is not served here' } });
      }
      if (name === 'owner.command') {
        const verb = Object.keys((body.body && body.body.ask && body.body.ask.deskUnsloth) || {})[0];
        const said = answerOf(body.to, verb, {});
        return Promise.resolve(said ? { status: 200, body: { ok: true, status: 200, body: said } } : { status: 200, body: { ok: false, code: 'not-reachable', error: 'the puppet is not reachable' } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
  };
  behavior.mount(doc.getElementById('container'), api);
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  return { doc: doc, calls: calls, ctx: ctx };
}

async function faceHalf() {
  test.subHeading('3. the app\'s pure functions: the warnings and the where default');
  const ctx = loadApp();
  if (!ctx || ctx.error || typeof ctx.deskUnslothRemoteWarnings !== 'function') { test.fail(OWED + 'no deskUnslothRemoteWarnings in the app' + (ctx && ctx.error ? ': ' + ctx.error : '')); }
  else {
    const w = function (s, m) { return ctx.deskUnslothRemoteWarnings(s, m) || []; };
    const all = function (list) { return list.every(function (t) { return String(t).indexOf(WARN) === 0; }); };
    const a = w(null, null);
    if (a.length === 1 && all(a) && /connect/i.test(a[0]) && /deskUnsloth/.test(a[0])) test.check('no node with deskUnsloth: one warning, pointing to the connect tab');
    else test.fail(OWED + 'with no state: ' + short(a));
    const b = w({ connected: true, persona: 'Levant', server: { url: '', answers: false, error: '' } }, null);
    if (b.length === 1 && all(b) && /OpenAI compatible server/i.test(b[0]) && /connect/i.test(b[0])) test.check('no OpenAI compatible server: one warning, pointing to the connect tab');
    else test.fail(OWED + 'with no server: ' + short(b));
    const c = w(READY, { active: '', cached: false, load: { model: '', state: '', error: '' }, models: [{ id: 'x', loaded: false }] });
    if (c.length === 1 && all(c) && /configure/i.test(c[0]) && /model/i.test(c[0])) test.check('no model loaded: one warning, pointing to the model selector in the configure tab');
    else test.fail(OWED + 'with no model loaded: ' + short(c));
    const d = w(READY, { active: '', cached: false, load: { model: 'big/Model-GGUF', state: 'loading', error: '' }, models: [{ id: 'big/Model-GGUF', loaded: false }] });
    if (d.length === 1 && all(d) && /be patient/i.test(d[0]) && /big\/Model-GGUF/.test(d[0])) test.check('a model loading: "be patient", naming the model');
    else test.fail(OWED + 'while loading: ' + short(d));
    const e = w(READY, MODELS);
    if (e.length === 0) test.check('a model ready: no warning');
    else test.fail(OWED + 'with a model ready: ' + short(e));
  }

  test.subHeading('4. the app mounted: three tabs, their bubbles, and the where default');
  const ready = await mount({ hasDesk: true, local: null, puppets: { 'KEY-AGENT': { state: READY, models: MODELS } } });
  const doc = ready.doc;
  const tabs = doc.getElementById('dur-tabs').innerHTML;
  const at = ['test', 'configure', 'connect'].map(function (t) { return tabs.indexOf('data-tab="' + t + '"'); });
  if (at.every(function (i) { return i !== -1; }) && at[0] < at[1] && at[1] < at[2]) test.check('three tabs, [test] [configure] [connect], in that order');
  else test.fail(OWED + 'the tab strip reads ' + short(tabs));
  if (doc.getElementById('dur-target').value === '2') test.check('with desk on this node, where defaults to the first puppet that has deskUnsloth (the second listed; the first does not answer)');
  else test.fail(OWED + 'where defaulted to ' + short(doc.getElementById('dur-target').value));
  const connect = doc.getElementById('dur-tab-connect').innerHTML;
  const server = connect.indexOf('id="dur-server-url"');
  const where = connect.indexOf('select the node where your local agent lives');
  const sw = connect.indexOf('id="dur-switch"');
  if (where !== -1 && server !== -1 && /id="dur-server-key"/.test(connect) && sw !== -1 && where < server && server < sw) test.check('connect holds the where bubble, the server bubble (url and key), then the Levant switch');
  else test.fail(OWED + '#dur-tab-connect reads ' + short(connect));
  if (/id="dur-models"/.test(doc.getElementById('dur-tab-configure').innerHTML)) test.check('configure holds the model selector bubble');
  else test.fail(OWED + '#dur-tab-configure reads ' + short(doc.getElementById('dur-tab-configure').innerHTML));
  if (/id="dur-chat"/.test(doc.getElementById('dur-tab-test').innerHTML) && /id="dur-chat-input"/.test(doc.getElementById('dur-chat').innerHTML)) test.check('a model ready: the test tab shows the chat');
  else test.fail(OWED + 'the test tab with a model ready: ' + short(doc.getElementById('dur-tab-test').innerHTML) + ' / ' + short(doc.getElementById('dur-chat').innerHTML));

  doc.getElementById('dur-pair-name').value = 'studio';
  doc.getElementById('dur-server-url').value = 'http://studio:8888/v1';
  doc.getElementById('dur-server-key').value = 'the-key';
  const before = ready.calls.length;
  doc.getElementById('dur-server-save').fire('click', {});
  await settled();
  const sent = ready.calls.slice(before).filter(function (c) { return c.name === 'owner.command' && c.body && c.body.body && c.body.body.ask && c.body.body.ask.deskUnsloth && c.body.body.ask.deskUnsloth['connection.set']; });
  const args = sent.length ? sent[0].body.body.ask.deskUnsloth['connection.set'] : null;
  if (args && args.name === 'studio' && args.url === 'http://studio:8888/v1' && args.key === 'the-key' && sent[0].body.to === 'KEY-AGENT') test.check('the server bubble sends connection.set {name, url, key} to the chosen node');
  else test.fail(OWED + 'after the server bubble\'s button: ' + short(ready.calls.slice(before)));

  const lone = await mount({ hasDesk: false, local: { state: Object.assign({}, READY, { server: { url: '', answers: false, error: '' } }), models: MODELS }, puppets: {} });
  if (lone.doc.getElementById('dur-target').value === '0') test.check('with no desk on this node, where defaults to this node');
  else test.fail(OWED + 'where without desk defaulted to ' + short(lone.doc.getElementById('dur-target').value));
  const warned = ['test', 'configure', 'connect'].every(function (t) {
    const inner = lone.doc.getElementById('dur-warnings').innerHTML;
    return inner.indexOf(WARN) !== -1 && /OpenAI compatible server/i.test(inner);
  });
  const shownAbove = lone.doc.getElementById('dur-warnings').style.display !== 'none';
  if (warned && shownAbove) test.check('the warnings sit above the tabs\' bodies, shown in every tab');
  else test.fail(OWED + '#dur-warnings reads ' + short(lone.doc.getElementById('dur-warnings').innerHTML));
  const chat = lone.doc.getElementById('dur-chat');
  if (!/id="dur-chat-input"/.test(chat.innerHTML) || chat.style.display === 'none') test.check('no server: the test tab shows no chat');
  else test.fail(OWED + 'the chat is offered with no server: ' + short(chat.innerHTML));
}

(async function () {
  await serverHalf();
  await faceHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); studioServer.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
