'use strict';

// spirit/test/deskUnslothFileEdit.js
// goal/G23.7. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   A whole-file save cannot carry a file bigger than one answer, so he could not change big files.
//   file.edit replaces one exact piece of text in a file with another (like cw's Edit); it is refused when the text is
//   not found, or found more than once unless all is asked for.
//   It keeps the same file fence as file.save: the file is on an item he has taken.
//
// THE SHAPE CHOSEN (this suite fixes it):
//   request {path, old, new, all}: path a repository path; old the exact text to find; new its replacement; all
//   true to replace every occurrence, false for exactly one (tools.js sends every key, so false is "once").
//   reply {path, replaced: n}. A refusal says why in extra.why. file.edit.json describes it, request {path, old, new,
//   all}. It writes, so like file.save it is refused to the model while Levant is disconnected (goal/G18.9).
//
// THE WORLD (deskUnslothAgent.js's fence): a stand-in desk whose items.search lists ag/G1.1, taken by this node with
// spirit/test/zzMine.js on its list, and ag/G1.2, another agent's with spirit/test/zzTheirs.js. zzMine.js is ~30 KB,
// several answers long. A stand-in model asks for deskUnsloth_file_edit when it is offered it.
//
// WHAT IS ASSERTED
//   1. file.edit.json: request path, old, new, all; deskUnsloth's AGENTS.introspect lists file.edit.
//   2. an edit in the ~30 KB file lands: replaced 1, the file byte-exact the original with that one piece replaced.
//   3. old not found: refused, the reason naming it; the file unchanged.
//   4. old found twice without all: refused, the reason saying it is found more than once; the file unchanged.
//   5. with all: both replaced, replaced 2.
//   6. the fence: a file on another agent's item and a path out of the clone are refused, nothing written.
//   7. the model is offered deskUnsloth_file_edit; while Levant is disconnected its call is refused and the file is
//      unchanged; connected, the same call lands.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.7: ';
const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth');
const AGENT = path.join(DIR, 'deskUnsloth.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'fake/Levant-GGUF', answerTokens: 100, bytesPerToken: 4 };
const MINE = 'spirit/test/zzMine.js';
const THEIRS = 'spirit/test/zzTheirs.js';

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G23.7: Levant edits a file of any size, one exact piece at a time, inside his fence');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothfileedit-'));
const repo = path.join(scratch, 'clone');

// THE BIG FILE: ~30 KB of lines, one MARK-A, two MARK-TWICE, one MARK-M for the model.
const BIG = (function () {
  const lines = [];
  for (let i = 1; Buffer.byteLength(lines.join('\n')) < 30000; i++) {
    let l = '// line ' + i + ' of the big file, with "quotes" and a backslash \\ in it';
    if (i === 100) l += ' MARK-A';
    if (i === 50 || i === 400) l += ' MARK-TWICE';
    if (i === 300) l += ' MARK-M';
    lines.push(l);
  }
  return lines.join('\n') + '\n';
})();

// ── THE STAND-IN MODEL ──
const chats = [];
const studio = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.method === 'POST' && /chat\/completions/.test(req.url)) {
      chats.push(b);
      const offered = Array.isArray(b.tools) && b.tools.some(function (t) { return t.function && t.function.name === 'deskUnsloth_file_edit'; });
      const toolDone = (b.messages || []).some(function (m) { return m.role === 'tool'; });
      const message = offered && !toolDone
        ? { role: 'assistant', content: '', tool_calls: [{ id: 'edit-1', type: 'function', function: { name: 'deskUnsloth_file_edit', arguments: JSON.stringify({ path: MINE, old: 'MARK-M', new: 'MARK-M-BY-MODEL', all: false }) } }] }
        : { role: 'assistant', content: 'done' };
      return res.end(JSON.stringify({ choices: [{ index: 0, message: message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }));
    }
    res.end(JSON.stringify({ object: 'list', data: [] }));
  });
});

