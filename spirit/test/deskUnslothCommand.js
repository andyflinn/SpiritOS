'use strict';

// spirit/test/deskUnslothCommand.js
// goal/G23.8. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Levant runs a command in his clone, as cw runs one in its clone: the answer is its exit code and its output, the
//   output cut to one answer with the cut said, and a command that runs too long is stopped and says so.
//   His clone is the checkout node 11111 runs from, so a command there can stop or break that node (recorded; no
//   guard asked).
//
// THE SHAPE CHOSEN (this suite fixes it):
//   deskUnsloth verb command.run, request {command, timeoutMs}: command a shell command line; timeoutMs 0 for the
//   default (120000), capped at 600000 as cw's Bash is. It runs through a shell found on the machine (bash when there
//   is one, else the platform's own), its working folder the clone root.
//   reply {exit, output, cut, timedOut}: exit the exit code; output stdout and stderr interleaved as they came, cut to
//   its LAST part (errors land at the end) at a whole line, so the whole reply fits one answer; cut true when cut;
//   timedOut true when it ran past timeoutMs and was stopped, its process tree killed (that tree only).
//   command.run.json describes it. It writes, so it is not answered to the model while Levant is disconnected.
// The suite's commands are `node -e "..."` alone, with single quotes inside, so any shell runs them the same.
//
// WHAT IS ASSERTED
//   1. command.run.json: request command, timeoutMs; AGENTS.introspect lists command.run.
//   2. a command that prints and exits 3: exit 3, the text in output, cut false, timedOut false; stderr is in output.
//   3. its working folder is the clone root.
//   4. ~100 KB of output: the reply under ANSWER_MAX, cut true, the output its last whole lines, the final line kept.
//   5. a command past a 1500 ms timeoutMs: timedOut true, answered within a few seconds, its process gone.
//   6. the model is offered deskUnsloth_command_run; disconnected its call is refused and nothing runs; connected the
//      same call runs.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.8: ';
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth');
const AGENT = path.join(DIR, 'deskUnsloth.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };
const ANSWER_MAX = appClient.ANSWER_MAX;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

test.startTest('goal/G23.8: Levant runs a command in his clone');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothcommand-'));
const repo = path.join(scratch, 'clone');
const MARKER = path.join(scratch, 'model-ran.txt');

// ── THE STAND-IN MODEL: runs one command when offered command.run ──
const MODEL_COMMAND = 'node -e "require(\'fs\').writeFileSync(\'' + MARKER.replace(/\\/g, '/') + '\', \'ran\'); console.log(\'MODEL-RAN\')"';
const chats = [];
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      chats.push(b);
      const offered = Array.isArray(b.tools) && b.tools.some(function (t) { return t.function && t.function.name === 'deskUnsloth_command_run'; });
      const toolDone = (b.messages || []).some(function (m) { return m.role === 'tool'; });
      const message = offered && !toolDone
        ? { role: 'assistant', content: '', tool_calls: [{ id: 'run-1', type: 'function', function: { name: 'deskUnsloth_command_run', arguments: JSON.stringify({ command: MODEL_COMMAND, timeoutMs: 0 }) } }] }
        : { role: 'assistant', content: 'done' };
      return res.end(JSON.stringify({ choices: [{ index: 0, message: message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [] }));
  });
});

// ── THE FAKE NODE: an empty desk; deskUnsloth's own verbs handed to its pipe ──
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient && ask.deskClient.desk) {
      const v = String(ask.deskClient.desk.verb);
      if (v === 'AGENTS') return answer(200, { text: 'Rules for agents.' });
      if (v === 'AGENTS.introspect') return answer(200, { items: [], more: false });
      return answer(200, { change: 1 });
    }
    if (ask && ask.deskUnsloth && client) return client.ask({ deskUnsloth: ask.deskUnsloth }).then(function (r) { answer(r.status || 200, r.body || {}); }, function (e) { answer(500, { ok: false, error: String(e) }); });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskUnsloth', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskUnsloth: q }).then(function (r) { return { status: r.status, body: r.body || {} }; }, function (e) { return { status: 0, body: { ok: false, error: String(e) } }; }); };
const run = function (command, timeoutMs) { return ask('command.run', { command: command, timeoutMs: timeoutMs || 0 }); };

async function chatOnce(text) {
  const before = chats.length;
  const sent = (await ask('chat.send', { lines: [{ role: 'user', text: text }] })).body;
  await until(async function () { const a = sent.id ? (await ask('chat.answer', { id: sent.id })).body : {}; return a.done === true; }, 15000);
  const mine = chats.slice(before);
  const after = mine.filter(function (c) { return (c.messages || []).some(function (m) { return m.role === 'tool'; }); })[0];
  return { offered: mine.length && Array.isArray(mine[0].tools) ? mine[0].tools.map(function (t) { return t.function && t.function.name; }) : [], tool: after ? String(((after.messages || []).filter(function (m) { return m.role === 'tool'; })[0] || {}).content || '') : null };
}

