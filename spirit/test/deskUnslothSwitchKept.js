'use strict';

// spirit/test/deskUnslothSwitchKept.js
// goal/G18.9: deskUnsloth: a provider switch leaves Levant live on the desk. Red on today's code (36d83ff3);
// claude-windows wrote it and builds it (one agent). The item's box (v3):
//   FOUND: after a provider switch the desk still listed ollama agent node as live; and a restart reconnects him
//   whenever the loaded model has 🧵, whatever his last switch said.
//   SHAPE: a provider switch signs Levant off first and leaves him visibly gone from the desk; the connect switch is
//   kept in deskUnsloth's state folder, and a start is connected only when the last switch said connected and the
//   model still has 🧵.
// Found in the record, 2026-10-12 (the box's "find first"): the signoff reached the desk (change 35021), and Levant
// went on writing after it, two check.set, a chat.add, item.status and item.files.add, each of which makes an agent
// live again for ten minutes. A disconnect stopped his listening; an answer already in flight ran on.
//
// WHAT IS ASSERTED
//   1. a disconnect while an answer is in flight: the model's desk tool call that comes back is not run, and no
//      answer is posted; nothing reaches the desk after the signoff but reads.
//   2. the switch is kept: disconnected, a restart starts disconnected (no asks for next lines, no desk word);
//      connected again, a restart starts connected.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G18.9: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const NODE_NAME = 'ollama agent node';
const MODEL = 'gpt-test';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: MODEL, answerTokens: 100, bytesPerToken: 4 };
const READS = ['AGENTS', 'item.get', 'item.box', 'item.chat', 'items.search', 'items.find', 'chat.search', 'log.search', 'rule.get', 'pending.get', 'profile.get', 'changes'];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G18.9: a disconnect stops Levant at once, and the switch outlives a restart');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothswitchkept-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}

// ── THE FAKE SERVER: a plain OpenAI one, its first answer slow and asking for a desk tool ──
const chats = [];
let slowMs = 0;
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const send = function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const p = new URL(req.url, 'http://x').pathname;
    if (p.indexOf('/api/') === 0) return send(404, { error: { message: 'no such route' } });
    if (p === '/v1/models') return send(200, { object: 'list', data: [{ id: MODEL, object: 'model' }] });
    if (req.method === 'POST' && p === '/v1/chat/completions') {
      chats.push(b);
      const answer = Array.isArray(b.messages) && b.messages.some(function (m) { return m.role === 'tool'; })
        ? { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Levant: my answer after the tool' } }] }
        : { choices: [{ index: 0, finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'desk_check_set', arguments: JSON.stringify({ id: 'sk/G1.1', check: 'Q1', state: 'failed' }) } }] } }] };
      return setTimeout(function () { send(200, answer); }, slowMs);
    }
    send(200, {});
  });
});

// ── THE FAKE NODE: deskClient next and desk, every desk word kept with its time ──
let nextQueue = [];
let nextCount = 0;
const deskWords = [];
const ITEMS = [{ id: 'sk/G1', title: 'Kept', goal: '', status: '', with: '', go: false, files: [] }, { id: 'sk/G1.1', title: 'Asked', goal: 'sk/G1', status: '', with: '', go: false, files: [] }];
function deskAnswer(verb, a) {
  const verbs = deskVerbFiles();
  if (verb === 'AGENTS') return { text: 'Rules for agents.' };
  if (verb === 'AGENTS.introspect') return { items: Object.keys(verbs).map(function (v) { return { key: v, label: verbs[v].description }; }), more: false };
  if (verb.indexOf('AGENTS.') === 0) return verbs[verb.slice(7)] || { ok: false, code: 'no-such-verb' };
  if (verb === 'items.search') return { items: ITEMS.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
  const it = ITEMS.filter(function (i) { return i.id === a.id; })[0];
  if (verb === 'item.get') return it ? { item: JSON.stringify(it), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.box') return { box: 'the box of ' + a.id, version: 1 };
  if (verb === 'item.chat') return { chat: [], chatMore: false };
  return { change: 1 };
}
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = function (status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) {
      nextCount++;
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (ask && ask.deskClient && ask.deskClient.desk) {
      let a = {}; try { a = JSON.parse(ask.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
      const verb = String(ask.deskClient.desk.verb);
      if (verb.indexOf('AGENTS') !== 0) deskWords.push({ verb: verb, args: a, at: Date.now() });
      return answer(200, deskAnswer(verb, a));
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
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', function () { r(); }); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskUnsloth: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };

async function suite() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studio.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify([{ name: 'openai', url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k', use: true, model: MODEL }]));
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ pairs: { openai: { active: MODEL, activeQuant: '', studio: false, models: [{ id: MODEL, quant: '', loaded: true, bytes: 0, task: '', vision: false, reasoning: false, audio: false, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] } } }));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not start: ' + short(out.stderr)); return; }

  test.subHeading('1. a disconnect while an answer is in flight');
  const s0 = await ask('state', {});
  if (s0.connected === true) test.check('the world: it starts connected (🧵 on the model in use)');
  else test.fail('the world: it starts ' + short(s0));
  await until(function () { return nextCount >= 2; }, 5000);
  await sleep(500);
  slowMs = 2500;
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'sk/G1.1', text: 'Levant: what do you make of this?' })]);
  await until(function () { return chats.length >= 1; }, 8000);
  if (chats.length >= 1) test.check('the world: the model was asked, and its answer is slow');
  else test.fail('the world: the model was never asked: ' + short(out.stderr));
  const offAt = Date.now();
  await ask('connect', { on: false });
  await sleep(6000);
  const after = deskWords.filter(function (w) { return w.at >= offAt; });
  const signoff = after.filter(function (w) { return w.verb === 'signoff'; });
  const writes = after.filter(function (w) { return w.verb !== 'signoff' && READS.indexOf(w.verb) === -1; });
  if (signoff.length === 1) test.check('the world: one signoff went to the desk');
  else test.fail('the world: signoffs after the disconnect: ' + signoff.length);
  if (!writes.some(function (w) { return w.verb === 'check.set'; })) test.check('the desk tool the slow answer asked for was not run');
  else test.fail(OWED + 'after the disconnect the tool still ran: ' + short(writes));
  if (!writes.length) test.check('nothing but reads reached the desk after the signoff: no answer posted');
  else test.fail(OWED + 'after the disconnect the desk was written: ' + short(writes.map(function (w) { return w.verb + ' ' + JSON.stringify(w.args).slice(0, 60); })));
  slowMs = 0;

  test.subHeading('2. the switch outlives a restart');
  await stop();
  nextCount = 0;
  const wordsBefore = deskWords.length;
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not come back: ' + short(out.stderr)); return; }
  await sleep(1500);
  const s1 = await ask('state', {});
  if (s1.connected === false && nextCount === 0 && deskWords.length === wordsBefore) test.check('disconnected before the restart: it starts disconnected, asks no lines and writes nothing');
  else test.fail(OWED + 'after a restart: connected ' + s1.connected + ', ' + nextCount + ' ask(s) for lines, ' + (deskWords.length - wordsBefore) + ' desk word(s)');
  await ask('connect', { on: true });
  await stop();
  nextCount = 0;
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not come back the second time: ' + short(out.stderr)); return; }
  await until(function () { return nextCount >= 1; }, 5000);
  const s2 = await ask('state', {});
  if (s2.connected === true && nextCount >= 1) test.check('connected before the restart: it starts connected and asks for lines');
  else test.fail(OWED + 'after connecting and a restart: connected ' + s2.connected + ', ' + nextCount + ' ask(s)');
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