// ── THE FAKE NODE: the desk's items for the fence; deskUnsloth's own verbs handed to its pipe ──
let client = null;
const ITEMS = [
  { id: 'ag/G1', title: 'Agent', goal: '', status: '', with: '', go: false, files: [] },
  { id: 'ag/G1.1', title: 'Mine', goal: 'ag/G1', status: 'building', with: NODE_NAME, go: true, files: [{ path: MINE, by: NODE_NAME, core: false }] },
  { id: 'ag/G1.2', title: 'Theirs', goal: 'ag/G1', status: 'building', with: 'claude-windows', go: true, files: [{ path: THEIRS, by: 'claude-windows', core: false }] },
];
function deskAnswer(verb, a) {
  if (verb === 'AGENTS') return { text: 'Rules for agents.' };
  if (verb === 'AGENTS.introspect') return { items: [], more: false };
  if (verb === 'items.search') return { items: ITEMS.map(function (i) { return { key: i.id, label: JSON.stringify(i) }; }), more: false };
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
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient && ask.deskClient.desk) {
      let a = {}; try { a = JSON.parse(ask.deskClient.desk.json || '{}'); } catch (e) { a = {}; }
      return answer(200, deskAnswer(String(ask.deskClient.desk.verb), a));
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
const edit = function (a) { return ask('file.edit', a); };
const onDisc = function (rel) { try { return fs.readFileSync(path.join(repo, rel), 'utf8'); } catch (e) { return null; } };
const why = function (r) { return String((r.body.extra && r.body.extra.why) || r.body.error || ''); };
const refusedReal = function (r) { return r.body.ok === false && r.body.code !== 'no-such-verb' && r.body.code !== 'no-such-argument'; };

async function chatOnce(text) {
  const before = chats.length;
  const sent = (await ask('chat.send', { lines: [{ role: 'user', text: text }] })).body;
  await until(async function () { const a = sent.id ? (await ask('chat.answer', { id: sent.id })).body : {}; return a.done === true; }, 10000);
  const mine = chats.slice(before);
  const after = mine.filter(function (c) { return (c.messages || []).some(function (m) { return m.role === 'tool'; }); })[0];
  return { offered: mine.length && Array.isArray(mine[0].tools) ? mine[0].tools.map(function (t) { return t.function && t.function.name; }) : [], tool: after ? String(((after.messages || []).filter(function (m) { return m.role === 'tool'; })[0] || {}).content || '') : null };
}

async function suite() {
  test.subHeading('1. the verb file and introspection');
  let file = null;
  try { file = JSON.parse(fs.readFileSync(path.join(DIR, 'file.edit.json'), 'utf8')); } catch (e) { file = null; }
  const req = (file && file.request) || {};
  if (JSON.stringify(Object.keys(req).sort()) === JSON.stringify(['all', 'new', 'old', 'path']) && typeof req.all === 'boolean' && String(file.description || '').length) test.check('file.edit.json: request path, old, new, all (a boolean), with a description');
  else test.fail(OWED + 'file.edit.json reads ' + short(file));

  fs.mkdirSync(path.join(repo, 'spirit', 'test'), { recursive: true });
  fs.writeFileSync(path.join(repo, MINE), BIG);
  fs.writeFileSync(path.join(repo, THEIRS), 'theirs MARK-A\n');
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
  test.check('the world: ' + MINE + ' is ' + Buffer.byteLength(BIG) + ' bytes; one answer is ' + appClient.ANSWER_MAX);
  const listed = ((await ask('AGENTS.introspect', {})).body.items || []).map(function (i) { return i.key; });
  if (listed.indexOf('file.edit') !== -1) test.check('AGENTS.introspect lists file.edit');
  else test.fail(OWED + 'AGENTS.introspect lists ' + short(listed));

  test.subHeading('2. an edit in a file several answers long lands');
  const e1 = await edit({ path: MINE, old: 'MARK-A', new: 'MARK-A-EDITED', all: false });
  const want1 = BIG.replace('MARK-A', 'MARK-A-EDITED');
  if (e1.body.replaced === 1 && e1.body.path === MINE && onDisc(MINE) === want1) test.check('replaced 1; the file is the original with that one piece replaced, byte for byte');
  else test.fail(OWED + 'the edit answered ' + e1.status + ' ' + short(e1.body) + '; the file ' + (onDisc(MINE) === BIG ? 'unchanged' : 'changed otherwise'));
  let now = onDisc(MINE);

  test.subHeading('3. text not found: refused, naming it');
  const e2 = await edit({ path: MINE, old: 'NOT-THERE-7', new: 'x', all: false });
  if (refusedReal(e2) && /NOT-THERE-7/.test(why(e2)) && onDisc(MINE) === now) test.check('refused: ' + why(e2));
  else test.fail(OWED + 'old not found answered ' + e2.status + ' ' + short(e2.body));

  test.subHeading('4. text found twice without all: refused, saying so');
  const e3 = await edit({ path: MINE, old: 'MARK-TWICE', new: 'MARK-ONCE', all: false });
  if (refusedReal(e3) && /twice|more than once|2 times|two/i.test(why(e3)) && onDisc(MINE) === now) test.check('refused: ' + why(e3));
  else test.fail(OWED + 'old found twice answered ' + e3.status + ' ' + short(e3.body));

  test.subHeading('5. with all: every one replaced');
  const e4 = await edit({ path: MINE, old: 'MARK-TWICE', new: 'MARK-BOTH', all: true });
  if (e4.body.replaced === 2 && onDisc(MINE) === now.split('MARK-TWICE').join('MARK-BOTH')) test.check('replaced 2, both in place');
  else test.fail(OWED + 'all answered ' + e4.status + ' ' + short(e4.body));
  now = onDisc(MINE);

  test.subHeading('6. the fence, as file.save\'s');
  const e5 = await edit({ path: THEIRS, old: 'MARK-A', new: 'x', all: false });
  if (refusedReal(e5) && onDisc(THEIRS) === 'theirs MARK-A\n') test.check('a file on another agent\'s item is refused: ' + why(e5));
  else test.fail(OWED + 'an edit of ' + THEIRS + ' answered ' + e5.status + ' ' + short(e5.body));
  const e6 = await edit({ path: '../escape.js', old: 'a', new: 'b', all: false });
  if (refusedReal(e6) && !fs.existsSync(path.join(scratch, 'escape.js'))) test.check('a path out of the clone is refused: ' + why(e6));
  else test.fail(OWED + 'an edit out of the clone answered ' + e6.status + ' ' + short(e6.body));

  test.subHeading('7. the model\'s tool: refused while disconnected, landing when connected');
  const off = (await ask('connect', { on: false })).body;
  const d = await chatOnce('edit MARK-M please');
  if (off.connected === false && d.offered.indexOf('deskUnsloth_file_edit') !== -1) test.check('disconnected, the model is still offered deskUnsloth_file_edit');
  else test.fail(OWED + 'disconnected (' + short(off) + '), the tools offered are ' + short(d.offered));
  if (d.tool !== null && /disconnected/.test(d.tool) && onDisc(MINE) === now) test.check('its call is refused while disconnected, the file unchanged');
  else test.fail(OWED + 'disconnected, the call came back as ' + short(d.tool) + '; the file ' + (onDisc(MINE) === now ? 'unchanged' : 'CHANGED'));
  const on = (await ask('connect', { on: true })).body;
  const c = await chatOnce('edit MARK-M please');
  if (on.connected === true && c.tool !== null && onDisc(MINE) === now.replace('MARK-M', 'MARK-M-BY-MODEL')) test.check('connected, the same call lands');
  else test.fail(OWED + 'connected (' + short(on) + '), the call came back as ' + short(c.tool) + '; MARK-M-BY-MODEL on disc ' + /MARK-M-BY-MODEL/.test(String(onDisc(MINE))));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); studio.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
