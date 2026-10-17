'use strict';

// spirit/test/deskAgentLearnsContext.js
// goal/G27.15: deskAgent learns a model context from a refusal. Red on today's code; claude-windows wrote it and builds
// it (one agent). The item's box (v2):
//   R1. every call to the model is sized to 95% of its limit, always.
//   R2. a 400 whose text names two numbers (the limit, and the size supplied that exceeds it) teaches that model on that
//       pair its limit (the lower number) and its bytes per token (the bytes it sent over the higher number); both are
//       kept on the model entry in that pair list (models.json) and used for every later call.
//   R3. that same call is asked again once, cut to fit the learned size; a second refusal fails the turn as today.
//   R4. any other 400, or one naming fewer than two numbers, fails the turn as today: nothing learned, cut or retried.
//
// THE SHAPES THIS RED NAMES: the learned values are the entry's learnedContext and bytesPerToken; "the bytes it sent"
// are the prompt's bytes as deskAgent counts them (the messages' content).
// Driven through chat.send on a plain OpenAI-compatible pair whose /v1/models names context_length 3000, with
// answerTokens 1000 and bytesPerToken 4: today's room for the prompt is (3000 - 1000) * 4 bytes, with the margin
// (2850 - 1000) * 4.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G27.15: ';
const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'desk');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const CONTEXT = 3000;
const ANSWER = 1000;
const LEARNED = 2000;
const SUPPLIED = 2600;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }
function bytes(s) { return Buffer.byteLength(String(s || ''), 'utf8'); }
function promptBytes(body) { return ((body && body.messages) || []).reduce(function (s, m) { return s + bytes(m.content); }, 0); }
function windowBytes(body) { return ((body && body.messages) || []).filter(function (m) { return m.role !== 'system'; }).reduce(function (s, m) { return s + bytes(m.content); }, 0); }

test.startTest('goal/G27.15: deskAgent learns a model context from a refusal');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskagent-learns-'));

function deskVerbFiles() {
  const out = {};
  fs.readdirSync(DESK_DIR).filter(function (f) { return /\.json$/.test(f) && f !== 'desk.json' && f !== 'currentGoal.json'; }).forEach(function (f) {
    try { const j = JSON.parse(fs.readFileSync(path.join(DESK_DIR, f), 'utf8')); if (j && typeof j.description === 'string') out[f.replace(/\.json$/, '')] = j; } catch (e) { /* not a verb file */ }
  });
  return out;
}
function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function bodyOf(req, fn) { let raw = ''; req.on('data', function (c) { raw += c; }); req.on('end', function () { let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; } fn(b); }); }

// THE FAKE SERVER. mode: 'ok'; 'refuse-big' refuses, naming two numbers, any prompt over `over` bytes; 'refuse-all'
// refuses every chat naming two numbers; 'refuse-other' refuses with no numbers.
const server = { chats: [], mode: 'ok', over: 0 };
const fake = http.createServer(function (req, res) {
  bodyOf(req, function (body) {
    const answer = answerer(res);
    const at = new URL(req.url, 'http://x').pathname;
    if (at.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + at + ')' } });
    if (at === '/v1/models') return answer(200, { object: 'list', data: [{ id: 'm-1', object: 'model', context_length: CONTEXT }] });
    if (at === '/v1/chat/completions' && req.method === 'POST') {
      server.chats.push(body);
      const tooBig = { error: { message: 'This model\'s maximum context length is ' + LEARNED + ' tokens. However, you requested ' + SUPPLIED + ' tokens (' + SUPPLIED + ' in the messages). Please reduce the length of the messages.', type: 'invalid_request_error' } };
      if (server.mode === 'refuse-all' || (server.mode === 'refuse-big' && promptBytes(body) > server.over)) return answer(400, tooBig);
      if (server.mode === 'refuse-other') return answer(400, { error: { message: 'Unsupported parameter: something is not supported with this model.', type: 'invalid_request_error' } });
      return answer(200, { choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'answered' } }] });
    }
    answer(404, { error: { message: 'not found' } });
  });
});

// ── THE FAKE NODE ──────────────────────────────────────────────────────
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient && ask.deskClient.desk) {
      const verb = String(ask.deskClient.desk.verb);
      const verbs = deskVerbFiles();
      if (verb === 'AGENTS') return answer(200, { text: 'Rules.' });
      if (verb === 'AGENTS.introspect') return answer(200, { items: Object.keys(verbs).map(function (v) { return { key: v, label: verbs[v].description }; }), more: false });
      if (verb.indexOf('AGENTS.') === 0) return answer(200, verbs[verb.slice(7)] || {});
      return answer(200, { change: 1 });
    }
    if (ask && ask.deskAgent && client) return client.ask({ deskAgent: ask.deskAgent }).then(function (r) { answer(r.status || 200, r.body || {}); }, function () { answer(500, {}); });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: 'ollama agent node', publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent-learns', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskAgent && r.body.deskAgent.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };
