'use strict';

// spirit/test/deskAgentTakesLine.js
// goal/G23.1. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Levant answered Andy under an item and the answer never reached the desk: deskAgent posted without taking Andy's
//   line, the desk refused the post ("take first"), and deskAgent dropped the refusal silently. A line that starts
//   with "Levant:" binds him (a nick binding is an open take) and so went through.
//   Before posting an answer under an item, Levant takes Andy's latest line there (line.take {id}), as every agent must.
//   Every desk write deskAgent makes is checked: a refusal and its reason go into Levant's log (the published
//   state's `log`), never silently dropped.
//
// THE STAND-IN DESK is the fake node's deskClient.desk, holding the real desk's rule for these verbs (desk.js chat.add,
// 'take first', and line.take): chat.add under an item is refused until the poster has taken Andy's latest line there,
// with the body a refusal comes back as through deskClient: {ok:false, code:'bad-request', error, extra:{why}}. A post
// answers the take, so the next post needs a new one.
//
// WHAT IS ASSERTED
//   1. on Andy's line under goal/T1, Levant sends line.take {id:'goal/T1'} before his chat.add there.
//   2. his answer lands: a chat.add under goal/T1 is accepted.
//   3. under goal/T2 the stand-in refuses every chat.add, saying a reason of its own: Levant's published log carries
//      an entry with that reason.
//   4. nothing else breaks: the answer under goal/T1 is accepted at most once, and his answer is asked of the model.
// NOT ASSERTED: the wording or kind of the log entry beyond the desk's reason; what Levant does after a refusal.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.1: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };
const ANSWER = 'I think it is fine as it stands.';
const T2_REASON = 'the stand-in desk refuses every post under goal/T2 (reason R-T2-7731)';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G23.1: Levant takes Andy\'s line before he answers it, and a refused desk write is logged');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothtakesline-'));

// ── THE STAND-IN MODEL: a plain OpenAI server answering plain text ─────
const calls = [];
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      calls.push(b);
      return res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: ANSWER }, finish_reason: 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [{ id: CONFIGURATION.model, object: 'model' }] }));
  });
});

