'use strict';

// spirit/test/deskAgentCurrentGoal.js
// goal/G24.3. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Every call deskAgent makes for Levant tells him which goal is current: its id, title and box.
//   Today his prompt carries only the box of the goal of the item he answers under; he learns the current goal only
//   when he happens to search, and Andy saw him answer about G23 after G24 was made current.
//
// HOW THE DESK SAYS WHICH GOAL IS CURRENT, READ AT 125f8cb1: items.search {text: '', currentGoalOnly: true,
// goalsOnly: true, includeClosed: false} answers the current goal alone (desk.js searchItems: goals filtered to
// s.current, a closed current goal still shown), its facts as the label (id, title); item.box {id} gives its box. A
// make-current press (OWNER_PRESSES) moves s.current. The stand-in desk here answers those verbs the same way.
//
// THE WORLD: goals g/G7 ("Alpha goal", box BOX-OF-ALPHA) and g/G9 ("Beta goal", box BOX-OF-BETA); item g/G7.1 under
// g/G7 (box BOX-OF-ITEM). g/G7 is current at first. Levant connected, a stand-in model answering plain text.
//
// WHAT IS ASSERTED, in the messages of the chat request the model receives:
//   1. Andy's line under g/G7.1, g/G7 current: a message saying "current" names g/G7, "Alpha goal" and BOX-OF-ALPHA.
//   2. after Andy's make-current press on g/G9 (the desk now answering g/G9 as current), his next line under g/G7.1:
//      a message saying "current" names g/G9, "Beta goal" and BOX-OF-BETA, and none saying "current" names
//      "Alpha goal".
//   3. that call still carries the item's own goal box (BOX-OF-ALPHA) and the item's box, the item's goal not being
//      the current one.
// NOT ASSERTED: the wording or the place (system text or head) beyond the word "current" in the same message.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G24.3: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G24.3: every call tells Levant which goal is current');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothcurrentgoal-'));

// ── THE STAND-IN MODEL ──
const calls = [];
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      calls.push(b);
      return res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'noted' }, finish_reason: 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [] }));
  });
});

// ── THE STAND-IN DESK ──
const ITEMS = {
  'g/G7': { id: 'g/G7', title: 'Alpha goal', goal: '', status: '', with: '', go: false, files: [] },
  'g/G9': { id: 'g/G9', title: 'Beta goal', goal: '', status: '', with: '', go: false, files: [] },
  'g/G7.1': { id: 'g/G7.1', title: 'An item of alpha', goal: 'g/G7', status: '', with: '', go: false, files: [] },
};
const BOXES = { 'g/G7': 'BOX-OF-ALPHA', 'g/G9': 'BOX-OF-BETA', 'g/G7.1': 'BOX-OF-ITEM' };
let current = 'g/G7';
let nextQueue = [];
function deskAnswer(verb, a) {
  if (verb === 'AGENTS') return { text: 'Rules for agents.' };
  if (verb === 'AGENTS.introspect') return { items: [], more: false };
  if (verb === 'item.files') return { files: (ITEMS[a.id] || {}).files || [], filesMore: false };
  if (verb === 'items.search') {
    let ids = Object.keys(ITEMS);
    if (a.goalsOnly) ids = ids.filter(function (k) { return !ITEMS[k].goal; });
    if (a.currentGoalOnly) ids = ids.filter(function (k) { return k === current || ITEMS[k].goal === current; });
    ids.sort(function (x, y) { return x === current ? -1 : y === current ? 1 : 0; });
    return { items: ids.map(function (k) { return { key: k, label: JSON.stringify(ITEMS[k]) }; }), more: false };
  }
  const it = ITEMS[a.id];
  if (verb === 'item.get') return it ? { item: JSON.stringify(it), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.box') return it ? { box: BOXES[a.id], version: 1 } : { ok: false, code: 'no-such-item' };
  if (verb === 'item.chat') return { chat: [], chatMore: false };
  return { change: 1 };
}
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
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
const out = { stderr: '', code: null };

// The call made for one desk line: the first request after it whose messages carry that line.
function callFor(marker, from) { return calls.slice(from).filter(function (c) { return JSON.stringify(c.messages || []).indexOf(marker) !== -1; })[0] || null; }
function contents(c) { return ((c && c.messages) || []).map(function (m) { return String(m.content || ''); }); }
function namesCurrent(c, id, title, box) {
  const idRe = new RegExp(id.replace(/[/.]/g, '\\$&') + '(?![.\\d])');
  return contents(c).some(function (t) { return /current/i.test(t) && idRe.test(t) && t.indexOf(title) !== -1 && t.indexOf(box) !== -1; });
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

  test.subHeading('1. g/G7 current: his call names it');
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'g/G7.1', text: 'FIRST-LINE what now?' })]);
  await until(function () { return !!callFor('FIRST-LINE', 0); }, 8000);
  const c1 = callFor('FIRST-LINE', 0);
  if (c1) test.check('the world: Andy\'s first line reached the model');
  else { test.fail('the world: the first line never reached the model'); return; }
  if (namesCurrent(c1, 'g/G7', 'Alpha goal', 'BOX-OF-ALPHA')) test.check('a message says the current goal is g/G7, "Alpha goal", with its box');
  else test.fail(OWED + 'no message of the call says current with g/G7, "Alpha goal" and BOX-OF-ALPHA: ' + short(contents(c1).slice(1)));

  test.subHeading('2. Andy makes g/G9 current: the next call names it, not the old');
  await sleep(500);
  const from = calls.length;
  current = 'g/G9';
  nextQueue.push(['DESK andy press ' + JSON.stringify({ id: 'g/G9', what: 'make-current' })]);
  await sleep(1500);
  nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'g/G7.1', text: 'SECOND-LINE and now?' })]);
  await until(function () { return !!callFor('SECOND-LINE', from); }, 10000);
  const c2 = callFor('SECOND-LINE', from);
  if (c2) test.check('the world: Andy\'s second line reached the model');
  else { test.fail('the world: the second line never reached the model'); return; }
  if (namesCurrent(c2, 'g/G9', 'Beta goal', 'BOX-OF-BETA')) test.check('a message says the current goal is g/G9, "Beta goal", with its box');
  else test.fail(OWED + 'after make-current no message says current with g/G9, "Beta goal" and BOX-OF-BETA: ' + short(contents(c2).slice(1)));
  const stale = contents(c2).filter(function (t) { return /current/i.test(t) && t.indexOf('Alpha goal') !== -1; });
  if (!stale.length) test.check('no message saying current names the old "Alpha goal"');
  else test.fail(OWED + 'a message saying current still names "Alpha goal": ' + short(stale[0]));

  test.subHeading('3. the item\'s own goal box is still there');
  const all2 = contents(c2).join('\n');
  if (all2.indexOf('BOX-OF-ALPHA') !== -1 && all2.indexOf('BOX-OF-ITEM') !== -1) test.check('the call carries the item\'s goal box and the item\'s box');
  else test.fail('the call lost the item\'s goal box or the item\'s box: ' + short(contents(c2).slice(1)));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