function entry() { try { const all = JSON.parse(fs.readFileSync(path.join(state, 'models.json'), 'utf8')); return ((all.pairs.plain || {}).models || []).filter(function (m) { return m.id === 'm-1'; })[0] || null; } catch (e) { return null; } }
function longLines(n, size) { const out = []; for (let i = 0; i < n; i++) out.push({ role: i % 2 ? 'assistant' : 'user', text: ('line ' + i + ' ').padEnd(size, 'x') }); return out; }
// One chat round: the server's calls during it, and the answer.
async function chatOnce(lines) {
  const before = server.chats.length;
  const sent = await ask('chat.send', { lines: lines });
  let a = {};
  await until(async function () { a = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return a.done === true; }, 8000);
  await sleep(100);
  return { calls: server.chats.slice(before), text: String(a.text || '') };
}

async function main() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { fake.listen(0, '127.0.0.1', r); });
  const URL_ = 'http://127.0.0.1:' + fake.address().port + '/v1';
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify({ persona: 'Levant', preamble: 'you are Levant', model: 'm-1', answerTokens: ANSWER, bytesPerToken: 4, effort: [] }, null, 1));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify([{ name: 'plain', url: URL_, key: 'k', use: true, model: 'm-1', workspace: '' }]));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  start();
  if (!await up()) { test.fail('the world: deskAgent did not start: ' + short(out.stderr)); return; }
  await until(async function () { const m = await ask('models', {}); return (m.models || []).some(function (x) { return x.id === 'm-1' && x.context === CONTEXT; }); }, 6000);

  test.subHeading('R1. every call sized to 95% of the limit');
  const lines = longLines(120, 100);
  const c1 = await chatOnce(lines);
  const sent1 = windowBytes(c1.calls[0]);
  const withMargin = (Math.floor(CONTEXT * 0.95) - ANSWER) * 4;
  if (c1.calls.length === 1 && sent1 > 0 && sent1 <= withMargin) test.check('the chat window holds ' + sent1 + ' bytes, within 95% of the limit (' + withMargin + ')');
  else test.fail(OWED + 'the chat window held ' + sent1 + ' bytes against ' + withMargin + ' with the margin (' + c1.calls.length + ' calls)');

  test.subHeading('R2 and R3. a refusal naming two numbers: learned, and asked again once, cut');
  server.mode = 'refuse-big';
  server.over = 3000;
  const c2 = await chatOnce(lines);
  const first = c2.calls[0];
  const second = c2.calls[1];
  if (c2.calls.length === 2 && second && promptBytes(second) < promptBytes(first) && c2.text === 'answered') test.check('refused, then asked again once with less (' + promptBytes(first) + ' then ' + promptBytes(second) + ' bytes), and answered');
  else test.fail(OWED + 'after a two-number refusal: ' + c2.calls.length + ' calls, answer ' + short(c2.text));
  const e = entry();
  const ratio = first ? promptBytes(first) / SUPPLIED : 0;
  if (e && e.learnedContext === LEARNED && Number(e.bytesPerToken) > 0 && Math.abs(Number(e.bytesPerToken) - ratio) < 0.2) test.check('models.json keeps learnedContext ' + LEARNED + ' and bytesPerToken ' + e.bytesPerToken + ' on m-1');
  else test.fail(OWED + 'the entry for m-1 reads ' + short(e) + ' (bytes per token expected near ' + ratio.toFixed(2) + ')');
  if (second && e && Number(e.bytesPerToken) > 0 && windowBytes(second) <= (Math.floor(LEARNED * 0.95) - ANSWER) * Number(e.bytesPerToken)) test.check('the retry fits 95% of the learned limit at the learned bytes per token');
  else test.fail(OWED + 'the retry held ' + windowBytes(second) + ' bytes');

  test.subHeading('R2. the learned values hold for later calls, and through a refresh of the list');
  await ask('models', {});
  await sleep(300);
  await ask('models', {});
  server.mode = 'ok';
  const c3 = await chatOnce(lines);
  const e3 = entry();
  if (c3.calls.length === 1 && e3 && e3.learnedContext === LEARNED && Number(e3.bytesPerToken) > 0 && windowBytes(c3.calls[0]) <= (Math.floor(LEARNED * 0.95) - ANSWER) * Number(e3.bytesPerToken)) test.check('after a refresh the next chat is sized to what was learned, with no refusal');
  else test.fail(OWED + 'after a refresh: entry ' + short(e3) + ', next window ' + (c3.calls[0] ? windowBytes(c3.calls[0]) : 'none') + ' bytes');

  test.subHeading('R3. a second refusal fails the turn');
  server.mode = 'refuse-all';
  const c4 = await chatOnce(lines);
  if (c4.calls.length === 2 && /did not answer/.test(c4.text)) test.check('refused twice: one retry, then the turn fails');
  else test.fail(OWED + 'refused every time: ' + c4.calls.length + ' calls, answer ' + short(c4.text));

  test.subHeading('R4. any other 400 fails at once (guard)');
  server.mode = 'refuse-other';
  const c5 = await chatOnce(lines);
  if (c5.calls.length === 1 && /did not answer/.test(c5.text)) test.check('a 400 naming no numbers: one call, the turn fails, nothing retried');
  else test.fail(OWED + 'another 400: ' + c5.calls.length + ' calls, answer ' + short(c5.text));
}

main().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); fake.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
