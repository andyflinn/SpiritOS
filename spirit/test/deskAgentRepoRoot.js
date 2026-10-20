'use strict';

// spirit/test/deskAgentRepoRoot.js
// goal/G23.5. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   Levant has the same rules and tools as cw (Andy: "give him everything.").
//   His file search ran from spirit/run (the node's fs tools, rooted at spirit/run) and his file read from the repo root
//   (deskAgent's own file.load/file.save, rooted at his clone), so a path his search gave him failed when he read it.
//   All his file tools are deskAgent's own and work at the repo root of his clone; the node's fs tools leave his
//   tool list.
//
// THE WORLD: one deskAgent on a plain stand-in model, driven through the test tab's chat.send, which offers the
// same tools as a desk answer. The fake node describes the fs family (fs.load, fs.search) as a real node does, and
// hands deskAgent's own verbs to its pipe, so the tool list is what describeAll really builds.
//
// WHAT IS ASSERTED, through the tools list in the chat request the stand-in receives:
//   1. no tool whose name starts with fs_.
//   2. deskAgent_file_load and deskAgent_file_save are offered, each description saying its paths are
//      repository paths (the word "repository" or "repo root").
//   3. a guard: deskAgent's file.load of spirit/run/x.txt, a file in the clone, answers path spirit/run/x.txt and its
//      text: the repo root, not spirit/run.
// NOT ASSERTED: a search tool of deskAgent's own (the box does not name its shape yet).
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G23.5: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'plain-x', answerTokens: 100, bytesPerToken: 4 };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G23.5: all of Levant\'s file tools are his own, at the repo root of his clone');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothreporoot-'));

function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }

// ── THE STAND-IN MODEL: answers text, keeps every chat request ──
const chats = [];
const model = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    const answer = answerer(res);
    const p = new URL(req.url, 'http://x').pathname;
    if (p.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + p + ')' } });
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: 'plain-x', object: 'model' }] });
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      chats.push(body);
      return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'seen' } }] });
    }
    answer(200, { ok: true });
  });
});

// ── THE FAKE NODE: the fs family described as a real node describes it; deskAgent's verbs handed to its pipe ──
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    if (b.verb === 'fs.AGENTS.introspect') return answer(200, { items: [{ key: 'fs.load', label: 'load a file' }, { key: 'fs.search', label: 'search files' }], more: false });
    if (b.verb === 'fs.AGENTS.load') return answer(200, { description: 'load a file under spirit/run', request: { path: '' }, reply: { path: '', text: '' } });
    if (b.verb === 'fs.AGENTS.search') return answer(200, { description: 'search files under spirit/run', request: { text: '' }, reply: {} });
    // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}.
    const ask = test.foldAsk(b);
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    if (ask && ask.deskAgent && client) {
      return client.ask({ deskAgent: ask.deskAgent }).then(function (r) { answer(r.status || 200, r.body || {}); }, function (e) { answer(500, { ok: false, error: String(e) }); });
    }
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };

async function suite() {
  for (const s of [node, model]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(state, { recursive: true });
  fs.mkdirSync(path.join(scratch, 'spirit', 'run'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'spirit', 'run', 'x.txt'), 'x at the repo root\n');
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
  let up = false;
  for (let i = 0; i < 60 && !up && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.deskAgent && r.body.deskAgent.ok !== false); } catch (e) { /* not yet */ } }
  if (!up) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  await ask('connection.set', { name: 'plain', url: 'http://127.0.0.1:' + model.address().port + '/v1', key: 'k' });
  await until(async function () { const m = await ask('models.search', { text: '', marks: [] }); return ((m && m.models) || []).some(function (x) { return x.id === 'plain-x'; }); }, 6000);
  await ask('model.load', { id: 'plain-x', quant: '' });
  await sleep(200);
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'which tools do you have?' }] });
  await until(async function () { const a = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return a.done === true; }, 10000);
  const offered = chats.length && Array.isArray(chats[0].tools) ? chats[0].tools : [];
  const names = offered.map(function (t) { return String((t.function && t.function.name) || ''); });
  const descOf = function (n) { const t = offered.filter(function (x) { return x.function && x.function.name === n; })[0]; return t ? String(t.function.description || '') : null; };
  if (names.length) test.check('the world: the model was offered ' + names.length + ' tools: ' + names.join(', '));
  else { test.fail('the world: no tools were offered (' + chats.length + ' chat requests)'); return; }

  test.subHeading('1. the node\'s fs tools leave his tool list');
  const fsTools = names.filter(function (n) { return n.indexOf('fs_') === 0; });
  if (!fsTools.length) test.check('no tool named fs_*');
  else test.fail(OWED + 'still offered: ' + fsTools.join(', '));

  test.subHeading('2. his file tools are deskAgent\'s own, in repository paths');
  ['deskAgent_file_load', 'deskAgent_file_save'].forEach(function (n) {
    const d = descOf(n);
    if (d !== null && /repository|repo root/i.test(d)) test.check(n + ' is offered, its description in repository paths');
    else test.fail(OWED + n + (d === null ? ' is not offered' : '\'s description says no repository path: ' + short(d)));
  });

  test.subHeading('3. a guard: file.load reads from the repo root of the clone');
  const got = await ask('file.load', { path: 'spirit/run/x.txt' });
  if (got.path === 'spirit/run/x.txt' && got.text === 'x at the repo root\n') test.check('file.load spirit/run/x.txt answers that path and its text');
  else test.fail('file.load spirit/run/x.txt answered ' + short(got));
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); model.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
