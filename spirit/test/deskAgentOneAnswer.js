'use strict';

// spirit/test/deskAgentOneAnswer.js
// goal/G24.2. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   One turn of Levant's is one answer under the item, taken first.
//   Today he can post with his own chat tool during a turn and then have his final answer posted as well, so one turn
//   makes two posts.
//   His turn ends in one post: either what he posted with the tool stands as his answer and no final answer is posted,
//   or the final answer alone is posted; the line is taken first either way.
//
// THE WORLD (deskAgentTakesLine.js's): a stand-in desk behind the fake node's deskClient.desk, offering chat.add as
// a desk tool from the real desk/chat.add.json. Under an item with a line of Andy's, chat.add is refused "take first"
// until the line is taken, as the real desk does; a line that starts with "Levant:" binds him (an open take), so his
// tool post goes through at once, as it did live. Posts are not limited past the take, so a second post shows.
// A stand-in model scripted by the line it answers:
//   TOOLPOST-SAME   calls desk_chat_add under its own item, then ends with final text;
//   TOOLPOST-OTHER  calls desk_chat_add under goal/T9, another item, then ends with final text;
//   NOPOST          ends with final text alone.
//
// WHAT IS ASSERTED
//   1. a turn that posts with the tool under its own item (goal/T1): exactly one accepted chat.add under goal/T1, and
//      line.take {id: goal/T1} goes before it.
//   2. a turn that posts with the tool under another item (goal/T9): its tool post lands there, and exactly one
//      chat.add is accepted under its own item (goal/T2), the final answer, after line.take.
//   3. a turn with no tool post (goal/T3): its final answer is posted once, after line.take.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G24.2: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const CHAT_ADD = JSON.parse(fs.readFileSync(path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk', 'chat.add.json'), 'utf8'));
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G24.2: one turn of Levant\'s is one answer under the item, taken first');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothoneanswer-'));

// ── THE STAND-IN MODEL ──
const calls = [];
function toolCall(id, args) { return { id: id, type: 'function', function: { name: 'desk_chat_add', arguments: JSON.stringify(args) } }; }
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      calls.push(b);
      const said = JSON.stringify(b.messages || []);
      const toolDone = (b.messages || []).some(function (m) { return m.role === 'tool'; });
      let message = { role: 'assistant', content: 'the final answer' };
      if (/TOOLPOST-SAME/.test(said) && !toolDone) message = { role: 'assistant', content: '', tool_calls: [toolCall('same-1', { id: 'goal/T1', text: 'Levant: posted with the tool under T1' })] };
      else if (/TOOLPOST-SAME/.test(said)) message = { role: 'assistant', content: 'final SAME' };
      else if (/TOOLPOST-OTHER/.test(said) && !toolDone) message = { role: 'assistant', content: '', tool_calls: [toolCall('other-1', { id: 'goal/T9', text: 'Levant: a note for T9' })] };
      else if (/TOOLPOST-OTHER/.test(said)) message = { role: 'assistant', content: 'final OTHER' };
      else if (/NOPOST/.test(said)) message = { role: 'assistant', content: 'final NOPOST' };
      return res.end(JSON.stringify({ choices: [{ index: 0, message: message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [] }));
  });
});

