'use strict';

// spirit/test/deskAgentAbort.js
// goal/G19.7: deskAgent's timeouts, tool results in the room, working reset. Red on today's code (e32295a6);
// claude-windows wrote it and builds it. The shape is the item's box, Andy's of 2026-10-12:
//
//   "and the timeout, if Levant is in a huge cleanup-batch of something? ... i think the Remote should have an abort
//   button, that is armed and comes alive whenever the model is working. i much would prefer manual intervention to
//   automated aborting....."
//   "this situation has occurred multiple times with claude... The abort button sit's with the chat in the test tab,
//   where all requests, replies, and tool calls should be logged."
//
// WHAT IS ASSERTED (the box's SHAPE)
//   1. deskAgent answers an abort verb: refused with the reason when the model is not working; while it works it
//      cancels the call in flight (the studio sees its connection closed) and frees Levant. It is no tool of Levant's:
//      no verb file names it, so the family of its folder never describes it.
//   2. No automatic timeout on the model's answer: a call that hangs is still in flight seconds later, and the state
//      says the model is working (published `working`).
//   3. A failed or aborted answer frees Levant at once: the next desk line is answered; the aborted one is not posted.
//   4. Every request, reply and tool call Levant makes is in the published log, his desk work included, each entry
//      {seq, at, from, kind, text}; a tool result in short.
//   5. Tool results are counted against the prompt room: over three rounds no call carries more message bytes than
//      (context - answerTokens) * bytesPerToken.
//   6. Timeouts on the model-list reads: a cached-gguf or inference/status that never answers frees the refresh.
//   7. The LOW findings: a chat's published record is its own (one global no longer), model.load with no id is refused
//      with the reason, answerTokens never falls to 0, a tool declares its request's keys required, the tools are not
//      described again for every answer, a fetched JSON with an error field is no refusal.
//   8. The Remote: an Abort beside the test tab's chat, alive only while the model works, sending abort; the log drawn
//      in the chat and never sent to the model; a load refusal published before the answer leaves no hourglass; a
//      target switch clears the transcript and the busy flags; a published state does not re-enable the switch
//      mid-flip.
// NOT ASSERTED, the builder's: the log's wording, its length, the button's look.
//
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G19.7: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const CODE = path.join(RUN, 'process', 'js', 'deskAgent');
const AGENT = path.join(CODE, 'deskAgent.js');
const APP = path.join(RUN, 'shell', 'deskAgentRemote', 'deskAgentRemote.js');
const STUDIO_CONTEXT = 2000;
const CONFIGURATION = { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'fake/Levant-Test-GGUF', answerTokens: 100, bytesPerToken: 4 };
const PROMPT_ROOM = (STUDIO_CONTEXT - CONFIGURATION.answerTokens) * CONFIGURATION.bytesPerToken;
const RESULT_SHORT = 400;   // a tool result "in short" in the log: generous, the builder's exact cut is not asserted
const LIST_WAIT = 9000;     // the model-list reads time out well inside this

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }
function messageBytes(m) { return bytes(m.content || '') + (m.tool_calls ? bytes(JSON.stringify(m.tool_calls)) : 0); }
function callBytes(body) { return (body && Array.isArray(body.messages) ? body.messages : []).reduce(function (s, m) { return s + messageBytes(m); }, 0); }

test.startTest('goal/G19.7: deskAgent timeouts, tool results in the room, working reset, the Remote\'s abort');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-abort-'));

