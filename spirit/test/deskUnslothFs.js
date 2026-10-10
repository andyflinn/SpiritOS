'use strict';

// spirit/test/deskUnslothFs.js
// goal/G14.8: fs tools for Levant: fs.load, fs.save opened. Written first, red on today's code (e5671029);
// claude-windows wrote it and builds it (one agent, Andy's word). The rulings are the item's box, Andy's of
// 2026-10-10:
//
//   "for now we just add the necessary fs tools."; "he should be able to write the code."; "i'm more inclined
//    to deny URL fetch, and allow loadFile, it's much narrower."; "net_fetch will be removed for Levant.";
//    "he should have directory search, too"; "the whole story of protecting app sources came from a time when we
//    had the stupid AI app-builder, which is gone now"; "we only protect intrinsic apps, and they are already
//    gated by the commit hooks as "core"?"; "strike the red Q and i press go".
//
// WHAT IS ASSERTED (the box)
//   1. THE VERB FILES: spirit/run/js/fs/load.json and save.json describe fs.load and fs.save; the fs AGENTS.md no
//      longer says the writes wait; the family then lists both (introSpector.family against the real folder).
//   2. THE NODE: fs.load {path} answers {path, text} for a served file and 404 for none or for relay-state; the
//      gate is open: fs.save writes an app's entry script and its manifest under shell as any other file there,
//      and still refuses js/, relay-state and a sidecar. On a real node booted from the harness fakes, never the
//      checkout.
//   3. THE OBJECT: describe(fs) through the node's route gives fs_load, fs_save, fs_search, fs_stat and
//      fs_annotations typed from the declarations; run fs_load hands the text back; run fs_save writes; a refusal
//      of the gate comes back as a refusal.
//   4. THE PROCESS: the call to the studio carries the fs tools and no net tool.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const { setupRelayFakes } = require('./setupRelayFakes');

const OWED = 'OWED by goal/G14.8: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const AGENT = path.join(RUN, 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const TOOLS = path.join(RUN, 'process', 'js', 'deskUnsloth', 'tools.js');
const FS_STEMS = ['load', 'save', 'search', 'stat', 'annotations'];
const STUDIO_CONTEXT = 4000;
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'fake/Levant-Test-GGUF', contextLimit: 'auto', answerTokens: 100, bytesPerToken: 4 };
const TOOL_ROOM = Math.floor(((STUDIO_CONTEXT - CONFIGURATION.answerTokens) * CONFIGURATION.bytesPerToken) / 4);
const BOOT_TIMEOUT_MS = 10000;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () { const port = probe.address().port; probe.close(function () { resolve(port); }); });
  });
}
function post(url, body) {
  return new Promise(function (resolve, reject) {
    const text = JSON.stringify(body);
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) } }, function (res) {
      let t = ''; res.on('data', function (c) { t += c; }); res.on('end', function () { let b = null; try { b = JSON.parse(t); } catch (e) { b = null; } resolve({ status: res.statusCode, text: t, body: b }); });
    });
    req.on('error', reject); req.setTimeout(8000, function () { req.destroy(new Error('timeout')); }); req.end(text);
  });
}