// ── THE STAND-IN DESK ──
const ITEMS = {};
['goal/T1', 'goal/T2', 'goal/T3', 'goal/T9'].forEach(function (id) { ITEMS[id] = { id: id, title: id, goal: '', status: '', with: '', go: false, files: [] }; });
const ANDY_LINE = { 'goal/T1': true, 'goal/T2': true, 'goal/T3': true };  // items with a line of Andy's to take
const taken = {};
const writes = [];   // {verb, id, ok, text}, in order
let nextQueue = [];
function deskAnswer(verb, a) {
  if (verb === 'AGENTS') return { text: 'Rules for agents.' };
  if (verb === 'AGENTS.introspect') return { items: [{ key: 'chat.add', label: 'chat.add' }], more: false };
  if (verb === 'AGENTS.chat.add') return CHAT_ADD;
  if (verb === 'items.search') return { items: [], more: false };
  const it = ITEMS[a.id];
  if (verb === 'item.get') return it ? { item: JSON.stringify(it), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.box') return { box: 'the box of ' + a.id, version: 1 };
  if (verb === 'item.chat') return { chat: [], chatMore: false };
  if (verb === 'line.take') { taken[a.id] = true; writes.push({ verb: verb, id: a.id, ok: true }); return { change: 1 }; }
  if (verb === 'chat.add') {
    if (ANDY_LINE[a.id] && !taken[a.id]) { writes.push({ verb: verb, id: a.id, ok: false, text: a.text }); return { ok: false, code: 'bad-request', error: 'text required', extra: { why: 'take first: ' + NODE_NAME + ' holds neither the take of Andy\'s latest line under ' + a.id + ' (line.take) nor the item (item.take)' } }; }
    writes.push({ verb: verb, id: a.id, ok: true, text: a.text });
    return { change: 1 };
  }
  return { change: 1 };
}
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) {
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    }
    if (ask && ask.deskClient && ask.deskClient.desk) {
      let a = {}; try { a = JSON.parse(ask.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
      const body = deskAnswer(String(ask.deskClient.desk.verb), a);
      return answer(200, body);
    }
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
let client = null;
const out = { stderr: '', code: null };
function on(id) { return writes.filter(function (w) { return w.id === id; }); }
function accepted(id) { return on(id).filter(function (w) { return w.verb === 'chat.add' && w.ok; }); }
function takeBeforePost(id) {
  const ws = on(id);
  const t = ws.findIndex(function (w) { return w.verb === 'line.take'; });
  const p = ws.findIndex(function (w) { return w.verb === 'chat.add' && w.ok; });
  return t !== -1 && p !== -1 && t < p;
}
function order(id) { return on(id).map(function (w) { return w.verb + (w.verb === 'chat.add' ? (w.ok ? ' ok' : ' refused') + ' "' + String(w.text).slice(0, 40) + '"' : ''); }); }
async function turn(id, text, ms) {
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: id, text: text })]);
  await until(function () { return accepted(id).length >= 1; }, ms || 10000);
  await sleep(1500); // a second post, if there is one, lands in this time
}

async function suite() {
  fs.mkdirSync(state, { recursive: true });
  for (const s of [node, studio]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k' }));
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  const st = (await client.ask({ deskAgent: { state: {} } })).body || {};
  if (st.connected !== true) { test.fail('the world: Levant is not connected: ' + short(st)); return; }
  await sleep(800); // past the backlog

  test.subHeading('1. a tool post under its own item: one post, taken first');
  // "Levant:" binds the line to him, an open take, as it did live: his tool post goes through at once.
  taken['goal/T1'] = true;
  await turn('goal/T1', 'Levant: TOOLPOST-SAME what do you think?');
  const offered = calls.length && Array.isArray(calls[0].tools) && calls[0].tools.some(function (t) { return t.function && t.function.name === 'desk_chat_add'; });
  if (offered) test.check('the world: desk_chat_add is offered to the model');
  else test.fail('the world: desk_chat_add is not offered: ' + short(calls[0] && calls[0].tools));
  const a1 = accepted('goal/T1');
  if (a1.length === 1) test.check('exactly one post under goal/T1: ' + short(a1[0].text));
  else test.fail(OWED + a1.length + ' posts under goal/T1 in one turn: ' + short(order('goal/T1')));
  if (takeBeforePost('goal/T1')) test.check('line.take {id: goal/T1} goes before it');
  else test.fail(OWED + 'no line.take before the post under goal/T1: ' + short(order('goal/T1')));

  test.subHeading('2. a tool post under another item: its own item still gets one answer');
  await turn('goal/T2', 'TOOLPOST-OTHER and here?');
  await until(function () { return accepted('goal/T9').length >= 1; }, 3000);
  if (accepted('goal/T9').length === 1) test.check('the tool post lands under goal/T9');
  else test.fail('the tool post under goal/T9: ' + short(order('goal/T9')));
  const a2 = accepted('goal/T2');
  if (a2.length === 1 && /final OTHER/.test(a2[0].text) && takeBeforePost('goal/T2')) test.check('exactly one post under goal/T2, the final answer, after line.take');
  else test.fail(OWED + 'under goal/T2: ' + short(order('goal/T2')));

  test.subHeading('3. no tool post: the final answer, once');
  await turn('goal/T3', 'NOPOST just answer');
  const a3 = accepted('goal/T3');
  if (a3.length === 1 && /final NOPOST/.test(a3[0].text) && takeBeforePost('goal/T3')) test.check('exactly one post under goal/T3, the final answer, after line.take');
  else test.fail(OWED + 'under goal/T3: ' + short(order('goal/T3')));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
