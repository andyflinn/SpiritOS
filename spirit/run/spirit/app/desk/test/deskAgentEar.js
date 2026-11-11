'use strict';

// spirit/run/spirit/app/desk/test/deskAgentEar.js
// The tests of spirit/app/desk/deskAgentEar.js, and of no other module (spec: ./deskAgentEar.md; goal/G41.11). The ear
// runs as the agent runs it, a process of its own; a preload stands in for the one spirit object, so the deskClient it
// asks is a recorder that answers what the test says and writes down every ask.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const EAR = path.join(__dirname, '..', 'deskAgentEar.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// The scratch folder and the stand-in, made on the first ear() a test runs, so a failure to make them lands on that test.
let DIR = '';
let PRELOAD = '';
function prepare() {
  if (DIR) return;
  DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'deskAgentEar-test-'));
  PRELOAD = path.join(DIR, 'preload.js');
  // The stand-in: spirit.js answers a spirit object whose deskClient family records each ask (ASK_LOG) and answers from
  // ANSWERS, a JSON object of verb -> list of answers, each used once in turn, the last one again.
  fs.writeFileSync(PRELOAD, [
    "'use strict';",
    "const fs = require('fs');",
    "const Module = require('module');",
    "const LOG = process.env.ASK_LOG;",
    "const ANSWERS = JSON.parse(process.env.ANSWERS || '{}');",
    "const used = {};",
    "function answer(verb) { const list = ANSWERS[verb] || [{ ok: true }]; const i = Math.min(used[verb] || 0, list.length - 1); used[verb] = (used[verb] || 0) + 1; return list[i]; }",
    "const family = new Proxy({}, { get: function (t, verb) { if (verb === 'then' || typeof verb !== 'string') return undefined; return function (args) { fs.appendFileSync(LOG, JSON.stringify({ verb: String(verb), args: args }) + '\\n'); return Promise.resolve(answer(String(verb))); }; } });",
    // familyPath, the one spirit object's own (spirit.js, goal/G41.12), read before the stand-in takes spirit.js's place:
    // the ear asks it since then.
    "const familyPath = require(" + JSON.stringify(path.join(RUN, 'spirit', 'spirit.js')) + ").familyPath;",
    "const fake = { familyPath: familyPath, require: function () { return Promise.resolve(family); }, outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: 500, body: { ok: false, error: String(e && e.message || e) } }; }); } };",
    "const realLoad = Module._load;",
    "Module._load = function (request) { if (/(^|\\/)spirit\\.js$/.test(request)) { globalThis.spirit = fake; return fake; } return realLoad.apply(this, arguments); };",
  ].join('\n'));
}

let runs = 0;
function ear(args, answers) {
  prepare();
  runs += 1;
  const log = path.join(DIR, 'asks-' + runs + '.jsonl');
  fs.writeFileSync(log, '');
  const r = spawnSync(process.execPath, ['-r', PRELOAD, EAR].concat(args), {
    encoding: 'utf8', timeout: 30000, env: Object.assign({}, process.env, { ASK_LOG: log, ANSWERS: JSON.stringify(answers || {}) }),
  });
  const asks = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || ''), asks: asks };
}


const W = {};

// A wake names its key, and the line to arm with next.
const wake = { lines: ['DESK andy chat.add {"id":"goal/G9.1","text":"wsl: hello"}'], key: 'w-17' };
test.run('a wait prints the wake\'s lines and exits 0', 0.2, function () {
  const a = W.a = ear(['45441'], { next: [wake] });
  return (a.code === 0 && a.out.indexOf('wsl: hello') !== -1) || 'exit ' + a.code + ', out ' + short(a.out) + short(a.err);
}, test.limit.quick);
test.run('its last line is the arm to run next: next: node deskAgentEar.js <port> --read <key>', 0.2, function () {
  if (!W.a) return 'no wait ran: the test before failed';
  const outLines = W.a.out.trim().split('\n');
  return outLines[outLines.length - 1] === 'next: node deskAgentEar.js 45441 --read w-17' || 'last line: ' + short(outLines[outLines.length - 1]);
}, test.limit.quick);
test.run('armed without --read it asks next with no key', 0.2, function () {
  if (!W.a) return 'no wait ran: the test before failed';
  const firstNext = W.a.asks.filter(function (x) { return x.verb === 'next'; })[0];
  return (!!firstNext && JSON.stringify(firstNext.args) === '{}') || 'asked: ' + short(W.a.asks);
}, test.limit.quick);