// ── THE FAKE NODE: file.load for the tools (deskAgent's own since goal/G23.5), deskClient's next and desk, jobs.update ──
const BIG = 'A long paragraph of a file, repeated so it overflows the tool room many times. '.repeat(300);
const nodeAsks = [];
const published = [];
const nextQueue = [];
const posts = [];
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    nodeAsks.push(b);
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    if (b.verb === 'jobs.update') { if (b.app && typeof b.app === 'object') published.push(b.app); return answer(200, { ok: true }); }
    // THE FILE TOOL IS deskAgent's OWN SINCE goal/G23.5: its asks reach this node as deskAgent.<verb> (by name on the flat apiDoor, goal/G30.6), and
    // the node answers them here as it answered fs.load before (recorded as verb file.load / FS.search). Since
    // goal/G30.4 the tools are described from the family folder: FS.search lists file.load.json, FS.loadJsonValue reads it.
    { const na = test.nodeApi(b); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } } // api {family} (goal/G32.3)
    const ask = test.foldAsk(b);
    const du = ask && ask.deskAgent;
    if (du && du['FS.search']) { nodeAsks.push({ verb: 'deskAgent.FS.search' }); return answer(200, { items: [{ key: 'file.load.json', label: 'file.load.json' }], more: false }); }
    if (du && du['FS.loadJsonValue'] && du['FS.loadJsonValue'].path === 'file.load.json') return answer(200, { value: { description: 'load a file', request: { path: '' }, reply: { path: '', text: '' } } });
    if (du && du['file.load']) {
      const p = String(du['file.load'].path || '');
      nodeAsks.push({ verb: 'file.load', path: p });
      if (/witherror/.test(p)) return answer(200, { path: p, text: 'hello from the file', error: 'a field of the data, not a refusal' });
      if (/slow/.test(p)) return setTimeout(function () { answer(200, { path: p, text: 'slow file' }); }, 900);
      return answer(200, { path: p, text: /big/.test(p) ? BIG : 'a small file' });
    }
    const dc = ask && ask.deskClient;
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node has no ' + b.verb });
    if (dc.next) { if (nextQueue.length) return answer(200, { lines: nextQueue.shift() }); return setTimeout(function () { answer(200, { lines: [] }); }, 100); }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      const v = String(dc.desk.name || '');
      if (v === 'FS.loadFile' && args.path === 'AGENTS.md') return answer(200, { text: 'the rules' });
      if (v === 'FS.search') return answer(200, { items: [], more: false });
      if (v === 'item.get') return answer(200, { item: JSON.stringify({ id: args.id, title: 't', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], go: true }), version: 1, change: 1 });
      if (v === 'item.box') return answer(200, { box: 'the box', version: 1 });
      if (v === 'item.chat') return answer(200, { chat: [], chatMore: false });
      if (v === 'chat.add') { posts.push({ id: args.id, text: String(args.text) }); return answer(200, { change: 2 }); }
      if (v === 'signoff') return answer(200, { change: 3 });
      return answer(404, { ok: false, code: 'no-such-item', error: 'the fake desk holds nothing' });
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});

// ── THE FAKE STUDIO: the model-list reads can hang; the chat answers by what it is asked ──
const studio = { chats: [], cancelled: 0, hangList: false, hangStatus: false, hits: {} };
// respond(body) -> { hang } | { status, text } | { toolCalls } | { text }
let respond = function () { return { text: 'nothing scripted' }; };
const studioServer = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
    function answer(status, obj) { if (res.writableEnded || res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }
    const p = req.url.split('?')[0];
    studio.hits[p] = (studio.hits[p] || 0) + 1;
    if (p === '/api/models/cached-gguf') { if (studio.hangList) return; return answer(200, { cached: [{ repo_id: CONFIGURATION.model, size_bytes: 1, has_vision: false, task: 'text-generation' }] }); }
    if (p === '/v1/models') return answer(200, { object: 'list', data: [{ id: CONFIGURATION.model, loaded: true }] });
    if (p === '/api/inference/status') { if (studio.hangStatus) return; return answer(200, { active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], context_length: STUDIO_CONTEXT }); }
    if (p === '/v1/chat/completions' && req.method === 'POST') {
      studio.chats.push(body);
      const step = respond(body) || { text: 'nothing' };
      if (step.hang) { res.on('close', function () { if (!res.writableEnded) studio.cancelled++; }); return; }
      if (step.status) return answer(step.status, { error: { message: step.text || 'the fake studio failed' } });
      const message = step.toolCalls ? { role: 'assistant', content: '', tool_calls: step.toolCalls } : { role: 'assistant', content: step.text };
      return setTimeout(function () { answer(200, { id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: message, finish_reason: step.toolCalls ? 'tool_calls' : 'stop' }] }); }, 60);
    }
    answer(404, { detail: 'API endpoint not found' });
  });
});
function toolCall(id, name, args) { return { id: id, type: 'function', function: { name: name, arguments: JSON.stringify(args) } }; }
function asked(body) { return JSON.stringify((body && body.messages) || []); }
function toolMessages(body) { return ((body && body.messages) || []).filter(function (m) { return m.role === 'tool'; }); }

// ── THE AGENT ────────────────────────────────────────────────────────────
const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
fs.mkdirSync(state, { recursive: true });
const pipe = appClient.pipePathFor(scratch, 'deskAgent', process.platform, 'process');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], {
    cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'test-deskAgent', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.address().port + '/api/spirit' }),
  });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
