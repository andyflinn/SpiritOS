'use strict';

// goal/G10.3: the context auto-built from the desk goal for the local agent. Red on today's tree; claude-windows wrote
// it from G10.3's box (version 29) and does not build it.
//   Andy, 2026-10-09: "tooling is deferred for this goal. deskAgent simply will route between agent and desk", and
//   the window in his words: MAX_CONTEXT_LENGTH minus the goal and item boxes, minus the system prompt and the answer
//   room, sizes in tokens by bytesPerToken from the configuration.
//
// WHAT IS TRUE TODAY (read at 74e1d37d): deskAgent.js reads process/js/deskAgent/loop.json under the cwd and
// exits 1 without it; every call carries "You are a helpful assistant" and the one line that woke it, to a model
// named in the code at 127.0.0.1:8888; it answered every chat.add of any party, the backlog included, prefixed
// "[loop.js] "; nothing of the desk's goal is in the call.
//
// THE SHAPE ASSERTED (G10.3's box, decided 1 to 8):
//   (Since goal/G10.7: connection.json may be absent and contextLimit is gone; the window is the studio's context.)
//   1. TWO FILES IN ITS STATE FOLDER (--state, the node's to name), read at start; without either it ends with a code
//      that is not 0 and the missing file's name on stderr, asking nobody: configuration.json {persona, preamble, model,
//      contextLimit, answerTokens, bytesPerToken} and connection.json {key, url} (loop.json's two values, flat). The
//      names and the flat shape are this red's; the box names only what each holds.
//   2. THE CALL, built fresh from the desk for each answer, through its node's deskClient.desk: the system message
//      holds the desk's AGENTS text and the persona's preamble; the goal's box and the item's box (item.box) are in
//      the messages; the item's chat (item.chat) is a rolling window of its newest lines, the oldest dropped; the
//      model is the configuration's and max_tokens is answerTokens; the bytes of every message together never exceed
//      (contextLimit - answerTokens) * bytesPerToken.
//   3. NOTHING KEPT BETWEEN CALLS: a box changed at the desk is in the next call as changed; a line gone from the
//      desk's chat is gone from the call.
//   4. A LONG ANSWER goes back as several chat.add lines under the room, each at most ANSWER_ROOM - 512 bytes of text
//      (so the desk's wrapping of it still fits one answer), split at paragraphs: every paragraph whole in one line,
//      in order. The lines carry no "[loop.js]".
//   5. (Since goal/G10.8 every change but its own reaches the model; section 5 asserts that.) ADDRESSED LINES ONLY: a DESK chat.add line whose text starts with the persona's name (any case, a colon or a
//      comma after it) is answered under its item, so is a JOB line under its item; a line of another agent's, a line
//      for another agent and a line with no address are not. Its answer begins with its own name.
//   6. THE PRESENT, NEVER THE BACKLOG: what deskClient.next hands over before it first answers with no lines is the
//      backlog, read and never answered; a line after that first empty answer is.
// Not asserted, the builder's: the wording and roles of the boxes and chat lines inside the messages; what a JOB
// line says to the model; the pause between two empty next answers; how the port of its node is found (today:
// relay-state/environment.json under the cwd, which this suite provides).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G10.3: ';
const ROOT = path.join(__dirname, '..', '..');
const AGENT = path.join(ROOT, 'spirit', 'run', 'process', 'js', 'deskAgent', 'deskAgent.js');
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;
const LINE_ROOM = ANSWER_ROOM - 512;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function bytes(s) { return Buffer.byteLength(String(s), 'utf8'); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
async function until(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (fn()) return true; await sleep(50); } return fn(); }

