'use strict';

// spirit/test/deskUnslothPlainContext.js
// goal/G14.11. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   on a plain OpenAI server deskUnsloth sized every call for 8192 tokens (CONTEXT_FALLBACK), because only the studio
//   reports a model's context (inference/status context_length -> studioContext);
//   on a plain server the known list keeps each model's context from the server's own entry in v1/models:
//   max_input_tokens, or context_length where a server uses that word;
//   every call is sized to the chosen model's context when its entry gave one, and to the 8192 fallback when it did
//   not; the studio's context is read as before;
//   the context is never configured and never sent to any server.
//
// HOW THE SIZE IS SEEN: a tool result. The fake node serves file.load (deskUnsloth's own since goal/G23.5) with a file of LONG_BYTES (~40 KB). At 8192 tokens
// (answerTokens 100, bytesPerToken 4) a tool result gets a quarter of (8192 - 100) * 4, about 8 KB, so the file is cut
// or dropped; at 1,000,000 tokens it fits many times over and reaches the model whole in the next chat request.
//
// WHAT IS ASSERTED
//   1. a plain server whose v1/models gives {id: big-x, max_input_tokens: 1000000}: after model.load big-x and a chat
//      that asks the file tool, the next chat request carries the tool message with the whole file.
//   2. the known list (models.json, that pair's) keeps the context on big-x's entry: context 1000000.
//   3. a plain server whose list gives context_length: 1000000 on len-x: honoured the same way, kept the same way.
//   4. a plain server whose list gives no context (none-x): since goal/G23.4 the result reaches the model whole, no
//      room known, nothing cut (it was cut to 8192 until then). Asked after the big ones.
//   5. no request to any stand-in carries the context: no body, url or header names max_input_tokens, context_length
//      or context, or carries 1000000.
// NOT ASSERTED: the wording of a cut; whether the published state or the Remote shows the context.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G14.11: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskUnsloth', 'deskUnsloth.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'none-x', answerTokens: 100, bytesPerToken: 4 };
const BIG_CONTEXT = 1000000;
const FALLBACK_TOOL_ROOM = Math.floor((8192 - CONFIGURATION.answerTokens) * CONFIGURATION.bytesPerToken / 4);
// ASCII only, no newline, nothing JSON escapes: the file's text appears verbatim inside the tool message.
const LONG = (function () { let s = ''; for (let i = 0; s.length < 40000; i++) s += 'line ' + i + ' of the long file, plain words. '; return s + 'THE-END-OF-THE-LONG-FILE'; })();
const LONG_BYTES = Buffer.byteLength(LONG, 'utf8');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G14.11: a plain server\'s model context, read from its v1/models, sizes every call');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothplaincontext-'));

function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function rawOf(req, fn) { let raw = ''; req.on('data', function (c) { raw += c; }); req.on('end', function () { let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) { b = null; } fn(raw, b); }); }
function toolMessages(body) { return ((body && body.messages) || []).filter(function (m) { return m.role === 'tool'; }); }
function toolCall(id, name, args) { return { id: id, type: 'function', function: { name: name, arguments: JSON.stringify(args) } }; }

// ── THE STAND-INS: plain OpenAI servers that record every request, each with its own v1/models entry ──
function plainServer(entry, seen) {
  return http.createServer(function (req, res) {
    rawOf(req, function (raw, body) {
      const answer = answerer(res);
      const p = new URL(req.url, 'http://x').pathname;
      seen.push({ method: req.method, url: req.url, path: p, headers: req.headers, raw: raw, body: body });
      if (p.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + p + ')' } });
      if (p === '/v1/models') return answer(200, { object: 'list', data: [Object.assign({ object: 'model' }, entry)] });
      if (p === '/v1/chat/completions' && req.method === 'POST') {
        const asked = JSON.stringify((body && body.messages) || []);
        const message = /read the long file/.test(asked) && !toolMessages(body).length
          ? { role: 'assistant', content: '', tool_calls: [toolCall('long-1', 'deskUnsloth_file_load', { path: 'shell/long.txt' })] }
          : { role: 'assistant', content: 'read it' };
        return answer(200, { choices: [{ index: 0, finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message: message }] });
      }
      answer(200, { ok: true });
    });
  });
}
const bigSeen = [];
const lenSeen = [];
const noneSeen = [];
const big = plainServer({ id: 'big-x', max_input_tokens: BIG_CONTEXT }, bigSeen);
const len = plainServer({ id: 'len-x', context_length: BIG_CONTEXT }, lenSeen);
const none = plainServer({ id: 'none-x' }, noneSeen);