function stop() {
  return new Promise(function (r) {
    const k = kid;
    if (!k || out.code !== null) return r();
    k.once('exit', function () { r(); });
    try { k.disconnect(); } catch (e) { /* no channel */ }
    setTimeout(function () { try { k.kill(); } catch (e) { /* gone */ } }, 500);
    setTimeout(r, 3000);
  });
}
async function doorUp(client, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await client.ask('api'); if (r && r.body && r.body.deskAgent && r.body.deskAgent.ok !== false) return r.body.deskAgent; } catch (e) { /* not yet */ }
    await sleep(150);
  }
  return null;
}
function lastPub() { return published[published.length - 1] || {}; }
function logEntries() {
  const seen = Object.create(null);
  const all = [];
  published.forEach(function (o) { (Array.isArray(o.log) ? o.log : []).forEach(function (e) { if (e && e.seq !== undefined && !seen[e.seq]) { seen[e.seq] = true; all.push(e); } }); });
  return all.sort(function (a, b) { return a.seq - b.seq; });
}
function line(id, text) { return 'DESK andy chat.add ' + JSON.stringify({ id: id, text: text }); }

async function serverHalf() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { studioServer.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  // Connected at start: the loaded model carries the desk-recommended mark (goal/G10.9).
  fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'studio-key', url: 'http://127.0.0.1:' + studioServer.address().port + '/v1' }, null, 1));
  start();
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  const tree = await doorUp(client, 10000);
  if (!tree) { test.fail(OWED + 'deskAgent never answered api on its pipe (' + short((out.stderr + out.stdout).slice(0, 200)) + ')'); return; }
  function ask(verb, args) { const a = {}; a[verb] = args || {}; return client.ask({ deskAgent: a }).then(function (r) { return r.body || {}; }); }
  async function answerOf(id, ms) { let a = {}; const end = Date.now() + (ms || 10000); while (Date.now() < end) { a = await ask('chat.answer', { id: id }); if (a.done) return a; await sleep(100); } return a; }
  // The studio's context is read with the known list: the room below is (2000 - 100) * 4.
  await ask('models.search', { text: '', marks: [] });
  await sleep(800);

  // ── 1. THE ABORT VERB ─────────────────────────────────────────────────
  test.subHeading('1. the abort verb: refused with the reason when idle, cancels the call in flight');
  const idle = await ask('abort', {});
  const idleWhy = String((idle.extra && idle.extra.why) || '');
  if (idle.ok === false && idle.code !== 'no-such-verb' && /not working|nothing/i.test(idleWhy)) test.check('abort with the model idle is refused, saying why: ' + idleWhy);
  else test.fail(OWED + 'abort with the model idle answered ' + short(idle));
  // The family folder is deskAgent.family since goal/G30.4, read through FS: no abort.json there, no description.
  const FAMILY_DIR = path.join(CODE, 'deskAgent.family');
  let family = null;
  try { family = require('../run/js/introSpector.js').family(FAMILY_DIR, { declared: ['abort', 'file.load', 'file.save', 'commit', 'push'] }); } catch (e) { family = null; }
  const abortFile = family && family.verbs['FS.loadJsonValue'] ? family.verbs['FS.loadJsonValue'].handler({ path: 'abort.json' }).value : 'no FS';
  const loadFile = family && family.verbs['FS.loadJsonValue'] ? family.verbs['FS.loadJsonValue'].handler({ path: 'file.load.json' }).value : null;
  if (family && abortFile === null && loadFile && !fs.existsSync(path.join(FAMILY_DIR, 'abort.json'))) test.check('abort has no verb file: the family never describes it, so it is no tool of Levant\'s');
  else test.fail(OWED + 'abort is described to agents: ' + short(abortFile));

  respond = function (body) { return /hang the chat/.test(asked(body)) ? { hang: true } : { text: 'answered' }; };
  published.length = 0;
  const nChats = studio.chats.length;
  const sent = await ask('chat.send', { lines: [{ role: 'user', text: 'hang the chat' }] });
  await until(function () { return studio.chats.length > nChats; }, 8000);
  await until(function () { return lastPub().working === true; }, 3000);
  if (lastPub().working === true) test.check('the published state says the model is working while the call is in flight');
  else test.fail(OWED + 'while the model works the published state reads working ' + short(lastPub().working));

  // ── 2. NO AUTOMATIC TIMEOUT ON THE ANSWER ─────────────────────────────
  test.subHeading('2. no automatic timeout on the model\'s answer');
  await sleep(3000);
  const still = await ask('chat.answer', { id: sent.id });
  if (still.done === false && studio.cancelled === 0) test.check('three seconds on, the call is still in flight: nothing aborts it but Andy');
  else test.fail(OWED + 'the hanging call ended by itself: ' + short(still) + ', cancelled ' + studio.cancelled);
  const ab = await ask('abort', {});
  await until(function () { return studio.cancelled > 0; }, 3000);
  const after = await answerOf(sent.id, 3000);
  if (ab.ok !== false && studio.cancelled === 1) test.check('abort cancels the call in flight: the studio sees its connection closed');
  else test.fail(OWED + 'abort answered ' + short(ab) + '; the studio saw ' + studio.cancelled + ' cancelled');
  if (after.done === true && /abort/i.test(after.text)) test.check('the aborted chat is done, and says it was aborted: ' + short(after.text));
  else test.fail(OWED + 'after the abort chat.answer reads ' + short(after));
  await until(function () { return lastPub().working === false; }, 3000);
  if (lastPub().working === false) test.check('the model is free: the published state reads working false');
  else test.fail(OWED + 'after the abort the published state reads working ' + short(lastPub().working));

  // ── 3. A FAILED OR ABORTED ANSWER FREES LEVANT ────────────────────────
  test.subHeading('3. a failed or aborted desk answer frees Levant at once');
  respond = function (body) {
    const t = asked(body);
    if (/fail please/.test(t)) return { status: 500, text: 'the fake studio fell over' };
    if (/hang please/.test(t)) return { hang: true };
    return { text: 'Levant answers: ' + (/after the abort/.test(t) ? 'after the abort' : 'after the failure') };
  };
  posts.length = 0;
  const c0 = studio.chats.length;
  nextQueue.push([line('w/G1', 'levant: fail please')]);
  await until(function () { return studio.chats.length > c0; }, 8000);
  await sleep(400);
  nextQueue.push([line('w/G2', 'levant: answer please')]);
  await until(function () { return posts.some(function (p) { return p.id === 'w/G2'; }); }, 8000);
  if (posts.some(function (p) { return p.id === 'w/G2' && /after the failure/.test(p.text); }) && !posts.some(function (p) { return p.id === 'w/G1'; })) test.check('after a failed answer the next desk line is answered, and the failed one posts nothing');
  else test.fail(OWED + 'after a failure the desk got ' + short(posts));
  const c1 = studio.chats.length;
  const cancelled1 = studio.cancelled;
  nextQueue.push([line('w/G3', 'levant: hang please')]);
  await until(function () { return studio.chats.length > c1; }, 8000);
  await until(function () { return lastPub().working === true; }, 3000);
  const ab2 = await ask('abort', {});
  await until(function () { return studio.cancelled > cancelled1; }, 3000);
  nextQueue.push([line('w/G4', 'levant: after the abort')]);
  await until(function () { return posts.some(function (p) { return p.id === 'w/G4'; }); }, 8000);
  await sleep(300);
  if (ab2.ok !== false && studio.cancelled > cancelled1 && posts.some(function (p) { return p.id === 'w/G4'; }) && !posts.some(function (p) { return p.id === 'w/G3'; })) test.check('abort frees Levant from his desk work: the next line is answered, the aborted one posts nothing');
  else test.fail(OWED + 'abort of desk work answered ' + short(ab2) + '; cancelled ' + (studio.cancelled - cancelled1) + '; the desk got ' + short(posts));

  // ── 4. THE ROOM: TOOL RESULTS COUNTED ─────────────────────────────────
  test.subHeading('4. tool results are counted against the prompt room');
  let calls = 0;
  respond = function (body) {
    const t = asked(body);
    if (!/room please/.test(t)) return { text: 'other' };
    const n = toolMessages(body).length;
    calls++;
    if (n >= 6) return { text: 'read them all' };
    return { toolCalls: [toolCall('big-' + n, 'deskAgent_file_load', { path: 'shell/big/' + n }), toolCall('big-' + (n + 1), 'deskAgent_file_load', { path: 'shell/big/' + (n + 1) })] };
  };
  const r0 = studio.chats.length;
  const sRoom = await ask('chat.send', { lines: [{ role: 'user', text: 'room please' }] });
  const aRoom = await answerOf(sRoom.id, 15000);
  const roomCalls = studio.chats.slice(r0).filter(function (b) { return /room please/.test(asked(b)); });
  const sizes = roomCalls.map(callBytes);
  if (aRoom.done && roomCalls.length >= 3 && sizes.every(function (s) { return s <= PROMPT_ROOM; })) test.check('over ' + roomCalls.length + ' calls with two big results a round, no call carries more than the prompt room (' + sizes.join(', ') + ' of ' + PROMPT_ROOM + ' bytes)');
  else test.fail(OWED + 'calls carried ' + sizes.join(', ') + ' bytes against a prompt room of ' + PROMPT_ROOM + ' (' + roomCalls.length + ' calls, answer ' + short(aRoom) + ')');
  const lastRoom = roomCalls[roomCalls.length - 1];
  const dropped = toolMessages(lastRoom).filter(function (m) { return /room|cut|dropped/i.test(String(m.content)); });
  if (dropped.length >= 2) test.check('a result that does not fit says so to the model');
  else test.fail(OWED + 'no tool message says it was cut for room: ' + short(toolMessages(lastRoom).map(function (m) { return String(m.content).slice(-80); })));

  // ── 5. THE LOG ────────────────────────────────────────────────────────
  test.subHeading('5. every request, reply and tool call is in the published log');
  const log = logEntries();
  const shaped = log.length && log.every(function (e) { return typeof e.seq === 'number' && typeof e.at === 'string' && typeof e.from === 'string' && typeof e.kind === 'string' && typeof e.text === 'string'; });
  if (shaped) test.check('the published state carries log entries {seq, at, from, kind, text} (' + log.length + ' seen)');
  else test.fail(OWED + 'the published log reads ' + short(log.slice(0, 3)) + ' (last published keys ' + short(Object.keys(lastPub())) + ')');
  const kindsOf = function (pred) { return log.filter(pred).map(function (e) { return e.kind; }); };
  const roomKinds = kindsOf(function (e) { return e.from === 'chat'; });
  if (['request', 'reply', 'tool', 'result'].every(function (k) { return roomKinds.indexOf(k) !== -1; })) test.check('the chat\'s requests, replies, tool calls and tool results are logged');
  else test.fail(OWED + 'the chat logged kinds ' + short(roomKinds));
  const deskKinds = kindsOf(function (e) { return e.from === 'w/G2'; });
  if (deskKinds.indexOf('request') !== -1 && deskKinds.indexOf('reply') !== -1) test.check('his desk work is logged too, under the item it answers');
  else test.fail(OWED + 'the desk work on w/G2 logged ' + short(deskKinds));
  const failLog = log.filter(function (e) { return e.from === 'w/G1' && /fell over|500/.test(e.text); })[0];
  const abortLog = log.filter(function (e) { return (e.from === 'w/G3' || e.from === 'chat') && /abort/i.test(e.text); });
  if (failLog && abortLog.length >= 2) test.check('a failure is logged with the studio\'s words, and both aborts are logged');
  else test.fail(OWED + 'failure logged ' + short(failLog) + '; aborts logged ' + short(abortLog));
  const results = log.filter(function (e) { return e.kind === 'result'; });
  if (results.length && results.every(function (e) { return bytes(e.text) <= RESULT_SHORT; })) test.check('a tool result is logged in short (at most ' + Math.max.apply(null, results.map(function (e) { return bytes(e.text); })) + ' bytes, the result itself near 1900)');
  else test.fail(OWED + 'tool results logged at ' + short(results.map(function (e) { return bytes(e.text); })) + ' bytes');

  // ── 6. THE LOW FINDINGS ───────────────────────────────────────────────
  test.subHeading('6. the LOW findings with the code this item changes');
  // A fetched JSON with an error field is data, not a refusal.
  respond = function (body) {
    const t = asked(body);
    if (/witherror please/.test(t)) return toolMessages(body).length ? { text: 'read it' } : { toolCalls: [toolCall('we-1', 'deskAgent_file_load', { path: 'shell/witherror.json' })] };
    if (/second please/.test(t)) return { text: 'second' };
    return { text: 'other' };
  };
  const w0 = studio.chats.length;
  const sWe = await ask('chat.send', { lines: [{ role: 'user', text: 'witherror please' }] });
  await answerOf(sWe.id, 8000);
  const weCall = studio.chats.slice(w0).filter(function (b) { return toolMessages(b).length; })[0];
  const weTool = weCall ? String(toolMessages(weCall)[0].content) : '';
  if (/hello from the file/.test(weTool) && !/refused/.test(weTool)) test.check('a fetched JSON with an error field is handed back as data, not "the node refused"');
  else test.fail(OWED + 'the tool result reads ' + short(weTool));
  const tools0 = (weCall && Array.isArray(weCall.tools)) ? weCall.tools : [];
  const load = tools0.filter(function (t) { return t.function && t.function.name === 'deskAgent_file_load'; })[0];
  const req = load && load.function.parameters && load.function.parameters.required;
  if (Array.isArray(req) && req.join(',') === 'path') test.check('a tool declares its request\'s keys required: deskAgent_file_load requires path');
  else test.fail(OWED + 'deskAgent_file_load declares required ' + short(req));
  const introBefore = nodeAsks.filter(function (a) { return a.verb === 'deskAgent.FS.search'; }).length;
  const s2 = await ask('chat.send', { lines: [{ role: 'user', text: 'second please' }] });
  await answerOf(s2.id, 8000);
  const introAfter = nodeAsks.filter(function (a) { return a.verb === 'deskAgent.FS.search'; }).length;
  if (introAfter === introBefore) test.check('the tools are not described again for the next answer');
  else test.fail(OWED + 'the next answer described the tools again: deskAgent FS.search asked ' + (introAfter - introBefore) + ' more time(s)');

  // One chat's record is its own: a tool of chat A finishing after chat B is never published under B's id.
  respond = function (body) {
    const t = asked(body);
    if (/slow chat A/.test(t)) return toolMessages(body).length ? { text: 'A done' } : { toolCalls: [toolCall('slow-1', 'deskAgent_file_load', { path: 'shell/slow' })] };
    if (/quick chat B/.test(t)) return { text: 'B done' };
    return { text: 'other' };
  };
  published.length = 0;
  const sA = await ask('chat.send', { lines: [{ role: 'user', text: 'slow chat A' }] });
  await until(function () { return published.some(function (o) { return o.chat && o.chat.id === sA.id && o.chat.tool && o.chat.tool.name === 'deskAgent_file_load'; }); }, 5000);
  const sB = await ask('chat.send', { lines: [{ role: 'user', text: 'quick chat B' }] });
  await answerOf(sB.id, 5000);
  await answerOf(sA.id, 8000);
  await sleep(300);
  const wrong = published.filter(function (o) { return o.chat && o.chat.id === sB.id && o.chat.tool && o.chat.tool.name === 'deskAgent_file_load'; });
  const doneA = published.filter(function (o) { return o.chat && o.chat.id === sA.id && o.chat.done && /A done/.test(o.chat.text); });
  if (!wrong.length && doneA.length) test.check('a chat\'s published record is its own: chat A\'s tool is never published under chat B\'s id');
  else test.fail(OWED + 'chat A\'s tool was published under chat B\'s id ' + wrong.length + ' time(s); A done published ' + doneA.length);

  const confBefore = fs.readFileSync(path.join(state, 'configuration.json'), 'utf8');
  const noId = await ask('model.load', { id: '', quant: '' });
  const confAfter = fs.readFileSync(path.join(state, 'configuration.json'), 'utf8');
  if (noId.ok === false && /id/.test(String((noId.extra && noId.extra.why) || '')) && confAfter === confBefore) test.check('model.load with no id is refused, saying why, and the configuration is not touched');
  else test.fail(OWED + 'model.load with no id answered ' + short(noId) + '; the configuration ' + (confAfter === confBefore ? 'unchanged' : 'now reads ' + short(confAfter)));

  // ── 7. TIMEOUTS ON THE MODEL-LIST READS ───────────────────────────────
  test.subHeading('7. the model-list reads time out');
  await sleep(300);
  studio.hangList = true;
  const l0 = studio.hits['/api/models/cached-gguf'] || 0;
  await ask('models.search', { text: '', marks: [] });
  await until(function () { return (studio.hits['/api/models/cached-gguf'] || 0) > l0; }, 3000);
  const freed = await until(function () { ask('models.search', { text: '', marks: [] }).catch(function () {}); return (studio.hits['/api/models/cached-gguf'] || 0) > l0 + 1; }, LIST_WAIT);
  studio.hangList = false;
  if (freed) test.check('a cached-gguf that never answers frees the refresh: the next models ask reads the studio again');
  else test.fail(OWED + 'a hanging cached-gguf held the refresh for ' + LIST_WAIT + ' ms: no second read');
  await sleep(6000);
  studio.hangStatus = true;
  const s0 = studio.hits['/api/inference/status'] || 0;
  await ask('models.search', { text: '', marks: [] });
  await until(function () { return (studio.hits['/api/inference/status'] || 0) > s0; }, 3000);
  const freed2 = await until(function () { ask('models.search', { text: '', marks: [] }).catch(function () {}); return (studio.hits['/api/inference/status'] || 0) > s0 + 1; }, LIST_WAIT);
  studio.hangStatus = false;
  if (freed2) test.check('an inference/status that never answers frees the refresh too');
  else test.fail(OWED + 'a hanging inference/status held the refresh for ' + LIST_WAIT + ' ms: no second read');
  await stop();

  // ── 8. answerTokens NEVER 0 ───────────────────────────────────────────
  test.subHeading('8. without a configuration, the answer still has room');
  fs.unlinkSync(path.join(state, 'configuration.json'));
  respond = function () { return { text: 'on defaults' }; };
  start();
  const up = await doorUp(client, 10000);
  if (!up) { test.fail(OWED + 'deskAgent on defaults never answered: ' + short(out.stderr)); return; }
  const d0 = studio.chats.length;
  const sd = await ask('chat.send', { lines: [{ role: 'user', text: 'defaults please' }] });
  await answerOf(sd.id, 8000);
  const db = studio.chats[d0];
  const asks = db ? (db.max_tokens !== undefined ? db.max_tokens : db.max_completion_tokens) : undefined;
  if (Number(asks) > 0) test.check('on defaults the call asks for an answer of ' + asks + ' tokens, never 0');
  else test.fail(OWED + 'on defaults the call asks for ' + short(asks) + ' answer tokens');
  await stop();
}

