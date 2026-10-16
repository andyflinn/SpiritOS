'use strict';

// spirit/test/deskAgentDeskName.js
// goal/G23.2. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   the desk names every write of Levant's by his node's name ("ollama agent node" on 11111). deskAgent knows that
//   name (NODE_NAME, from --node at start) but never told the model, so Levant took his own take of Andy's line for
//   another agent's and held back his answer.
//   Every call deskAgent makes for Levant at the desk tells him, in the system text after the preamble: at the desk
//   your writes show as <node name>; a line, take or item under that name is yours.
//   The name is the node's own, as deskAgent is handed it at start; nothing is configured.
//
// WHAT IS ASSERTED
//   1. started with --node {name: 'ollama agent node'}: the chat request the stand-in model gets for Andy's desk line
//      has a system message holding the preamble and, after it, the node's name, in text that says it is his ("yours").
//   2. started with --node carrying no name: the system text holds nothing after the preamble (no sentence with an
//      empty name, no "undefined").
// NOT ASSERTED: the exact wording of the sentence beyond the name and "yours"; the test tab's chat (not at the desk).
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.2: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const PREAMBLE = 'you are Levant';
const CONFIGURATION = { persona: 'Levant', preamble: PREAMBLE, model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G23.2: Levant is told the name the desk writes his changes under');

// ONE WORLD PER START: a stand-in model recording its chat requests, a fake node acting as the desk (as in
// deskAgentTakesLine.js), and deskAgent started with the --node given. Returns the system text of the first chat
// request made for Andy's line, or null.
async function systemFor(nodeArg, label) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothdeskname-'));
  const calls = [];
  const studio = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
        calls.push(b);
        return res.end(JSON.stringify({ choices: [{ index: 0, message: { role: 'assistant', content: 'fine' }, finish_reason: 'stop' }] }));
      }
      res.end(JSON.stringify({ object: 'list', data: [{ id: CONFIGURATION.model, object: 'model' }] }));
    });
  });
  const nextQueue = [];
  function deskAnswer(verb, a) {
    if (verb === 'AGENTS') return { text: 'Rules for agents.' };
    if (verb === 'AGENTS.introspect') return { items: [], more: false };
    if (verb === 'item.get') return a.id === 'goal/T1' ? { item: JSON.stringify({ id: 'goal/T1', title: 'Take one', goal: '', status: '', with: '', go: false, files: [] }), version: 1, change: 1 } : { ok: false, code: 'no-such-item' };
    if (verb === 'item.box') return { box: 'the box of ' + a.id, version: 1 };
    if (verb === 'item.chat') return { chat: [{ by: 'andy', text: 'what do you think?' }], chatMore: false };
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
        return answer(200, deskAnswer(String(ask.deskClient.desk.verb), a));
      }
      answer(404, { ok: false, code: 'no-such-verb' });
    });
  });
  const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
  const out = { stderr: '', code: null };
  let kid = null;
  let system = null;
  try {
    fs.mkdirSync(state, { recursive: true });
    await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
    await new Promise(function (r) { studio.listen(0, '127.0.0.1', r); });
    fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
    fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
    // Connected at start only with the desk-recommended mark (goal/G10.9), as deskAgentAgent.js sets it.
    fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
    fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k' }));
    kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify(nodeArg)],
      { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
    kid.stderr.on('data', function (c) { out.stderr += c; });
    kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
    const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
    client.register('deskAgent', pipe);
    let up = false;
    for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world (' + label + '): deskAgent did not start: ' + short(out.stderr)); return null; }
    const st = (await client.ask({ deskAgent: { state: {} } })).body || {};
    if (st.connected !== true) { test.fail('the world (' + label + '): Levant is not connected: ' + short(st)); return null; }
    await sleep(800); // past the backlog: the first empty next
    nextQueue.push(['DESK andy chat.add ' + JSON.stringify({ id: 'goal/T1', text: 'what do you think?' })]);
    await until(function () { return calls.length >= 1; }, 8000);
    if (!calls.length) { test.fail('the world (' + label + '): Andy\'s line never reached the model'); return null; }
    test.check('the world (' + label + '): Andy\'s line under goal/T1 reached the model');
    const sys = ((calls[0].messages || []).filter(function (m) { return m.role === 'system'; })[0] || {}).content;
    system = typeof sys === 'string' ? sys : null;
    await sleep(500); // let the answer post before the stop
  } finally {
    if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
    try { node.close(); studio.close(); } catch (e) { /* closed */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
  return system;
}

async function suite() {
  test.subHeading('1. started with a node name: the desk call\'s system text names it, after the preamble');
  const named = await systemFor({ name: NODE_NAME, publicKey: 'K' }, 'named');
  if (named !== null) {
    const pre = named.indexOf(PREAMBLE);
    const after = pre === -1 ? '' : named.slice(pre + PREAMBLE.length);
    if (pre !== -1) test.check('the system text holds the preamble');
    else test.fail('the system text has no preamble: ' + short(named));
    if (after.indexOf(NODE_NAME) !== -1) test.check('after the preamble it names the node: "' + NODE_NAME + '"');
    else test.fail(OWED + 'the system text does not name "' + NODE_NAME + '" after the preamble: ' + short(named));
    if (after.indexOf(NODE_NAME) !== -1 && /\byours\b/i.test(after)) test.check('and says what is under that name is his ("yours")');
    else test.fail(OWED + 'the system text after the preamble does not say what is under "' + NODE_NAME + '" is his: ' + short(after));
  }

  test.subHeading('2. started without a node name: no sentence with an empty name');
  const nameless = await systemFor({ publicKey: 'K' }, 'nameless');
  if (nameless !== null) {
    const pre = nameless.indexOf(PREAMBLE);
    const after = pre === -1 ? null : nameless.slice(pre + PREAMBLE.length);
    if (after !== null && after.trim() === '' && nameless.indexOf('undefined') === -1) test.check('the system text holds nothing after the preamble');
    else test.fail('without a node name the system text reads: ' + short(nameless));
  }
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