// ── THE WORLD THE AGENT SEES ─────────────────────────────────────────────
const AGENTS_TEXT = 'Rules for agents at this desk. 1. A post is 3 lines at most. 2. Every post goes under the id of the item it is about. 3. State facts read in code. 4. Never speak to another agent behind the owner\'s back. 5. Answer only what is addressed to you.';
const PREAMBLE = 'you are \'Levant\' (a genius i knew when i was a lead engineer at ATI technologies, later absorbed by AMD)';
const GOAL_BOX = 'GOAL BOX: upgrade the local agent so it works from the desk goal. Vision: a coder agent following the current goal as the claudes do. The retrofit first, then the context. Nothing kept between calls.';
const ITEM_BOX = 'ITEM BOX: the context auto-built from the desk goal. The call carries the rules, the persona, both boxes and the newest chat lines that fit; a long answer goes back in several lines.';
// SINCE goal/G10.7 THE CONTEXT IS THE STUDIO'S: no contextLimit in the configuration (Andy, 2026-10-12: "remove
// contextLimit from the configuration file. ... that's a decision."); the window is sized to the context_length the
// studio reports for the loaded model, which the fake studio below answers.
const CONFIGURATION = { persona: 'Levant', preamble: PREAMBLE, model: 'fake/Levant-Test-GGUF', answerTokens: 25, bytesPerToken: 4 };
// goal/G27.15: every call is sized to 95% of the context, so the studio reports 395 here, which leaves the window of
// 1400 bytes this suite was written for: (floor(395 * 0.95) - 25) * 4.
const STUDIO_CONTEXT = 395;
const PROMPT_ROOM = (Math.floor(STUDIO_CONTEXT * 0.95) - CONFIGURATION.answerTokens) * CONFIGURATION.bytesPerToken;
function filler(n) { let s = 'chat line ' + n + ' of the item, kept long enough that a few of them fill the window: '; while (s.length < 100) s += 'word '; return s.trim(); }

const desk = { items: {} };
function setUp() {
  desk.items = {
    'ctx/G1': { id: 'ctx/G1', title: 'The local agent', goal: '', box: GOAL_BOX, version: 3, chat: [] },
    'ctx/G1.2': { id: 'ctx/G1.2', title: 'Context', goal: 'ctx/G1', box: ITEM_BOX, version: 5, chat: [] },
  };
  for (let n = 1; n <= 8; n++) desk.items['ctx/G1.2'].chat.push({ by: 'andy', at: '2026-10-09T10:0' + (n - 1) + ':00.000Z', text: filler(n), taken: '' });
}
function said(id, text, by) { desk.items[id].chat.push({ by: by || 'andy', at: new Date().toISOString(), text: text, taken: '' }); return 'DESK ' + (by || 'andy') + ' chat.add ' + JSON.stringify({ id: id, text: text }); }
function facts(it) { return { id: it.id, title: it.title, goal: it.goal, status: 'open', with: '', buttons: [], blocking: [], blocked: [], go: true }; }

const nodeAsks = [];    // every body the agent sent its node (a server's verb by name, goal/G30.6)
const posted = [];      // every chat.add {id, text} the agent sent the desk
let nextQueue = [];     // answers to next, each a lines array; empty queue answers no lines
let nextCount = 0;
function deskAnswer(verb, args) {
  const it = desk.items[String(args.id || '')];
  // The desk's AGENTS.md through its family's FS (goal/G30.4: the AGENTS verb is gone).
  if (verb === 'FS.loadFile' && args.path === 'AGENTS.md') return { text: AGENTS_TEXT };
  if (verb === 'items.search') return { items: Object.keys(desk.items).map(function (k) { return { key: k, label: JSON.stringify(facts(desk.items[k])) }; }), more: false };
  if (!it) return { status: 404, body: { ok: false, code: 'no-such-item', error: 'no such item' } };
  if (verb === 'item.get') return { item: JSON.stringify(facts(it)), version: it.version, change: 9 };
  if (verb === 'item.box') return { box: it.box, version: it.version };
  if (verb === 'item.chat') return { chat: it.chat.slice(), chatMore: false };
  if (verb === 'item.checks') return { checks: [] };
  if (verb === 'chat.search') return { items: it.chat.map(function (l, i) { return { key: String(i), label: JSON.stringify({ by: l.by, at: l.at, text: l.text }) }; }), more: false };
  if (verb === 'chat.add') { posted.push({ id: it.id, text: String(args.text) }); it.chat.push({ by: 'levant', at: new Date().toISOString(), text: String(args.text), taken: '' }); return { change: 10 + posted.length }; }
  return { status: 400, body: { ok: false, code: 'no-such-verb', error: 'the fake desk has no ' + verb } };
}
const node = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    nodeAsks.push(b);
    const ask = test.foldAsk(b);
    const dc = ask && ask.deskClient;
    function answer(status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
    if (!dc) return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake node answers deskClient.<verb> alone' });
    if (dc.next) {
      nextCount++;
      if (nextQueue.length) return answer(200, { lines: nextQueue.shift() });
      return setTimeout(function () { answer(200, { lines: [] }); }, 150);
    }
    if (dc.desk) {
      let args = null; try { args = JSON.parse(dc.desk.json || '{}'); } catch (e) { args = null; }
      if (!dc.desk.name || !args) return answer(400, { ok: false, code: 'bad-request', error: 'name and json' });
      const a = deskAnswer(dc.desk.name, args);
      return a && a.status ? answer(a.status, a.body) : answer(200, a);
    }
    return answer(404, { ok: false, code: 'no-such-verb', error: 'the fake deskClient has next and desk alone' });
  });
});