// ── THE REMOTE ───────────────────────────────────────────────────────────
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
const READY = { connected: true, persona: 'Levant', model: 'fake/Levant-GGUF', server: { url: 'http://studio/v1', answers: true, error: '' }, connections: [] };
const MODEL_A = { id: 'fake/Levant-GGUF', loaded: true, quant: 'Q4', bytes: 1e9, task: 'text-generation', vision: false, reasoning: false, audio: false };
const MODEL_B = { id: 'fake/Other-GGUF', loaded: false, quant: 'Q8', bytes: 2e9, task: 'text-generation', vision: false, reasoning: false, audio: false };
const MODELS = { active: MODEL_A.id, activeQuant: 'Q4', cached: false, load: { model: '', state: '', error: '' }, test: {}, models: [MODEL_A, MODEL_B] };
function publishedObj(extra) { return Object.assign({}, READY, { active: MODELS.active, activeQuant: MODELS.activeQuant, cached: false, load: { model: '', state: '', error: '' }, test: {}, models: MODELS.models, chat: { id: '', done: false, text: '', tool: { name: '', url: '', done: true } }, working: false, log: [] }, extra || {}); }

// delays: {verb: ms}; every ask of deskAgent on this node answers from `answers` after its delay.
async function mount(delays) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let behavior = null;
  let onPub = null;
  const ctx = { spirit: { shell: { activateApp: function (a) { behavior = a; } }, core: kernel.core }, document: doc, window: {}, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(APP, 'utf8'), ctx, { filename: APP });
  const answers = { state: READY, models: MODELS, 'model.load': { model: MODEL_B.id, loaded: false }, connect: { connected: false }, abort: { aborted: 1 }, 'chat.send': { id: 'chat-1' } };
  const api = {
    escapeHtml: kernel.core.util.escapeHtml,
    fs: { loadFile: function (name) { return name === 'puppets.json' ? JSON.stringify({ puppets: [{ name: 'agent node', key: 'KEY-AGENT' }] }) : null; } },
    onPublished: function (fn) { onPub = fn; },
    armUntilElsewhere: function () {},
    verb: function (name, body) {
      calls.push({ name: name, body: body });
      if (name === 'api') return Promise.resolve({ status: 200, body: { deskAgent: {} } });
      // deskAgent's verbs by name (deskAgent.<verb>, goal/G30.6); a puppet's ride in owner.command as its command.
      let verb = null;
      if (String(name).indexOf('deskAgent.') === 0) verb = String(name).slice('deskAgent.'.length);
      if (name === 'owner.command' && body && String(body.command || '').indexOf('deskAgent.') === 0) verb = String(body.command).slice('deskAgent.'.length);
      const said = answers[verb] || { ok: true };
      const wrap = name === 'owner.command' ? { status: 200, body: { ok: true, status: 200, body: said } } : { status: 200, body: said };
      const ms = (delays || {})[verb] || 0;
      return new Promise(function (r) { setTimeout(function () { r(wrap); }, ms); });
    },
  };
  behavior.mount(doc.getElementById('container'), api);
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  return { doc: doc, calls: calls, ctx: ctx, publish: function (obj) { if (onPub) onPub(obj, { from: '' }); } };
}
function asksOf(m, verb) { return m.calls.filter(function (c) { return c.name === 'deskAgent.' + verb; }); }

