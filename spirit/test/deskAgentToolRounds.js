'use strict';

// spirit/test/deskAgentToolRounds.js
// goal/G23.4. Red on today's code; claude-windows wrote it and builds it (one agent). The item's box is the record:
//   deskAgent capped every answer at 3 tool rounds (TOOL_ROUNDS), never ruled; it cut Levant short.
//   Tool rounds are bounded by the context, not a count: Levant calls tools as long as the prompt still has room in the
//   model's context; when it is full he is asked once more without tools and posts what he has, as now.
//   When the server gives no context for the model, there is no limit either: no round count and nothing cut for room;
//   the server's own answer decides.
//   TOOL_ROUNDS goes. Abort stays the brake.
//
// THE WORLD: one deskAgent, four plain OpenAI stand-ins (as deskAgentPlainContext.js), each with its own v1/models
// entry, used in turn through connection.set and model.load; the answer is driven through the test tab's chat.send,
// which runs the same tool loop as a desk answer. The tool is deskAgent_file_load (fs_load before goal/G23.5), served by the fake node: SMALL_RESULT bytes for
// any path, LONG (~40 KB) for shell/long.txt. A round is one tool call; the stand-ins count rounds by the tool
// messages in the request.
//
// WHAT IS ASSERTED
//   1. big-x (max_input_tokens 1000000), asking deskAgent_file_load for K = 12 rounds and then answering text: the model is asked
//      13 times, and the answer is its own text, never asked without tools.
//   2. small-x (max_input_tokens SMALL_CONTEXT, room for about 5 rounds of SMALL_RESULT): asking for a tool whenever it
//      is offered tools, answering text when it is not: more than 3 rounds happen, the last request has no tools, and
//      the answer is the stand-in's text.
//   3. none-x (no context on its entry), K = 12, its first call reading the ~40 KB file: all 12 rounds happen, the
//      answer is its own text, and the 40 KB result reaches the model whole (not cut, not dropped for room).
//   4. no TOOL_ROUNDS identifier remains in deskAgent.js.
//   5. endless-x (no context), asking for a tool on every request: more than 3 rounds happen with the answer still in
//      flight; Abort ends it, the answer done and saying it was aborted, the state no longer working.
// NOT ASSERTED: the exact point where the room counts as spent; the wording of the without-tools note.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G23.4: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const NODE_NAME = 'ollama agent node';
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant', model: 'none-x', answerTokens: 100, bytesPerToken: 4 };
const K = 12;
const SMALL_RESULT = 'r'.repeat(1000);
// About five rounds: each round costs SMALL_RESULT plus its tool call (~120 bytes); the system text, the note and the
// line about 900. So the room is ~900 + 5.5 * 1120 bytes, at 4 bytes per token, plus the 100 answer tokens.
const SMALL_CONTEXT = Math.round((900 + 5.5 * 1120) / CONFIGURATION.bytesPerToken + CONFIGURATION.answerTokens);
const LONG = (function () { let s = ''; for (let i = 0; s.length < 40000; i++) s += 'line ' + i + ' of the long file, plain words. '; return s + 'THE-END-OF-THE-LONG-FILE'; })();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await fn()) return true; await sleep(50); } return fn(); }

test.startTest('goal/G23.4: tool rounds bounded by the context, not a count');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunslothtoolrounds-'));

function answerer(res) { return function (status, obj) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }; }
function toolMessages(body) { return ((body && body.messages) || []).filter(function (m) { return m.role === 'tool'; }); }
function hasTools(body) { return !!(body && Array.isArray(body.tools) && body.tools.length); }