// THE FAKE MODEL: an OpenAI chat completion, scripted; it keeps every request body.
const calls = [];
const studioReads = [];
let modelScript = ['The item is the context, built from the desk.'];
const model = http.createServer(function (req, res) {
  let raw = '';
  req.on('data', function (c) { raw += c; });
  req.on('end', function () {
    let b = {}; try { b = JSON.parse(raw); } catch (e) { b = {}; }
    // THE STUDIO'S OWN ROUTES (goal/G10.7): the loaded model's context_length, which sizes the window.
    const p = req.url.split('?')[0];
    if (req.method === 'GET') {
      studioReads.push(p);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (p === '/api/inference/status') return res.end(JSON.stringify({ active_model: CONFIGURATION.model, loaded: [CONFIGURATION.model], context_length: STUDIO_CONTEXT }));
      if (p === '/api/models/cached-gguf') return res.end(JSON.stringify({ cached: [] }));
      return res.end(JSON.stringify({ object: 'list', data: [] }));
    }
    calls.push({ url: req.url, auth: String(req.headers.authorization || ''), body: b });
    const content = modelScript.length > 1 ? modelScript.shift() : modelScript[0];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'fake', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: content }, finish_reason: 'stop' }] }));
  });
});

// THE AGENT, started as the node starts a process: {} --pipe --state, its node's port in relay-state/environment.json.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskunsloth-'));
const state = path.join(scratch, 'relay-state', 'process', 'deskAgent');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'deskAgent', 'win32', 'process') : path.join(state, 'door.sock');
let kid = null;
let out = { stdout: '', stderr: '', code: null };
function start() {
  out = { stdout: '', stderr: '', code: null };
  kid = spawn(process.execPath, [AGENT, '{}', '--pipe', pipe, '--state', state], { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  kid.stdout.on('data', function (c) { out.stdout += c; });
  kid.stderr.on('data', function (c) { out.stderr += c; });
  kid.on('exit', function (code) { out.code = code === null ? 'signal' : code; });
}
// The child of THIS stop, bound here: part 6 restarts the agent, and a timer reading the module's kid would kill the
// new one (wsl-claude, building against this red).
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
function writeFiles(which) {
  ['configuration.json', 'connection.json'].forEach(function (f) { try { fs.unlinkSync(path.join(state, f)); } catch (e) { /* none */ } });
  if (which.indexOf('configuration') !== -1) fs.writeFileSync(path.join(state, 'configuration.json'), JSON.stringify(CONFIGURATION, null, 1));
  // SINCE goal/G10.9 it starts connected only on the desk-recommended mark: the known list names the model as passed.
  if (which.indexOf('configuration') !== -1) fs.writeFileSync(path.join(state, 'models.json'), JSON.stringify({ active: CONFIGURATION.model, activeQuant: '', models: [{ id: CONFIGURATION.model, quant: '', loaded: true, recommended: true, tested: '2026-10-12T00:00:00.000Z' }] }));
  if (which.indexOf('connection') !== -1) fs.writeFileSync(path.join(state, 'connection.json'), JSON.stringify({ key: 'test-key', url: 'http://127.0.0.1:' + model.address().port + '/v1' }, null, 1));
}
function textOf(call) { return ((call.body && call.body.messages) || []).map(function (m) { return typeof m.content === 'string' ? m.content : JSON.stringify(m.content); }); }
function holds(call, s) { return textOf(call).join('\n').indexOf(s) !== -1; }
function nextAsks() { return nodeAsks.filter(function (b) { return b.verb === 'deskClient.next'; }).length; }

test.startTest('goal/G10.3: the context is built from the desk goal for the local agent');

async function suite() {
  await new Promise(function (r) { node.listen(0, '127.0.0.1', r); });
  await new Promise(function (r) { model.listen(0, '127.0.0.1', r); });
  fs.mkdirSync(path.join(scratch, 'relay-state'), { recursive: true });
  fs.writeFileSync(path.join(scratch, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.address().port }));
  setUp();

  // SINCE goal/G19.12 A MISSING CONFIGURATION STARTS ON DEFAULTS. Andy, 2026-10-12, asked whether deskAgent should
  // start without configuration.json, on defaults: "yes." This section asserted that it ended; it now asserts that it
  // runs, so a session that brings the refusal back goes red.
  test.subHeading('1. without its configuration it starts on defaults; the connection may come later');
  writeFiles([]);
  nodeAsks.length = 0; calls.length = 0;
  start();
  await until(function () { return out.code !== null; }, 3000);
  if (out.code === null && !calls.length) test.check('without configuration.json it starts on defaults and asks no model');
  else test.fail('goal/G19.12: without configuration.json it ' + (out.code === null ? 'called the model ' + calls.length + ' time(s)' : 'exited ' + out.code) + ', stderr ' + JSON.stringify(out.stderr.slice(0, 160)));
  await stop();
  // WITHOUT connection.json IT STARTS (goal/G10.7): the connect tab sets it through connection.set; until then it asks
  // no model.
  writeFiles(['configuration']);
  nodeAsks.length = 0; calls.length = 0;
  start();
  await until(function () { return nextCount >= 1 || out.code !== null; }, 6000);
  if (out.code === null && !calls.length) test.check('without connection.json it starts and asks no model');
  else test.fail(OWED + 'without connection.json it ' + (out.code === null ? 'called the model ' + calls.length + ' time(s)' : 'exited ' + out.code));
  await stop();
  writeFiles(['configuration', 'connection']);
  nodeAsks.length = 0; calls.length = 0; posted.length = 0; nextQueue = []; nextCount = 0;
  start();
  const up = await until(function () { return nextCount >= 2 || out.code !== null; }, 8000);
  if (up && out.code === null && nextCount >= 2) test.check('with both files it runs and waits on its node\'s deskClient.next, again after an empty answer');
  else { test.fail(OWED + 'with both files it ' + (out.code === null ? 'asked next ' + nextCount + ' time(s)' : 'exited ' + out.code + ' saying ' + JSON.stringify((out.stderr + out.stdout).slice(0, 200)))); return; }

  // The studio's context is read with the known list, which a models ask refreshes (goal/G14.6, goal/G10.7).
  const client = appClient.createAppClient({ rootDir: scratch, log: function () {} });
  client.register('deskAgent', pipe);
  await client.ask({ deskAgent: { 'models.search': { text: '', marks: [] } } }).catch(function () { return null; });
  await until(function () { return studioReads.indexOf('/api/inference/status') !== -1; }, 5000);

  test.subHeading('2. the call: rules, persona, both boxes, the newest lines that fit');
  const ask1 = 'levant: what is this item about?';
  nextQueue.push([said('ctx/G1.2', ask1)]);
  if (!await until(function () { return calls.length >= 1; }, 10000)) { test.fail(OWED + 'an addressed line brought no call to the model in 10 s (posted ' + posted.length + ', stderr ' + JSON.stringify(out.stderr.slice(0, 160)) + ')'); return; }
  const c1 = calls[0];
  const sys = ((c1.body && c1.body.messages) || []).filter(function (m) { return m.role === 'system'; }).map(function (m) { return String(m.content); }).join('\n');
  if (/\/chat\/completions$/.test(c1.url) && c1.auth === 'Bearer test-key' && c1.body.model === CONFIGURATION.model && c1.body.max_tokens === CONFIGURATION.answerTokens) test.check('the call goes to the connection\'s url with its key, names the configuration\'s model and asks answerTokens');
  else test.fail(OWED + 'the call went to ' + c1.url + ' as ' + JSON.stringify(c1.auth) + ', model ' + JSON.stringify(c1.body.model) + ', max_tokens ' + JSON.stringify(c1.body.max_tokens));
  if (sys.indexOf(AGENTS_TEXT) !== -1 && sys.indexOf(PREAMBLE) !== -1) test.check('the system message holds the desk\'s AGENTS text and the persona\'s preamble');
  else test.fail(OWED + 'the system message is ' + JSON.stringify(sys.slice(0, 160)));
  if (holds(c1, GOAL_BOX) && holds(c1, ITEM_BOX)) test.check('the goal\'s box and the item\'s box are in the call');
  else test.fail(OWED + 'the boxes are not both in the call: goal ' + holds(c1, GOAL_BOX) + ', item ' + holds(c1, ITEM_BOX));
  const present = []; for (let n = 1; n <= 8; n++) present.push(holds(c1, filler(n)));
  const first = present.indexOf(true);
  const suffix = first !== -1 && present.slice(first).every(Boolean);
  const total = textOf(c1).reduce(function (s, t) { return s + bytes(t); }, 0);
  if (holds(c1, ask1) && !present[0] && suffix && total <= PROMPT_ROOM) test.check('the chat is a window of the newest lines: the asking line is in, line 1 is out, and the messages fit (the studio context_length - answerTokens) * bytesPerToken', total + ' of ' + PROMPT_ROOM + ' bytes, lines ' + present.map(function (p) { return p ? 1 : 0; }).join(''));
  else test.fail(OWED + 'asking line ' + holds(c1, ask1) + ', lines present ' + present.map(function (p) { return p ? 1 : 0; }).join('') + ', ' + total + ' bytes of ' + PROMPT_ROOM);
  if (await until(function () { return posted.length >= 1; }, 5000) && posted[0].id === 'ctx/G1.2' && posted[0].text.indexOf(modelScript[0]) !== -1 && /^levant[:,]/i.test(posted[0].text) && posted[0].text.indexOf('[loop.js]') === -1) test.check('the answer is posted under the item, in its own name, without [loop.js]');
  else test.fail(OWED + 'posted ' + short(posted[0] || null));

  test.subHeading('3. nothing kept between calls');
  const answer1 = posted[0] ? posted[0].text : '';
  desk.items['ctx/G1.2'].box = ITEM_BOX + ' CHANGED AT THE DESK since the first call.';
  desk.items['ctx/G1.2'].version = 6;
  desk.items['ctx/G1.2'].chat = desk.items['ctx/G1.2'].chat.filter(function (l) { return l.text !== answer1 && l.text !== ask1; });
  const ask2 = 'Levant, and now?';
  nextQueue.push([said('ctx/G1.2', ask2)]);
  if (await until(function () { return calls.length >= 2; }, 10000)) {
    const c2 = calls[1];
    if (holds(c2, 'CHANGED AT THE DESK') && !holds(c2, ask1) && (!answer1 || !holds(c2, answer1.slice(0, 40)))) test.check('the second call carries the box as changed and nothing the desk no longer holds');
    else test.fail(OWED + 'changed box ' + holds(c2, 'CHANGED AT THE DESK') + ', the first ask still in ' + holds(c2, ask1) + ', the first answer still in ' + (answer1 ? holds(c2, answer1.slice(0, 40)) : 'n/a'));
  } else test.fail(OWED + 'a second addressed line (name, comma) brought no second call');
  await until(function () { return posted.length >= 2; }, 5000);

  test.subHeading('4. a long answer goes back in lines under the room, split at paragraphs');
  const paragraphs = []; for (let p = 1; p <= 5; p++) { let s = 'Paragraph ' + p + '. '; while (bytes(s) < 2500) s += 'A sentence of the long answer, number ' + p + '. '; paragraphs.push(s.trim()); }
  modelScript = [paragraphs.join('\n\n'), 'Short.'];
  posted.length = 0;
  nextQueue.push([said('ctx/G1.2', 'levant: tell me at length')]);
  await until(function () { return posted.length >= 1 && posted.every(function (l) { return paragraphs.every(function (p) { return posted.some(function (q) { return q.text.indexOf(p) !== -1; }); }); }); }, 12000);
  await sleep(500);
  const whole = paragraphs.every(function (p) { return posted.filter(function (l) { return l.text.indexOf(p) !== -1; }).length === 1; });
  const order = paragraphs.map(function (p) { return posted.findIndex(function (l) { return l.text.indexOf(p) !== -1; }); }).every(function (i, k, a) { return k === 0 || i >= a[k - 1]; });
  const under = posted.every(function (l) { return bytes(l.text) <= LINE_ROOM; });
  if (posted.length >= 2 && whole && order && under && posted.every(function (l) { return l.id === 'ctx/G1.2' && l.text.indexOf('[loop.js]') === -1; })) test.check('five paragraphs of 2.5 KB came back as ' + posted.length + ' lines under ' + LINE_ROOM + ' bytes each, every paragraph whole, in order');
  else test.fail(OWED + posted.length + ' line(s) posted; whole paragraphs ' + whole + ', in order ' + order + ', each under the room ' + under + '; first ' + short(posted[0] ? posted[0].text.slice(0, 60) : null));
  modelScript = ['Short.'];

  // SINCE goal/G10.8, EVERY CHANGE BUT ITS OWN. Andy, 2026-10-12, asked whether Levant should read every desk change
  // and act on it as claude does: "yes. it'll make flaws visible." The desk's rules in the call say which lines are
  // not its to answer; the model judges. Its own line never reaches the model.
  test.subHeading('5. every change but its own, and JOBs');
  calls.length = 0; posted.length = 0;
  const others = [
    'cw: a line for the other agent, not the local one',
    'a note of andy\'s with no address; levant is named but not addressed',
  ];
  nextQueue.push([
    said('ctx/G1.2', others[0]),
    said('ctx/G1.2', others[1]),
    'DESK desk chat.add ' + JSON.stringify({ id: 'ctx/G1.2', text: 'message delivered, Levant is at the desk' }),
  ]);
  await until(function () { return calls.length >= 1; }, 10000);
  if (calls.length >= 1 && others.every(function (t) { return holds(calls[0], t); }) && holds(calls[0], 'message delivered, Levant is at the desk')) test.check('lines not addressed to it reach the model, every change of the item in one call');
  else test.fail('OWED by goal/G10.8: ' + calls.length + ' call(s) for the unaddressed lines; the first holds ' + short(calls[0] && textOf(calls[0]).slice(-3)));
  await until(function () { return posted.length >= 1; }, 5000);
  calls.length = 0; posted.length = 0;
  nextQueue.push([said('ctx/G1.2', 'Levant: my own line, said by me', 'levant')]);
  await sleep(2500);
  if (!calls.length) test.check('its own line reaches no model call');
  else test.fail('OWED by goal/G10.8: its own line called the model');
  nextQueue.push(['JOB ctx/G1.2 build rules: rule/1@1']);
  if (await until(function () { return calls.length >= 1 && posted.length >= 1; }, 10000) && posted[0].id === 'ctx/G1.2' && holds(calls[0], ITEM_BOX.slice(0, 40))) test.check('a JOB line is answered under its item, with the item\'s box in the call');
  else test.fail(OWED + 'a JOB line brought ' + calls.length + ' call(s) and ' + posted.length + ' post(s), the first under ' + (posted[0] ? posted[0].id : 'nothing'));

  test.subHeading('6. the present, never the backlog');
  await stop();
  setUp();
  // The models ask of part 2 rewrote the known list from the fake studio; the 🧵 is set again for the restart (goal/G10.9).
  writeFiles(['configuration', 'connection']);
  calls.length = 0; posted.length = 0; nodeAsks.length = 0; nextCount = 0;
  const old1 = 'levant: a line from before it started';
  const old2 = 'levant: another one from the backlog';
  nextQueue = [[said('ctx/G1.2', old1)], [said('ctx/G1.2', old2)]];
  start();
  const caughtUp = await until(function () { return nextCount >= 3 || out.code !== null; }, 8000);
  await sleep(300);
  const fresh = 'levant: a line from now';
  nextQueue.push([said('ctx/G1.2', fresh)]);
  const answered = await until(function () { return calls.length >= 1 && posted.length >= 1; }, 10000);
  const backlogAsked = calls.some(function (c) { return holds(c, 'from before it started') && !holds(c, fresh); }) || calls.some(function (c) { return holds(c, 'another one from the backlog') && !holds(c, fresh); });
  if (caughtUp && out.code === null && answered && calls.length === 1 && posted.length === 1 && holds(calls[0], fresh) && !backlogAsked) test.check('two backlog lines handed over before the first empty next are read and not answered; the line after it is');
  else test.fail(OWED + (out.code !== null ? 'it exited ' + out.code : calls.length + ' call(s), ' + posted.length + ' post(s); the fresh line in a call ' + calls.some(function (c) { return holds(c, fresh); }) + ', a backlog line answered on its own ' + backlogAsked));
}

suite().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  try { node.close(); } catch (e) { /* closed */ }
  try { model.close(); } catch (e) { /* closed */ }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