// The next arm names that key.
test.run('with --read <key> it asks next with { read: key }', 0.2, function () {
  const b = W.b = ear(['45441', '--read', 'w-17'], { next: [{ lines: ['DESK andy chat.add {"id":"goal/G9.1","text":"wsl: after"}'], key: 'w-18' }] });
  const nexts = b.asks.filter(function (x) { return x.verb === 'next'; });
  return (b.code === 0 && nexts.length >= 1 && nexts[0].args && nexts[0].args.read === 'w-17') || 'exit ' + b.code + ', asked ' + short(b.asks) + short(b.err);
}, test.limit.quick);
test.run('--read is no desk verb: the desk is not asked', 0.2, function () {
  if (!W.b) return 'no arm ran: the test before failed';
  return !W.b.asks.some(function (x) { return x.verb === 'desk'; }) || 'asked: ' + short(W.b.asks);
}, test.limit.quick);
test.run('and ends with the new wake\'s key', 0.2, function () {
  if (!W.b) return 'no arm ran: the test before failed';
  return /--read w-18\s*$/.test(W.b.out) || 'out: ' + short(W.b.out);
}, test.limit.quick);

// An arm that names no key is handed the unread wake at once.
test.run('deskClient hands the unread wake again, and the ear prints it on the first ask', 0.2, function () {
  const c = ear(['45441'], { next: [wake] });
  return (c.code === 0 && c.out.indexOf('wsl: hello') !== -1 && c.asks.filter(function (x) { return x.verb === 'next'; }).length === 1) || 'exit ' + c.code + ', asks ' + c.asks.length;
}, test.limit.quick);

// An empty answer is asked again; a refusal ends it.
test.run('it asks again while the answer is empty, naming the same key each time', 0.2, function () {
  const d = ear(['45441', '--read', 'w-18'], { next: [{ lines: [] }, { lines: [] }, { lines: ['DESK a third'], key: 'w-19' }] });
  const dn = d.asks.filter(function (x) { return x.verb === 'next'; });
  return (d.code === 0 && dn.length === 3 && dn.every(function (x) { return x.args && x.args.read === 'w-18'; })) || 'asks ' + short(dn) + ', exit ' + d.code;
}, test.limit.quick);
// A door that timed out (504, app-did-not-answer) handed nothing: the ear waits again with the same key, never ends.
test.run('a door that timed out is asked again with the same key, and the wake that follows is printed', 0.2, function () {
  const t = ear(['45441', '--read', 'w-19'], { next: [{ ok: false, code: 'app-did-not-answer', error: 'the app server did not answer in time' }, { lines: ['DESK after the timeout'], key: 'w-20' }] });
  const tn = t.asks.filter(function (x) { return x.verb === 'next'; });
  return (t.code === 0 && tn.length === 2 && tn.every(function (x) { return x.args && x.args.read === 'w-19'; }) && /after the timeout/.test(t.out)) || 'exit ' + t.code + ', asks ' + short(tn) + ', err ' + short(t.err);
}, test.limit.quick);
test.run('a signed-off agent is told so, exit 1', 0.2, function () {
  const e = ear(['45441'], { next: [{ ok: false, code: 'signed-off', error: 'this agent is signed off' }] });
  return (e.code === 1 && /signed off/.test(e.err)) || 'exit ' + e.code + ', err ' + short(e.err);
}, test.limit.quick);

// One ask of the desk, or of deskClient, printed as it came.
test.run('a desk verb goes through deskClient\'s desk, its answer printed', 0.2, function () {
  const f = ear(['45441', 'item.get', '{"id":"goal/G9.1"}'], { desk: [{ item: '{}', version: 3 }] });
  let version = null;
  try { version = JSON.parse(f.out).version; } catch (e) { version = null; }
  return (f.code === 0 && f.asks.length === 1 && f.asks[0].verb === 'desk' && f.asks[0].args.name === 'item.get' && version === 3) || 'exit ' + f.code + ', asks ' + short(f.asks);
}, test.limit.quick);
test.run('a desk refusal ends it with exit 1', 0.2, function () {
  const g = ear(['45441', 'item.get', '{"id":"goal/G9.1"}'], { desk: [{ ok: false, code: 'refused', why: 'no' }] });
  return g.code === 1 || 'exit ' + g.code;
}, test.limit.quick);
test.run('deskClient.<verb> asks deskClient itself', 0.2, function () {
  const h = ear(['45441', 'deskClient.history.search', '{"text":""}'], { 'history.search': [{ items: [], more: false }] });
  return (h.code === 0 && h.asks.length === 1 && h.asks[0].verb === 'history.search') || 'exit ' + h.code + ', asks ' + short(h.asks);
}, test.limit.quick);
test.run('a port that is no number gets the usage, exit 2', 0.2, function () {
  const i = ear(['nope'], {});
  return (i.code === 2 && /usage/.test(i.err)) || 'exit ' + i.code;
}, test.limit.quick);

test.after(function () {
  try { if (DIR) fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { /* a temp folder left behind is no failure */ }
});