// A STAND-IN: `decide(body, round)` answers {tool: path} or {text}; round is the tool messages so far.
function plainServer(entry, seen, decide, delayMs) {
  return http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
      const answer = answerer(res);
      const p = new URL(req.url, 'http://x').pathname;
      if (p.indexOf('/api/') === 0) return answer(404, { error: { message: 'Invalid URL (GET ' + p + ')' } });
      if (p === '/v1/models') return answer(200, { object: 'list', data: [Object.assign({ object: 'model' }, entry)] });
      if (p === '/v1/chat/completions' && req.method === 'POST') {
        seen.push(body);
        const round = toolMessages(body).length;
        const d = decide(body, round);
        const message = d.tool
          ? { role: 'assistant', content: '', tool_calls: [{ id: 'call-' + round, type: 'function', function: { name: 'deskAgent_file_load', arguments: JSON.stringify({ path: d.tool }) } }] }
          : { role: 'assistant', content: d.text };
        const send = function () { answer(200, { choices: [{ index: 0, finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message: message }] }); };
        return delayMs ? setTimeout(send, delayMs) : send();
      }
      answer(200, { ok: true });
    });
  });
}
const kRounds = function (firstPath) { return function (body, round) { return round < K ? { tool: round === 0 && firstPath ? firstPath : 'shell/small' + round + '.txt' } : { text: 'my own answer after ' + round + ' rounds' }; }; };
const bigSeen = [], smallSeen = [], noneSeen = [], endlessSeen = [];
const big = plainServer({ id: 'big-x', max_input_tokens: 1000000 }, bigSeen, kRounds(''));
const small = plainServer({ id: 'small-x', max_input_tokens: SMALL_CONTEXT }, smallSeen, function (body, round) { return hasTools(body) ? { tool: 'shell/small' + round + '.txt' } : { text: 'what I have after ' + round + ' rounds' }; });
const none = plainServer({ id: 'none-x' }, noneSeen, kRounds('shell/long.txt'));
const endless = plainServer({ id: 'endless-x' }, endlessSeen, function (body, round) { return { tool: 'shell/small' + round + '.txt' }; }, 60);

// ── THE FAKE NODE: file.load for the tool; the desk holds nothing ──
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    const answer = answerer(res);
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') return answer(200, { ok: true });
    // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}.
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    const ask = test.foldAsk(b);
    // THE FILE TOOL IS deskAgent's OWN SINCE goal/G23.5: its asks reach this node as deskAgent.<verb>, and the
    // node answers them as it answered fs.load before.
    const du = ask && ask.deskAgent;
    // Described from the family folder since goal/G30.4: FS.search lists file.load.json, FS.loadJsonValue reads it.
    if (du && du['FS.search']) return answer(200, { items: [{ key: 'file.load.json', label: 'file.load.json' }], more: false });
    if (du && du['FS.loadJsonValue'] && du['FS.loadJsonValue'].path === 'file.load.json') return answer(200, { value: { description: 'load a file', request: { path: '' }, reply: { path: '', text: '' } } });
    if (du && du['file.load']) { const p = String(du['file.load'].path || ''); return answer(200, { path: p, text: p === 'shell/long.txt' ? LONG : SMALL_RESULT }); }
    if (du) return answer(404, { ok: false, code: 'no-such-verb' });
    if (ask && ask.deskClient && ask.deskClient.next) return setTimeout(function () { answer(200, { lines: [] }); }, 100);
    if (ask && ask.deskClient) return answer(200, { change: 1 });
    answer(404, { ok: false, code: 'no-such-verb' });
  });
});

const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(scratch, 'door.sock');
let kid = null;
let client = null;
const out = { stderr: '', code: null };
const ask = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ deskAgent: q }).then(function (r) { return r.body || {}; }, function () { return {}; }); };
function ids(m) { return ((m && m.models) || []).map(function (x) { return x.id; }).sort().join(','); }

async function usePair(name, url, model) {
  await ask('connection.set', { name: name, url: url, key: 'k-' + name });
  await until(async function () { return ids(await ask('models.search', { text: '', marks: [] })) === model; }, 6000);
  await ask('model.load', { id: model, quant: '' });
  await sleep(200);
}
async function chat(text, ms) {
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: text }] });
  let answered = {};
  await until(async function () { answered = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return answered.done === true; }, ms || 15000);
  return answered;
}
const budgetSaid = function (seen) { return seen.some(function (b) { return /tool budget of this answer is spent/.test(JSON.stringify((b && b.messages) || [])); }); };