async function suite() {
  test.subHeading('1. the verb file and introspection');
  let file = null;
  try { file = JSON.parse(fs.readFileSync(path.join(DIR, 'command.run.json'), 'utf8')); } catch (e) { file = null; }
  const req = (file && file.request) || {};
  if (JSON.stringify(Object.keys(req).sort()) === JSON.stringify(['command', 'timeoutMs']) && String(file.description || '').length) test.check('command.run.json: request command, timeoutMs, with a description');
  else test.fail(OWED + 'command.run.json reads ' + short(file));

  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  for (const s of [node, studio]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ url: 'http://127.0.0.1:' + studio.address().port + '/v1', key: 'k' }));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: repo }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskUnsloth did not start: ' + short(out.stderr)); return; }
  const listed = ((await ask('AGENTS.introspect', {})).body.items || []).map(function (i) { return i.key; });
  if (listed.indexOf('command.run') !== -1) test.check('AGENTS.introspect lists command.run');
  else test.fail(OWED + 'AGENTS.introspect lists ' + short(listed));

  test.subHeading('2. the exit code and the output, stderr included');
  const r1 = await run('node -e "console.log(\'HELLO-OUT\'); console.error(\'HELLO-ERR\'); process.exit(3)"');
  if (r1.body.exit === 3 && /HELLO-OUT/.test(String(r1.body.output)) && r1.body.cut === false && r1.body.timedOut === false) test.check('exit 3, the text in output, cut false, timedOut false');
  else test.fail(OWED + 'a command exiting 3 answered ' + r1.status + ' ' + short(r1.body));
  if (/HELLO-ERR/.test(String(r1.body.output))) test.check('stderr is in the output');
  else test.fail(OWED + 'stderr is not in the output: ' + short(r1.body.output));

  test.subHeading('3. it runs at the clone root');
  const r2 = await run('node -e "console.log(process.cwd())"');
  const cwd = String(r2.body.output || '').trim();
  const norm = function (p) { const r = path.resolve(p); return process.platform === 'win32' ? r.toLowerCase() : r; };
  let real = repo; try { real = fs.realpathSync(repo); } catch (e) { /* as is */ }
  if (r2.body.exit === 0 && (norm(cwd) === norm(repo) || norm(cwd) === norm(real))) test.check('process.cwd() is the clone root');
  else test.fail(OWED + 'process.cwd() answered ' + short(r2.body) + ' (the clone is ' + repo + ')');

  test.subHeading('4. a long output is cut to its last whole lines');
  const r3 = await run('node -e "for (let i = 1; i <= 3000; i++) console.log(\'long line \' + i + \' of the output, padded to some length\'); console.log(\'END-OF-OUTPUT\')"');
  const o3 = String(r3.body.output || '');
  const lines3 = o3.replace(/\r/g, '').split('\n').filter(Boolean);
  const wholeLines = lines3.length > 1 && lines3.slice(0, -1).every(function (l) { return /^long line \d+ of the output, padded to some length$/.test(l); }) && lines3[lines3.length - 1] === 'END-OF-OUTPUT';
  const size3 = bytes(JSON.stringify(r3.body));
  if (r3.body.cut === true && size3 <= ANSWER_MAX && wholeLines && r3.body.exit === 0) test.check('cut true, ' + size3 + ' bytes (under ' + ANSWER_MAX + '), the last ' + lines3.length + ' whole lines, END-OF-OUTPUT kept');
  else test.fail(OWED + 'the long output answered ' + r3.status + ', ' + size3 + ' bytes, cut ' + short(r3.body.cut) + ', ' + lines3.length + ' lines, the last ' + short(lines3[lines3.length - 1]) + ', the first ' + short(lines3[0]));

  test.subHeading('5. a command past its time is stopped');
  const t0 = Date.now();
  const r4 = await run('node -e "console.log(\'PID \' + process.pid); setTimeout(function () {}, 60000)"', 1500);
  const took = Date.now() - t0;
  const pid = Number((/PID (\d+)/.exec(String(r4.body.output || '')) || [])[1]);
  await sleep(500);
  if (r4.body.timedOut === true && took < 8000) test.check('timedOut true after ' + took + ' ms');
  else test.fail(OWED + 'a command past 1500 ms answered after ' + took + ' ms: ' + r4.status + ' ' + short(r4.body));
  if (pid > 0 && !alive(pid)) test.check('its process (' + pid + ') is gone');
  else test.fail(OWED + 'the timed-out command\'s process: ' + (pid > 0 ? pid + ' is still alive' : 'no PID in the output ' + short(r4.body.output)));
  if (pid > 0 && alive(pid)) { try { process.kill(pid); } catch (e) { /* the one this suite started */ } }

  test.subHeading('6. the model\'s tool: refused while disconnected, run when connected');
  const off = (await ask('connect', { on: false })).body;
  const d = await chatOnce('run it');
  if (off.connected === false && d.offered.indexOf('deskUnsloth_command_run') !== -1) test.check('disconnected, the model is still offered deskUnsloth_command_run');
  else test.fail(OWED + 'disconnected (' + short(off) + '), the tools offered are ' + short(d.offered));
  if (d.tool !== null && /disconnected/.test(d.tool) && !fs.existsSync(MARKER)) test.check('its call is refused while disconnected, nothing ran');
  else test.fail(OWED + 'disconnected, the call came back as ' + short(d.tool) + '; ran ' + fs.existsSync(MARKER));
  const on = (await ask('connect', { on: true })).body;
  const c = await chatOnce('run it');
  if (on.connected === true && c.tool !== null && /MODEL-RAN/.test(c.tool) && fs.existsSync(MARKER)) test.check('connected, the same call runs and its output comes back');
  else test.fail(OWED + 'connected (' + short(on) + '), the call came back as ' + short(c.tool) + '; ran ' + fs.existsSync(MARKER));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