// ── THE REAL NODE, from the fakes (serverSurface's way) ──────────────────
const nodeRoot = setupRelayFakes('deskUnslothFs').andy;
fs.mkdirSync(path.join(nodeRoot, 'relay-state'), { recursive: true });
fs.writeFileSync(path.join(nodeRoot, 'relay-state', 'identity.json'), JSON.stringify({ name: 'sentinel', privateKey: 'SENTINEL-must-never-be-read' }), 'utf8');
fs.writeFileSync(path.join(nodeRoot, 'shell', 'natter', 'relays.json'), JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');
const ENTRY = 'shell/textEditor/textEditor.js';
const MANIFEST = 'shell/textEditor/textEditor.json';
let child = null;
let said = '';
function lastWords() { const tail = said.trim().split('\n').slice(-8).join('\n    '); return tail ? '\n    ' + tail : ' (it said nothing)'; }
async function bootNode(port) {
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: nodeRoot, env: Object.assign({}, process.env), stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', function (c) { said = (said + c).slice(-8192); });
  const t0 = Date.now();
  for (;;) {
    try { const r = await new Promise(function (resolve, reject) { http.get('http://127.0.0.1:' + port + '/', function (res) { res.resume(); resolve(res.statusCode); }).on('error', reject); }); if (r === 200) return true; } catch (e) { /* not yet */ }
    if (Date.now() - t0 > BOOT_TIMEOUT_MS) throw new Error('the node did not boot on ' + port + lastWords());
    await sleep(150);
  }
}

// ── THE FAKE NODE AND STUDIO for the process (deskUnslothTools' skeleton) ──
const nodeAsks = [];
const fake = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    nodeAsks.push(b);
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); }
    if (b.verb === 'fs.AGENTS.introspect') return answer(200, { items: [{ key: 'fs.load', label: 'load' }, { key: 'fs.save', label: 'save' }], more: false });
    if (b.verb === 'fs.AGENTS.load') return answer(200, { description: 'load a file', request: { path: '' }, reply: { path: '', text: '' } });
    if (b.verb === 'fs.AGENTS.save') return answer(200, { description: 'save a file', request: { path: '', content: '' }, reply: {} });
    if (b.verb === 'net.AGENTS.introspect') return answer(200, { items: [{ key: 'net.fetch', label: 'fetch' }], more: false });
    if (b.verb === 'net.AGENTS.fetch') return answer(200, { description: 'fetch', request: { url: '' }, reply: {} });
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const dc = b.verb === 'jobs.api' && b.ask && b.ask.deskClient;
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node has no ' + b.verb });
    if (dc.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (dc.desk) {
      const v = dc.desk.verb;
      if (v === 'AGENTS') return answer(200, { text: 'rules' });
      if (v === 'AGENTS.introspect') return answer(200, { items: [], more: false });
      if (v === 'item.get') return answer(200, { item: JSON.stringify({ id: 'goal/G14.8', title: 't', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], go: true }), version: 1, change: 1 });
      if (v === 'item.box') return answer(200, { box: 'the box', version: 1 });
      if (v === 'item.chat') return answer(200, { chat: [], chatMore: false });
      if (v === 'chat.add') return answer(200, { change: 2 });
      if (v === 'signoff') return answer(200, { change: 3 });
      return answer(404, { ok: false, code: 'no-such-item', error: 'the fake desk holds nothing' });
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});
const studio = { chats: [] };
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = JSON.parse(raw); } catch (e) { body = null; }
    function answer(status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    if (p === '/api/models/cached-gguf') return answer(200, { cached: [] });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [] });
    if (p === '/api/inference/status') return answer(200, { active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], supports_tools: true, context_length: STUDIO_CONTEXT });
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push(body);
      return setTimeout(function () { answer(200, { id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: 'seen' }, finish_reason: 'stop' }] }); }, 100);
    }
    answer(404, { detail: 'API endpoint not found' });
  });
});
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-fs-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskUnsloth', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function startAgent() {
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], {
    cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + fake.address().port + '/api/spirit' }),
  });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stopAgent() {
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
    try { const r = await client.ask('api'); if (r && r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return r.body.deskUnsloth; } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}

test.startTest('goal/G14.8: fs tools for Levant, fs.load and fs.save opened');

async function suite() {
  // ── 1. THE VERB FILES ───────────────────────────────────────────────────
  test.subHeading('1. fs.load and fs.save are described to agents by their verb files');
  function verbFile(stem) { try { return JSON.parse(fs.readFileSync(path.join(RUN, 'js', 'fs', stem + '.json'), 'utf8')); } catch (e) { return null; } }
  const loadFile = verbFile('load'), saveFile = verbFile('save');
  if (loadFile && /path/.test(String(loadFile.description)) && /text/.test(String(loadFile.description))) test.check('spirit/run/js/fs/load.json describes fs.load: a file by path, its text');
  else test.fail(OWED + 'spirit/run/js/fs/load.json is ' + short(loadFile));
  if (saveFile && /path/.test(String(saveFile.description)) && /writable root/.test(String(saveFile.description))) test.check('spirit/run/js/fs/save.json describes fs.save: a file by path under a writable root');
  else test.fail(OWED + 'spirit/run/js/fs/save.json is ' + short(saveFile));
  let agentsMd = '';
  try { agentsMd = fs.readFileSync(path.join(RUN, 'js', 'fs', 'AGENTS.md'), 'utf8'); } catch (e) { agentsMd = ''; }
  if (agentsMd && !/until a goal opens them/.test(agentsMd) && /fs\.load/.test(agentsMd) && /fs\.save/.test(agentsMd)) test.check('the fs AGENTS.md names fs.load and fs.save and no longer says the writes wait');
  else test.fail(OWED + 'the fs AGENTS.md still says the writes wait, or does not name load and save');
  let family = null;
  try { family = require('../run/js/introSpector.js').family(path.join(RUN, 'js', 'fs'), { declared: ['search', 'stat', 'annotations', 'save', 'delete', 'annotate', 'load'], prefix: 'fs.' }); } catch (e) { family = null; }
  if (family && family.verbs['fs.AGENTS.load'] && family.verbs['fs.AGENTS.save'] && !family.stale.length) test.check('the family of js/fs carries fs.AGENTS.load and fs.AGENTS.save, with no stale file');
  else test.fail(OWED + 'the fs family: ' + short(family && { verbs: Object.keys(family.verbs), stale: family.stale }));

  // ── 2. THE NODE ─────────────────────────────────────────────────────────
  test.subHeading('2. the node: fs.load answers a served file, the gate is open to an app\'s own source');
  const port = await freePort();
  await bootNode(port);
  const DOOR = 'http://127.0.0.1:' + port + '/api/spirit';
  const listed = await post(DOOR, { verb: 'fs.AGENTS.introspect' });
  const keys = listed.body && Array.isArray(listed.body.items) ? listed.body.items.map(function (i) { return i.key; }) : [];
  if (keys.indexOf('fs.load') !== -1 && keys.indexOf('fs.save') !== -1 && keys.indexOf('fs.search') !== -1) test.check('fs.AGENTS.introspect on the node lists fs.load, fs.save and fs.search');
  else test.fail(OWED + 'fs.AGENTS.introspect listed ' + short(keys) + lastWords());
  const manifestOnDisk = fs.readFileSync(path.join(nodeRoot, MANIFEST), 'utf8');
  const loaded = await post(DOOR, { verb: 'fs.load', path: MANIFEST });
  if (loaded.status === 200 && loaded.body && loaded.body.path === MANIFEST && loaded.body.text === manifestOnDisk) test.check('fs.load {path} answers {path, text}, the file as it is on disk');
  else test.fail(OWED + 'fs.load answered ' + loaded.status + ' ' + short(loaded.text) + lastWords());
  const none = await post(DOOR, { verb: 'fs.load', path: 'shell/textEditor/no-such-file.txt' });
  if (none.status === 404) test.check('fs.load answers 404 for a file that is not there');
  else test.fail(OWED + 'fs.load of a missing file answered ' + none.status);
  const secret = await post(DOOR, { verb: 'fs.load', path: 'relay-state/identity.json' });
  if ((secret.status === 404 || secret.status === 403) && !/SENTINEL/.test(secret.text)) test.check('fs.load refuses relay-state (HTTP ' + secret.status + '): the read gate is the same');
  else test.fail(OWED + 'fs.load of relay-state answered ' + secret.status + ' ' + short(secret.text));
  const entryBefore = fs.readFileSync(path.join(nodeRoot, ENTRY), 'utf8');
  const wroteEntry = await post(DOOR, { verb: 'fs.save', path: ENTRY, content: '// written by deskUnslothFs, restored below\n' });
  const entryAfter = fs.readFileSync(path.join(nodeRoot, ENTRY), 'utf8');
  if (wroteEntry.status >= 200 && wroteEntry.status < 300 && /written by deskUnslothFs/.test(entryAfter)) test.check('fs.save writes an app\'s own entry script under shell (the old app-builder guard is gone)');
  else test.fail(OWED + 'fs.save of the entry script answered ' + wroteEntry.status + ', disk changed ' + (entryAfter !== entryBefore));
  fs.writeFileSync(path.join(nodeRoot, ENTRY), entryBefore, 'utf8');
  const wroteManifest = await post(DOOR, { verb: 'fs.save', path: MANIFEST, content: manifestOnDisk });
  if (wroteManifest.status >= 200 && wroteManifest.status < 300) test.check('fs.save writes an app\'s manifest too');
  else test.fail(OWED + 'fs.save of the manifest answered ' + wroteManifest.status);
  const refusedCore = await post(DOOR, { verb: 'fs.save', path: 'js/kernel.js', content: '// never' });
  const refusedState = await post(DOOR, { verb: 'fs.save', path: 'relay-state/probe.json', content: '{}' });
  const refusedSidecar = await post(DOOR, { verb: 'fs.save', path: 'media/probe.jpg.sidecar.json', content: '{}' });
  if (refusedCore.status === 403 && refusedState.status === 403 && refusedSidecar.status === 403 && !fs.existsSync(path.join(nodeRoot, 'relay-state', 'probe.json'))) test.check('fs.save still refuses js/, relay-state and a sidecar (HTTP 403)');
  else test.fail(OWED + 'fs.save answered core ' + refusedCore.status + ', relay-state ' + refusedState.status + ', sidecar ' + refusedSidecar.status);

  // ── 3. THE OBJECT ───────────────────────────────────────────────────────
  test.subHeading('3. tools.js: describe(fs) through the node, run fs_load and fs_save');
  const mod = require(TOOLS);
  const ask = function (verb, args) { return post(DOOR, Object.assign({ verb: verb }, args || {})); };
  const tools = mod.createTools({ ask: ask, room: TOOL_ROOM });
  const described = await tools.describe('fs');
  const names = Array.isArray(described) ? described.map(function (t) { return t.function && t.function.name; }) : [];
  const byName = {}; (described || []).forEach(function (t) { byName[t.function.name] = t.function; });
  const loadProps = byName.fs_load && byName.fs_load.parameters.properties;
  const saveProps = byName.fs_save && byName.fs_save.parameters.properties;
  if (FS_STEMS.every(function (s) { return names.indexOf('fs_' + s) !== -1; }) && names.length === FS_STEMS.length
      && loadProps && loadProps.path && loadProps.path.type === 'string' && saveProps && saveProps.path && saveProps.path.type === 'string' && saveProps.content && saveProps.content.type === 'string') {
    test.check('describe(fs) gives fs_load, fs_save, fs_search, fs_stat and fs_annotations, typed from the declarations');
  } else test.fail(OWED + 'describe(fs) gave ' + short(names) + ' with fs_load ' + short(loadProps) + ' and fs_save ' + short(saveProps));
  const r1 = await tools.run({ id: 'c1', type: 'function', function: { name: 'fs_load', arguments: JSON.stringify({ path: MANIFEST }) } });
  let r1Body = null; try { r1Body = JSON.parse(r1.text); } catch (e) { r1Body = null; }
  if (r1 && r1.id === 'c1' && r1Body && r1Body.path === MANIFEST && r1Body.text === manifestOnDisk) test.check('run fs_load hands the file back as the verb answered it, with the call\'s id');
  else test.fail(OWED + 'run fs_load answered ' + short(r1));
  const r2 = await tools.run({ id: 'c2', type: 'function', function: { name: 'fs_save', arguments: JSON.stringify({ path: 'shell/textEditor/deskUnslothFs-probe.txt', content: 'probe' }) } });
  const probeOnDisk = (function () { try { return fs.readFileSync(path.join(nodeRoot, 'shell', 'textEditor', 'deskUnslothFs-probe.txt'), 'utf8'); } catch (e) { return null; } })();
  if (r2 && probeOnDisk === 'probe' && !/refused/.test(r2.text)) test.check('run fs_save writes the file under the app\'s folder');
  else test.fail(OWED + 'run fs_save answered ' + short(r2) + ', on disk ' + short(probeOnDisk));
  try { fs.unlinkSync(path.join(nodeRoot, 'shell', 'textEditor', 'deskUnslothFs-probe.txt')); } catch (e) { /* none */ }
  const r3 = await tools.run({ id: 'c3', type: 'function', function: { name: 'fs_save', arguments: JSON.stringify({ path: 'js/kernel.js', content: '// never' }) } });
  if (r3 && /refused/.test(r3.text)) test.check('run fs_save outside the writable roots comes back as a refusal');
  else test.fail(OWED + 'run fs_save of js/kernel.js answered ' + short(r3));

  // ── 4. THE PROCESS ──────────────────────────────────────────────────────
  test.subHeading('4. the process: the call carries the fs tools and no net tool');
  await new Promise(function (r) { fake.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: fake.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'studio-key', url: 'http://127.0.0.1:' + studioServer.address().port + '/v1' }, null, 1));
  startAgent();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskUnsloth never answered api on its pipe (' + short((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  function askAgent(verb, args) { const a = {}; a[verb] = args || {}; return client.ask({ deskUnsloth: a }).then(function (r) { return r.body || {}; }); }
  await askAgent('models', {});
  await sleep(300);
  const s1 = await askAgent('chat.send', { lines: [{ role: 'user', text: 'read textEditor.js' }] });
  await until(function () { return studio.chats.length >= 1; }, 10000);
  let a1 = {};
  for (let i = 0; i < 80; i++) { a1 = await askAgent('chat.answer', { id: s1.id }); if (a1.done) break; await sleep(100); }
  const sent = studio.chats[0] && Array.isArray(studio.chats[0].tools) ? studio.chats[0].tools.map(function (t) { return t.function.name; }) : [];
  const netAsked = nodeAsks.some(function (a) { return /^net\./.test(String(a.verb)); });
  if (sent.indexOf('fs_load') !== -1 && sent.indexOf('fs_save') !== -1 && !sent.some(function (n) { return /^net_/.test(n); }) && !netAsked) test.check('the call to the studio carries fs_load and fs_save and no net tool, and net was never asked');
  else test.fail(OWED + 'the call carried ' + short(sent) + ', net asked ' + netAsked);
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stopAgent();
  if (child) { try { child.kill(); } catch (e) { /* gone */ } }
  try { fake.close(); } catch (e) { /* closed */ }
  try { studioServer.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