async function suite() {
  for (const s of [node, big, small, none, endless]) await new Promise(function (r) { s.listen(0, '127.0.0.1', r); });
  const urlOf = function (s) { return 'http://127.0.0.1:' + s.address().port + '/v1'; };
  fs.mkdirSync(state, { recursive: true });
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

  test.subHeading('1. a big context: ' + K + ' tool rounds, then the model\'s own answer');
  await usePair('big', urlOf(big), 'big-x');
  const a1 = await chat('use your tools');
  if (bigSeen.length >= 1 && hasTools(bigSeen[0])) test.check('the world: the first request offers the tools (deskAgent_file_load among them)');
  else test.fail('the world: big-x was asked ' + bigSeen.length + ' time(s), the first ' + short(bigSeen[0] && bigSeen[0].tools));
  if (bigSeen.length === K + 1 && a1.text === 'my own answer after ' + K + ' rounds' && !budgetSaid(bigSeen)) test.check('asked ' + (K + 1) + ' times; the answer is the model\'s own: ' + short(a1.text));
  else test.fail(OWED + 'big-x was asked ' + bigSeen.length + ' times (want ' + (K + 1) + '), tool messages in the last ' + toolMessages(bigSeen[bigSeen.length - 1]).length + ', budget said ' + budgetSaid(bigSeen) + '; the answer ' + short(a1.text));

  test.subHeading('2. a small context (' + SMALL_CONTEXT + ' tokens): the rounds end when the room is spent');
  await usePair('small', urlOf(small), 'small-x');
  const a2 = await chat('use your tools');
  const last2 = smallSeen[smallSeen.length - 1];
  const rounds2 = last2 ? toolMessages(last2).length : 0;
  if (rounds2 > 3 && last2 && !hasTools(last2) && /^what I have after/.test(String(a2.text))) test.check(rounds2 + ' rounds, then asked without tools; the answer is what he has: ' + short(a2.text));
  else test.fail(OWED + 'small-x: ' + rounds2 + ' rounds in the last of ' + smallSeen.length + ' requests (want more than 3), the last ' + (last2 && hasTools(last2) ? 'with' : 'without') + ' tools; the answer ' + short(a2.text));
  if (smallSeen.length && smallSeen.length < 40) test.check('and it did end: ' + smallSeen.length + ' requests');
  else test.fail('small-x: ' + smallSeen.length + ' requests');

  test.subHeading('3. no context on the entry: no round count, nothing cut for room');
  await usePair('none', urlOf(none), 'none-x');
  const a3 = await chat('use your tools', 20000);
  if (noneSeen.length === K + 1 && a3.text === 'my own answer after ' + K + ' rounds') test.check('all ' + K + ' rounds happen and the answer is the model\'s own');
  else test.fail(OWED + 'none-x was asked ' + noneSeen.length + ' times (want ' + (K + 1) + '); the answer ' + short(a3.text));
  const afterLong = noneSeen.filter(function (b) { return toolMessages(b).length >= 1; })[0];
  const longMsg = afterLong ? String(toolMessages(afterLong)[0].content || '') : null;
  if (longMsg !== null && longMsg.indexOf(LONG) !== -1) test.check('the ~40 KB result reaches the model whole');
  else test.fail(OWED + 'none-x: the 40 KB result reached the model as ' + (longMsg === null ? 'nothing' : Buffer.byteLength(longMsg, 'utf8') + ' bytes ending ' + short(longMsg.slice(-100))));

  test.subHeading('4. TOOL_ROUNDS goes');
  const code = fs.readFileSync(AGENT, 'utf8');
  if (code.indexOf('TOOL_ROUNDS') === -1) test.check('deskAgent.js names no TOOL_ROUNDS');
  else test.fail(OWED + 'deskAgent.js still names TOOL_ROUNDS ' + (code.split('TOOL_ROUNDS').length - 1) + ' time(s)');

  test.subHeading('5. Abort stays the brake');
  await usePair('endless', urlOf(endless), 'endless-x');
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'use your tools forever' }] });
  await until(function () { return endlessSeen.length >= 6; }, 8000);
  const before = sent.id ? await ask('chat.answer', { id: sent.id }) : {};
  const roundsBefore = endlessSeen.length ? toolMessages(endlessSeen[endlessSeen.length - 1]).length : 0;
  if (roundsBefore > 3 && before.done === false) test.check('more than 3 rounds (' + roundsBefore + ') with the answer still in flight');
  else test.fail(OWED + 'endless-x: ' + roundsBefore + ' rounds, ' + endlessSeen.length + ' requests, the answer done ' + short(before.done) + ' (' + short(before.text) + ') before any abort');
  const ab = await ask('abort', {});
  let after = {};
  await until(async function () { after = sent.id ? await ask('chat.answer', { id: sent.id }) : {}; return after.done === true; }, 5000);
  const st = await ask('state', {});
  if (ab.ok !== false && after.done === true && /abort/i.test(String(after.text)) && st.working === false) test.check('Abort ends it: done, says aborted, not working');
  else test.fail(OWED + 'abort answered ' + short(ab) + '; the chat ' + short(after) + '; working ' + short(st.working));
  const n = endlessSeen.length;
  await sleep(500);
  if (endlessSeen.length === n) test.check('and no request follows the abort');
  else test.fail('after the abort the stand-in was asked ' + (endlessSeen.length - n) + ' more time(s)');
}

suite().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  if (kid && out.code === null) await new Promise(function (r) { kid.once('exit', r); try { kid.kill(); } catch (e) { r(); } setTimeout(r, 3000); });
  try { node.close(); big.close(); small.close(); none.close(); endless.close(); } catch (e) { /* closed */ }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