// ── THE STAND-IN DESK, BEHIND THE FAKE NODE's deskClient ───────────────
const ITEMS = {
  'goal/T1': { id: 'goal/T1', title: 'Take one', goal: '', status: '', with: '', go: false, files: [] },
  'goal/T2': { id: 'goal/T2', title: 'Take two', goal: '', status: '', with: '', go: false, files: [] },
};
const writes = [];      // every desk write Levant makes, in order: {verb, id, ok}
const taken = {};       // item id -> Andy's latest line there is taken and not yet answered
let nextQueue = [];
const published = [];
function refusal(why) { return { ok: false, code: 'bad-request', error: 'text required', extra: { why: why } }; }
function deskAnswer(verb, a) {
  if (verb === 'AGENTS') return { text: 'Rules for agents.' };
  if (verb === 'AGENTS.introspect') return { items: [], more: false };
  if (verb === 'item.files') return { files: (ITEMS[a.id] || {}).files || [], filesMore: false };
  if (verb === 'items.search') return { items: Object.keys(ITEMS).map(function (k) { return { key: k, label: JSON.stringify(ITEMS[k]) }; }), more: false };
  const it = ITEMS[a.id];
  if (verb === 'item.get') return it ? { item: JSON.stringify(it), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.box') return { box: 'the box of ' + a.id, version: 1 };
  if (verb === 'item.chat') return { chat: [{ by: 'andy', text: 'what do you think?' }], chatMore: false };
  if (verb === 'line.take') {
    if (!it) { writes.push({ verb: verb, id: a.id, ok: false }); return { ok: false, code: 'no-such-item' }; }
    taken[a.id] = true;
    writes.push({ verb: verb, id: a.id, ok: true });
    return { change: 1 };
  }
  if (verb === 'chat.add') {
    if (a.id === 'goal/T2') { writes.push({ verb: verb, id: a.id, ok: false, text: a.text }); return refusal(T2_REASON); }
    if (!taken[a.id]) {
      writes.push({ verb: verb, id: a.id, ok: false, text: a.text });
      return refusal('take first: ' + NODE_NAME + ' holds neither the take of Andy\'s latest line under ' + a.id + ' (line.take) nor the item (item.take)');
    }
    taken[a.id] = false; // a post answers the take
    writes.push({ verb: verb, id: a.id, ok: true, text: a.text });
    return { change: 1 };
  }
  writes.push({ verb: verb, id: a.id, ok: true });
  return { change: 1 };
}
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}.
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    const ask = test.foldAsk(b);
    if (ask && ask.deskClient && ask.deskClient.next) {
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (ask && ask.deskClient && ask.deskClient.desk) {
      let a = {}; try { a = JSON.parse(ask.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
      return answer(200, deskAnswer(String(ask.deskClient.desk.name), a));
    }
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
let client = null;
const out = { stdout: '', stderr: '', code: null };

// Every log entry ever published, once each by seq (as deskAgentAbort.js reads them).
function logEntries() {
  const seen = {};
  const all = [];
  published.forEach(function (o) { (Array.isArray(o.log) ? o.log : []).forEach(function (e) { if (e && e.seq !== undefined && !seen[e.seq]) { seen[e.seq] = true; all.push(e); } }); });
  return all;
}
function on(id, verb) { return writes.filter(function (w) { return w.id === id && w.verb === verb; }); }

async function suite() {
  fs.mkdirSync(state, { recursive: true });
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studio.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  // Connected at start only with the desk-recommended mark (goal/G10.9), as deskAgentAgent.js sets it.
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k' }));
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  const st = (await client.ask({ deskAgent: { state: {} } })).body || {};
  if (st.connected === true) test.check('the world: Levant starts connected');
  else { test.fail('the world: Levant is not connected: ' + short(st)); return; }
  await sleep(800); // past the backlog: the first empty next

  test.subHeading('1 and 2. Andy\'s line under goal/T1: taken first, then answered');
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'goal/T1', text: 'what do you think?' })]);
  await until(function () { return calls.length >= 1; }, 8000);
  if (calls.length >= 1) test.check('the world: Andy\'s line reached the model');
  else test.fail('the world: the model was never asked (' + short(out.stdout.slice(-300)) + ')');
  await until(function () { return on('goal/T1', 'chat.add').length >= 1; }, 8000);
  await sleep(500);
  const t1 = writes.filter(function (w) { return w.id === 'goal/T1'; });
  const firstTake = t1.findIndex(function (w) { return w.verb === 'line.take'; });
  const firstAdd = t1.findIndex(function (w) { return w.verb === 'chat.add'; });
  if (firstTake !== -1 && firstAdd !== -1 && firstTake < firstAdd) test.check('line.take {id:"goal/T1"} goes before his chat.add there');
  else test.fail(OWED + 'Levant did not take Andy\'s line before posting under goal/T1; his writes there in order: ' + short(t1.map(function (w) { return w.verb + (w.ok ? '' : ' (refused)'); })));
  const accepted = on('goal/T1', 'chat.add').filter(function (w) { return w.ok; });
  if (accepted.length >= 1 && accepted[0].text.indexOf(ANSWER) !== -1) test.check('his answer lands: a chat.add under goal/T1 accepted, carrying the model\'s answer');
  else test.fail(OWED + 'his answer never landed under goal/T1: ' + on('goal/T1', 'chat.add').length + ' chat.add sent, ' + accepted.length + ' accepted');

  test.subHeading('3. a refused post is in his log with the desk\'s reason');
  const callsBefore = calls.length;
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'goal/T2', text: 'and here?' })]);
  await until(function () { return calls.length > callsBefore; }, 8000);
  await until(function () { return on('goal/T2', 'chat.add').length >= 1; }, 8000);
  await sleep(800);
  if (on('goal/T2', 'chat.add').length >= 1) test.check('the world: Levant posted under goal/T2 and the stand-in refused it');
  else test.fail('the world: no chat.add under goal/T2 (' + calls.length + ' model calls)');
  const logged = logEntries().filter(function (e) { return String(e.text || '').indexOf('R-T2-7731') !== -1; });
  if (logged.length) test.check('his published log carries the refusal with the desk\'s reason: ' + short(logged[0]));
  else test.fail(OWED + 'the refusal under goal/T2 is not in Levant\'s published log; ' + logEntries().length + ' entries, kinds ' + short(logEntries().map(function (e) { return e.from + '/' + e.kind; })));

  test.subHeading('4. nothing else breaks');
  if (accepted.length <= 1) test.check('the answer under goal/T1 is accepted at most once (' + accepted.length + ')');
  else test.fail('the answer under goal/T1 was posted ' + accepted.length + ' times');
  if (out.code === null) test.check('deskAgent is still up');
  else test.fail('deskAgent exited ' + out.code + ': ' + short(out.stderr));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