// ── THE FAKE NODE: file.load for the tool, jobs.api asks of deskUnsloth (the desk holds nothing), jobs.update ──
let client = null;
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    const ask = b.verb === 'jobs.api' && b.ask;
    // THE FILE TOOL IS deskUnsloth's OWN SINCE goal/G23.5: its asks reach this node as jobs.api {deskUnsloth: ...}, and the
    // node answers them as it answered fs.load before.
    const du = ask && ask.deskUnsloth;
    if (du && du['AGENTS.introspect']) return answer(200, { items: [{ key: 'file.load', label: 'load a file' }], more: false });
    if (du && du['AGENTS.file.load']) return answer(200, { description: 'load a file', request: { path: '' }, reply: { path: '', text: '' } });
    if (du && du['file.load']) return answer(200, { path: String(du['file.load'].path || ''), text: LONG });
    if (du) return answer(404, { ok: false, code: 'no-such-verb' });
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskUnsloth');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskUnsloth', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
const out = { stderr: '', code: null };
function start() {
  kid = spawn(process.execPath, [AGENT, JSON.stringify({ root: scratch }), '--pipe', pipe, '--state', state, '--node', JSON.stringify({ name: NODE_NAME, publicKey: 'K' })],
    { cwd: scratch, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskUnsloth', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }) });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() { return new Promise(function (r) { if (!kid || out.code !== null) return r(); kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); }); }
async function up() {
  for (let i = 0; i < 60 && out.code === null; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.deskUnsloth && r.body.deskUnsloth.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskUnsloth: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };
function readJson(name) { try { return JSON.parse(fs.readFileSync(path.join(state, name), 'utf8')); } catch (e) { return null; } }
function ids(m) { return ((m && m.models) || []).map(function (x) { return x.id; }).sort().join(','); }

// One pair: saved and used, its list read, its model chosen, and one chat that asks the file tool. Returns what the
// stand-in was sent after the tool ran: the chat request carrying the tool message.
async function exercise(name, url, model, seen) {
  const set = await ask('connection.set', { name: name, url: url, key: 'k-' + name });
  let listed = {};
  await until(async function () { listed = await ask('models', {}); return ids(listed) === model; }, 6000);
  await ask('model.load', { id: model, quant: '' });
  await sleep(200);
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'please read the long file' }] });
  let answered = {};
  await until(async function () { answered = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return answered.done === true; }, 10000);
  const after = seen.filter(function (s) { return s.path === '/v1/chat/completions' && toolMessages(s.body).length; })[0];
  return { set: set, listed: listed, answered: answered, tool: after ? String(toolMessages(after.body)[0].content || '') : null, chats: seen.filter(function (s) { return s.path === '/v1/chat/completions'; }).length };
}
function whole(got) { return got.tool !== null && got.tool.indexOf(LONG) !== -1 && !/no room left|\[cut:|\[dropped\]/.test(got.tool); }
function said(got) { return got.tool === null ? 'no chat request carried a tool message (' + got.chats + ' chat calls; answer ' + short(got.answered) + ')' : 'the tool message is ' + Buffer.byteLength(got.tool, 'utf8') + ' bytes, ending ' + short(got.tool.slice(-120)); }
function entryOf(pairName, id) {
  const file = readJson('models.json');
  const pair = file && file.pairs && file.pairs[pairName];
  return { file: file, entry: pair && Array.isArray(pair.models) ? pair.models.filter(function (m) { return m && m.id === id; })[0] : null };
}

async function serverHalf() {
  for (const s of [node, big, len, none]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  const BIG_URL = 'http://127.0.0.1:' + big.address().port + '/v1';
  const LEN_URL = 'http://127.0.0.1:' + len.address().port + '/v1';
  const NONE_URL = 'http://127.0.0.1:' + none.address().port + '/v1';
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskUnsloth', pipe);
  start();
  if (!await up()) { test.fail('the world: deskUnsloth did not start: ' + short(out.stderr)); return; }
  test.check('the world: the file is ' + LONG_BYTES + ' bytes; a tool result gets about ' + FALLBACK_TOOL_ROOM + ' at 8192 tokens');

  test.subHeading('1. a plain server whose list gives max_input_tokens: ' + BIG_CONTEXT);
  const b = await exercise('big', BIG_URL, 'big-x', bigSeen);
  if (b.set.answers === true && b.answered.done === true && b.tool !== null) test.check('the world: the pair answers, the chat asked the file tool and was asked again with its result');
  else test.fail('the world: big pair set ' + short(b.set) + '; ' + said(b));
  if (whole(b)) test.check('the tool message carries the whole file (' + Buffer.byteLength(b.tool, 'utf8') + ' bytes): the call is sized to big-x\'s context');
  else test.fail(OWED + 'big-x (max_input_tokens ' + BIG_CONTEXT + '): ' + said(b));

  test.subHeading('2. the known list keeps big-x\'s context');
  const be = entryOf('big', 'big-x');
  if (be.entry && be.entry.context === BIG_CONTEXT) test.check('models.json keeps context ' + BIG_CONTEXT + ' on big-x\'s entry');
  else test.fail(OWED + 'big-x\'s entry in models.json reads ' + short(be.entry) + (be.entry ? '' : ' (models.json ' + short(be.file) + ')'));

  test.subHeading('3. context_length where a server uses that word');
  const l = await exercise('len', LEN_URL, 'len-x', lenSeen);
  if (whole(l)) test.check('len-x (context_length ' + BIG_CONTEXT + '): the tool message carries the whole file');
  else test.fail(OWED + 'len-x (context_length ' + BIG_CONTEXT + '): ' + said(l));
  const le = entryOf('len', 'len-x');
  if (le.entry && le.entry.context === BIG_CONTEXT) test.check('models.json keeps context ' + BIG_CONTEXT + ' on len-x\'s entry');
  else test.fail(OWED + 'len-x\'s entry in models.json reads ' + short(le.entry));

  // SINCE goal/G23.4 no context known means no limit: Andy, rounds "tied to the context, and if no context is
  // specified, no limit either". This check asserted the 8192 cut until then.
  test.subHeading('4. a plain server whose list gives no context: nothing cut for room (goal/G23.4)');
  const n = await exercise('none', NONE_URL, 'none-x', noneSeen);
  if (whole(n)) test.check('none-x: the tool message carries the whole file (' + Buffer.byteLength(n.tool, 'utf8') + ' bytes, more than the ' + FALLBACK_TOOL_ROOM + ' the 8192 fallback would give)');
  else test.fail('none-x: the result is cut for room with no context known: ' + said(n));
  const ne = entryOf('none', 'none-x');
  if (ne.entry && !(Number(ne.entry.context) > 0)) test.check('none-x\'s entry keeps no context');
  else test.fail('none-x\'s entry in models.json reads ' + short(ne.entry));

  test.subHeading('5. the context is never sent to any server');
  const all = bigSeen.concat(lenSeen, noneSeen);
  const NAMES = /max_input_tokens|context_length|"context"|1000000/;
  const leaks = all.filter(function (s) {
    if (NAMES.test(s.url) || NAMES.test(s.raw)) return true;
    return Object.keys(s.headers).some(function (h) { return /context|max_input/i.test(h) || /1000000/.test(String(s.headers[h])); });
  });
  if (all.length && leaks.length === 0) test.check('none of the ' + all.length + ' requests names or carries the context');
  else test.fail(OWED + 'requests carrying the context: ' + short(leaks.map(function (s) { return s.method + ' ' + s.url + ' ' + s.raw.slice(0, 120); })));
}

(async function () { await serverHalf(); })().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); big.close(); len.close(); none.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