async function faceHalf() {
  test.subHeading('9. the Remote: the Abort beside the chat, alive only while the model works');
  const m = await mount({});
  m.publish(publishedObj({ working: false }));
  await settled();
  const chat = m.doc.getElementById('dur-chat');
  const abortHtml = chat.innerHTML;
  const abort = m.doc.getElementById('dur-abort');
  if (/id="dur-abort"/.test(abortHtml) && abort.disabled === true) test.check('the test tab\'s chat holds an Abort, dead while the model is idle');
  else test.fail(OWED + 'the chat reads ' + short(abortHtml) + '; abort disabled ' + abort.disabled);
  m.publish(publishedObj({ working: true }));
  await settled();
  if (/id="dur-abort"/.test(m.doc.getElementById('dur-chat').innerHTML) && m.doc.getElementById('dur-abort').disabled === false) test.check('it comes alive while the model works');
  else test.fail(OWED + 'with the model working the Abort is still disabled');
  const n = asksOf(m, 'abort').length;
  m.doc.getElementById('dur-abort').fire('click', {});
  await settled();
  if (asksOf(m, 'abort').length === n + 1) test.check('a press sends abort to deskAgent on the chosen node');
  else test.fail(OWED + 'a press of Abort sent ' + short(m.calls.slice(-2)));

  test.subHeading('10. the Remote: the log in the chat, never sent to the model');
  m.publish(publishedObj({ working: true, log: [{ seq: 1, at: 't', from: 'w/G7', kind: 'request', text: 'asked the model about the cleanup batch' }, { seq: 2, at: 't', from: 'w/G7', kind: 'tool', text: 'desk_item_box {"id":"w/G7"}' }] }));
  m.publish(publishedObj({ working: false, log: [{ seq: 2, at: 't', from: 'w/G7', kind: 'tool', text: 'desk_item_box {"id":"w/G7"}' }, { seq: 3, at: 't', from: 'w/G7', kind: 'reply', text: 'the batch is clean' }] }));
  await settled();
  const display = m.doc.getElementById('dur-chat-display').innerHTML;
  const once = display.split('desk_item_box').length - 1;
  if (/cleanup batch/.test(display) && /the batch is clean/.test(display) && once === 1 && /w\/G7/.test(display)) test.check('the log\'s entries are drawn in the chat once each, with the item they answer');
  else test.fail(OWED + 'the chat display reads ' + short(display) + ' (the tool entry drawn ' + once + ' times)');
  m.doc.getElementById('dur-chat-input').value = 'hello Levant';
  m.doc.getElementById('dur-chat-send').fire('click', {});
  await settled();
  const sendAsk = asksOf(m, 'chat.send').pop();
  const lines = sendAsk && sendAsk.body ? sendAsk.body.lines : null;
  if (/the batch is clean/.test(display) && Array.isArray(lines) && lines.length === 1 && lines[0].role === 'user' && lines[0].text === 'hello Levant') test.check('chat.send carries the conversation alone, never the log');
  else test.fail(OWED + 'chat.send carried ' + short(lines));

  test.subHeading('11. the Remote\'s three faults');
  // A load refusal published before the answer: the failure arrives on the stream while model.load is still asked.
  const ld = await mount({ 'model.load': 300 });
  ld.publish(publishedObj({ working: false }));
  ld.ctx.deskAgentRemoteChosen = MODEL_B.id + '|' + MODEL_B.quant;
  ld.ctx.deskAgentRemoteDrawModels();
  const loadButton = ld.doc.getElementById('dur-load');
  loadButton.fire('click', {});
  await sleep(50);
  ld.publish(publishedObj({ load: { model: MODEL_B.id, state: 'failed', error: 'the studio refused the load' } }));
  await sleep(400);
  await settled();
  const modelsHtml = ld.doc.getElementById('dur-models').innerHTML;
  if (!ld.ctx.deskAgentRemoteLoadTimer && modelsHtml.indexOf(kernel.core.const.ICON.LOADING) === -1 && /id="dur-load"/.test(modelsHtml)) test.check('a load refusal published before the answer leaves no hourglass: Load is offered again');
  else test.fail(OWED + 'after a refusal published before the answer: load timer ' + short(ld.ctx.deskAgentRemoteLoadTimer) + '; the line reads ' + short(modelsHtml));

  // A target switch: the transcript and the busy flags belong to the old target.
  const sw = await mount({});
  sw.publish(publishedObj({}));
  sw.ctx.deskAgentRemoteTranscript.push({ role: 'user', text: 'said to the old target' });
  sw.ctx.deskAgentRemoteChatBusy = true;
  sw.ctx.deskAgentRemoteChatPending = 'old-chat';
  sw.ctx.deskAgentRemoteBusy = true;
  sw.doc.getElementById('dur-target').fire('change', { target: { value: '1' } });
  const cleared = sw.ctx.deskAgentRemoteTranscript.length === 0 && sw.ctx.deskAgentRemoteChatBusy === false && sw.ctx.deskAgentRemoteChatPending === '';
  if (cleared) test.check('a target switch clears the transcript and the chat\'s busy flags');
  else test.fail(OWED + 'after a target switch: transcript ' + short(sw.ctx.deskAgentRemoteTranscript) + ', chat busy ' + sw.ctx.deskAgentRemoteChatBusy + ', pending ' + short(sw.ctx.deskAgentRemoteChatPending));

  // A published state mid-flip: the switch stays disabled until the connect is answered.
  const fl = await mount({ connect: 400 });
  fl.publish(publishedObj({}));
  await settled();
  fl.doc.getElementById('dur-switch').fire('click', {});
  await settled();
  fl.publish(publishedObj({ connected: false }));
  await settled();
  const mid = fl.doc.getElementById('dur-switch').disabled;
  await sleep(600);
  await settled();
  if (mid === true) test.check('a published state mid-flip leaves the switch disabled until the connect is answered');
  else test.fail(OWED + 'a published state re-enabled the switch mid-flip');
}

(async function () {
  await serverHalf();
  await faceHalf();
})().catch(function (e) { test.fail(OWED + 'the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { if (studioServer.closeAllConnections) studioServer.closeAllConnections(); node.close(); studioServer.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
