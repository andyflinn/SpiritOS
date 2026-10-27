'use strict';

// spirit/run/process/js/deskClient/test/deskClient.js
// The tests of process/js/deskClient/deskClient.js, and of no other module (spec: ./deskClient.md; goal/G41.11). The
// server runs in this process on a state folder of its own: the spirit object, appServer and the file watcher are
// stubs, the data set and the desk's translator are the real ones, and the desk is a fake that keeps every ask and
// answers what the test tells it to. The desk's stream is fed by hand, as appServer's streamListener feeds it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskClient.js');
const API = path.join(__dirname, '..', 'deskClient.family', 'api.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); };

const SELF = 'wsl-claude';
const SELF_KEY = 'KEY-WSL';
const OTHER = 'claude-windows';
const OTHER_KEY = 'KEY-CW';
const DESK = 'KEY-DESK';
const GOAL = 'goal/G9';
const ITEM = 'goal/G9.1';
const OWNER = { owner: true, key: SELF_KEY };
const STRANGER = { owner: false, key: 'KEY-NOBODY' };

// ── THE FAKE DESK ────────────────────────────────────────────────────
// Every ask is kept. An answer is what `answers[verb]` gives (a value, or a function of the args); `hold[verb]` makes
// the ask never answer; the default is a plain ok.
const desk = { asks: [], answers: {}, hold: {} };
function deskAnswer(verb, args) {
  desk.asks.push({ verb: verb, args: args });
  if (desk.hold[verb]) return new Promise(function () {});
  const a = desk.answers[verb];
  return Promise.resolve(typeof a === 'function' ? a(args) : (a !== undefined ? a : { ok: true }));
}
const deskFamily = new Proxy({}, { get: function (t, verb) { if (typeof verb !== 'string' || verb === 'then') return undefined; return function (args) { return deskAnswer(verb, args); }; } });
const asksOf = function (verb) { return desk.asks.filter(function (a) { return a.verb === verb; }); };

// ── THE STUBS ────────────────────────────────────────────────────────
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'deskClient-test-'));
const D = require(path.join(RUN, 'shell', 'js', 'spiritData.js'));
let served = null;
const appServerStub = {
  get data() { return D; },
  serve: function (verbs, opts) {
    if (opts && opts.stream && opts.stream.translator) require(path.resolve(String(opts.stream.translator)));
    served = { verbs: verbs, opts: opts || {} };
    return { subscribe: function () { return Promise.resolve(true); }, follow: function () { return Promise.resolve(true); } };
  },
  publish: function () {},
};
globalThis.spirit = {
  require: function (p) {
    if (/desk\.family\/api\.js$/.test(p)) return Promise.resolve(deskFamily);
    if (/spirit\/contact\/api\.js$/.test(p)) return Promise.resolve({ get: function () { return Promise.resolve({ person: { blocked: true } }); } });
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function () { return { status: 0, body: null }; }); },
};
// The data set lives on the one spirit object, where the desk's translator finds it (shell/js/spiritData.js).
globalThis.spirit.data = D;
const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|\/)spirit\.js$/.test(request) && parent && parent.filename === FILE) return globalThis.spirit;
  if (/spirit\/appServer\.js$/.test(request)) return appServerStub;
  if (request === 'chokidar') return { watch: function () { const w = { on: function () { return w; } }; return w; } };
  return realLoad.apply(this, arguments);
};
process.argv = [process.argv[0], FILE, JSON.stringify({ historyMax: 1000, resubscribeMs: 600000 }), '--state', STATE,
  '--node', JSON.stringify({ name: SELF, publicKey: SELF_KEY, ownerKey: '' })];

// ── THE STREAM, FED BY HAND ──────────────────────────────────────────
let change = 0;
function push(row) {
  change += 1;
  const r = Object.assign({ change: change }, row);
  D.take({ module: 'process/js/desk', data: {}, app: r });
  return Promise.resolve(served.opts.stream.onRow(r, DESK));
}
let tick = Date.parse('2030-01-01T00:00:00Z');
const at = function () { tick += 1000; return new Date(tick).toISOString(); };
function factsOf(extra) { return Object.assign({ id: ITEM, goal: GOAL, title: 'an item', version: 1, with: '', phase: '', go: true }, extra || {}); }
const verb = function (name) { return served.verbs[name]; };
function call(name, args, caller) { return Promise.resolve().then(function () { return verb(name).handler(args || {}, caller || OWNER); }); }
function ask(name, args) { return call('desk', { name: name, json: JSON.stringify(args || {}) }); }
// One wait, as the agent's listener asks it: its lines, or a refusal's code.
// read: the key of the last wake the agent read (goal/G41.11: "the next arm must name it"), or none.
function next(read) { return call('next', read ? { read: read } : {}).then(function (r) { return r; }, function (e) { return { refused: e.refusal || e.message }; }); }
const has = function (r, s) { return !!(r && Array.isArray(r.lines) && r.lines.some(function (l) { return String(l).indexOf(s) !== -1; })); };

test.startTest('deskClient.js: the desk client, its cache and its wakes (goal/G41.11)');

(async function () {
  try { require(FILE); } catch (e) { test.fail('deskClient.js threw as it loaded: ' + e.message); }
  ok(!!served && !!served.verbs.next && !!served.opts.stream, 'it serves its verbs and follows the desk\'s stream', 'served: ' + short(served && Object.keys(served.verbs)));
  if (!served) return;
  await call('setDesk', { key: DESK });
  desk.answers['work.open'] = { items: [], more: false };
  // What the desk holds of the item from the start: its file list and its checks.
  desk.answers['item.files'] = function (a) { return a.id === ITEM ? { files: [{ path: 'spirit/run/a.js', by: OTHER, core: false, grant: '' }], filesMore: false } : { files: [], filesMore: false }; };
  desk.answers['item.checks'] = function (a) { return a.id === ITEM ? { checks: [{ number: 'G1', kind: 'G', state: 'open', placedBy: OTHER, placedKey: OTHER_KEY }] } : { checks: [] }; };
  // The current goal, pushed whole: the goal's row, then its item's facts.
  await push({ verb: 'goal.whole', goal: 9, item: { id: GOAL, goal: '', title: 'the goal', version: 1 } });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf() });
  await settle();

  test.subHeading('the cache dump: one owner-only verb, one fixed file');
  const dump = verb('cache.dump');
  ok(!!dump, 'deskClient serves cache.dump', 'no cache.dump among ' + short(Object.keys(served.verbs)));
  const apiText = fs.existsSync(API) ? fs.readFileSync(API, 'utf8') : '';
  ok(/['"]?cache\.dump['"]?\s*:/.test(apiText), 'its family interface (deskClient.family/api.js) names cache.dump', 'api.js does not name cache.dump');
  if (dump) {
    const before = fs.readdirSync(STATE).sort();
    let refusedStranger = null;
    try { await call('cache.dump', {}, STRANGER); } catch (e) { refusedStranger = e.refusal || e.message; }
    ok(refusedStranger === 'not-owner' && !fs.existsSync(path.join(STATE, 'cache.json')), 'a caller who is not the owner is refused, and nothing is written', 'stranger: ' + short(refusedStranger));
    let r = null;
    try { r = await call('cache.dump', { path: '../elsewhere.json' }); } catch (e) { r = { threw: e.message }; }
    const file = path.join(STATE, 'cache.json');
    const written = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    ok(!!written && JSON.stringify(written) === JSON.stringify(D.data), 'the owner\'s call writes the whole cache, its spirit.data tree, as JSON to <state>/cache.json', 'written: ' + short(written) + ' answer ' + short(r));
    const after = fs.readdirSync(STATE).sort();
    ok(after.filter(function (f) { return before.indexOf(f) === -1; }).join() === 'cache.json' && !fs.existsSync(path.join(path.dirname(STATE), 'elsewhere.json')),
      'and nowhere else, whatever the caller names', 'new files: ' + short(after.filter(function (f) { return before.indexOf(f) === -1; })));
  }

  test.subHeading('the cache, whole from the first push: the agent\'s reads ask the desk nothing');
  // The desk's side rows for the item, as it publishes them.
  await push({ table: 'files', id: ITEM, goal: 9, row: { path: 'spirit/run/a.js', by: OTHER, core: false } });
  await push({ table: 'checks', id: ITEM, goal: 9, row: { number: 'G1', kind: 'G', state: 'open', placedBy: OTHER, placedKey: OTHER_KEY } });
  await settle();
  const filesAsked = asksOf('item.files').length;
  const checksAsked = asksOf('item.checks').length;
  const files = await ask('item.files', { id: ITEM });
  const checks = await ask('item.checks', { id: ITEM });
  ok(asksOf('item.files').length === filesAsked && files && Array.isArray(files.files) && files.files.some(function (f) { return f.path === 'spirit/run/a.js'; }),
    'item.files of a current-goal item is answered from the cache, the desk not asked', 'asked ' + (asksOf('item.files').length - filesAsked) + ' time(s); answer ' + short(files));
  ok(asksOf('item.checks').length === checksAsked && checks && Array.isArray(checks.checks) && checks.checks.some(function (c) { return c.number === 'G1'; }),
    'item.checks the same', 'asked ' + (asksOf('item.checks').length - checksAsked) + ' time(s); answer ' + short(checks));

  test.subHeading('a kept read: cache only, never the desk (the commit check\'s interface, process/js/desk/test/commitCheck.js)');
  const kept = function (name, args) { return call('desk', { name: name, json: JSON.stringify(args || {}), kept: true }).then(function (r) { return r; }, function (e) { return { threw: e.refusal || e.message }; }); };
  const deskDecl = verb('desk') && verb('desk').request;
  ok(!!deskDecl && Object.prototype.hasOwnProperty.call(deskDecl, 'kept'), 'the desk verb takes kept beside name and json', 'request: ' + short(deskDecl));
  const before3 = desk.asks.length;
  const kGet = await kept('item.get', { id: ITEM });
  const kFiles = await kept('item.files', { id: ITEM });
  const kChecks = await kept('item.checks', { id: ITEM });
  let kItem = {};
  try { kItem = JSON.parse((kGet && kGet.item) || '{}'); } catch (e) { kItem = {}; }
  ok(kItem.id === ITEM && kGet.current === GOAL && kGet.self === SELF, 'a kept item.get answers the item\'s facts, with current (the current goal) and self (its own agent) beside them', 'answer: ' + short(kGet));
  ok(kFiles && Array.isArray(kFiles.files) && kFiles.filesMore === false && kChecks && Array.isArray(kChecks.checks), 'a kept item.files answers {files, filesMore}, a kept item.checks {checks}', 'files ' + short(kFiles) + ', checks ' + short(kChecks));
  const kMiss = await kept('item.files', { id: 'goal/G9.99' });
  const kNotRead = await kept('history.search', {});
  ok(kMiss && kMiss.ok === false && kMiss.code === 'not-kept' && !!kMiss.why, 'a kept read the cache cannot answer is refused not-kept, saying why', 'answer: ' + short(kMiss));
  ok(kNotRead && kNotRead.ok === false && kNotRead.code === 'not-kept', 'and so is a verb that is no kept read', 'answer: ' + short(kNotRead));
  ok(desk.asks.length === before3, 'no kept read asks the desk', 'the desk was asked: ' + short(desk.asks.slice(before3).map(function (x) { return x.verb; })));

  test.subHeading('the cache, current: a part the desk moves is answered as moved');
  desk.answers['item.box'] = { box: 'box text v5', version: 5 };
  const first = await ask('item.box', { id: ITEM });
  await push({ table: 'box', id: ITEM, goal: 9, row: { text: 'box text v6', version: 6, at: at(), by: 'KEY-ANDY' } });
  await settle();
  const boxAsked = asksOf('item.box').length;
  const box = await ask('item.box', { id: ITEM });
  ok(first && first.version === 5 && box && box.version === 6 && box.box === 'box text v6' && asksOf('item.box').length === boxAsked,
    'after the desk moves the box to v6, item.box answers v6 from the cache', 'first ' + short(first) + ', then ' + short(box));
  await push({ table: 'files', id: ITEM, goal: 9, row: { path: 'spirit/run/b.js', by: OTHER, core: true } });
  await settle();
  const files2 = await ask('item.files', { id: ITEM });
  ok(files2 && Array.isArray(files2.files) && files2.files.some(function (f) { return f.path === 'spirit/run/b.js'; }), 'a file the desk adds later is in the kept list', 'files: ' + short(files2));

  test.subHeading('a grant wakes every agent that placed a G, and the holder of the phase');
  // This agent holds the red of the item; another agent placed G1. His grant of G1 is news this agent must act on.
  await push({ verb: 'phase.take', goal: 9, item: factsOf({ phase: 'red', red: SELF, phaseWith: SELF, with: SELF, withKey: SELF_KEY, version: 2 }) });
  await settle();
  await next();
  await push({ table: 'checks', id: ITEM, goal: 9, by: 'andy', row: { number: 'G1', kind: 'G', state: 'granted', placedBy: OTHER, placedKey: OTHER_KEY } });
  await settle();
  const g1 = await next();
  ok(has(g1, 'DESK') && has(g1, '"check":"G1"') && has(g1, 'granted'), 'a G placed by another agent, granted on the item whose phase this agent holds, wakes it as its own (DESK)', 'wake: ' + short(g1));
  // On an item it does not hold, its own G granted wakes it too.
  const ITEM2 = 'goal/G9.2';
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM2, with: OTHER, withKey: OTHER_KEY, phase: 'build', builder: OTHER, phaseWith: OTHER }) });
  await push({ table: 'checks', id: ITEM2, goal: 9, by: 'andy', row: { number: 'G2', kind: 'G', state: 'granted', placedBy: SELF, placedKey: SELF_KEY } });
  await settle();
  const g2 = await next();
  ok(has(g2, 'DESK') && has(g2, '"check":"G2"'), 'a G this agent placed, granted on an item another holds, wakes it', 'wake: ' + short(g2));

  test.subHeading('a take with no answer wakes nobody (one line, one agent)');
  const ITEM3 = 'goal/G9.3';
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM3 }) });
  desk.answers['line.take'] = { ok: false, code: 'no-answer', error: 'no answer yet' };
  await push({ table: 'chat', id: ITEM3, goal: 9, row: { at: at(), by: 'andy', text: 'a line for whoever takes it' } });
  await settle();
  // A line addressed to this agent, so the wait ends at once with what is waiting.
  await push({ table: 'chat', id: ITEM3, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: a line for you alone' } });
  await settle();
  const taken = await next();
  ok(has(taken, 'a line for you alone'), 'his line addressed to this agent wakes it', 'wake: ' + short(taken));
  ok(!(taken.lines || []).some(function (l) { return /^DESK/.test(l) && l.indexOf('a line for whoever takes it') !== -1; }),
    'a line for whoever takes it, whose take got no answer, is not handed over as this agent\'s', 'wake: ' + short(taken));
  delete desk.answers['line.take'];

  test.subHeading('no wake is lost: what does not fit, or waits while the agent is busy, comes with the next wait');
  // 250 lines of another agent in the current goal while this agent is busy (news), and one meant for it.
  const ITEM4 = 'goal/G9.4';
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM4 }) });
  const sent = [];
  for (let i = 0; i < 250; i++) {
    const text = 'news line ' + i + ' ' + 'x'.repeat(200);
    sent.push('news line ' + i + ' ');
    await push({ table: 'chat', id: ITEM4, goal: 9, row: { at: at(), by: OTHER, key: OTHER_KEY, text: text } });
  }
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: the trigger' } });
  await settle();
  const got = [];
  let r = await next();
  let rounds = 0;
  const firstMore = !!(r && r.more);
  while (r && Array.isArray(r.lines) && r.lines.length && rounds < 40) {
    r.lines.forEach(function (l) { got.push(String(l)); });
    if (!r.more) break;
    rounds += 1;
    // Each wait names the wake just read, so deskClient may drop it and hand on the rest.
    r = await next(r.key);
  }
  const missing = sent.filter(function (s) { return !got.some(function (l) { return l.indexOf(s) !== -1; }); });
  ok(got.some(function (l) { return l.indexOf('the trigger') !== -1; }), 'the line meant for it is handed over', 'got ' + got.length + ' lines');
  ok(firstMore, 'more than one answer holds: the first says more', 'first answer had no more');
  ok(missing.length === 0, 'every one of the 250 lines that came while it was busy is handed over, over as many waits as it takes: none dropped by a cap, none cut and lost', missing.length + ' of 250 never handed over (first missing: ' + short(missing[0]) + ')');
  // Whatever the last wait handed is read: its key comes back, so the queue is clear for what follows.
  if (r && r.key) await next(r.key);

  test.subHeading('a wake is dropped only once read: the next wait names its key (Andy, goal/G41: "make the red assert it")');
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: read me first' } });
  await settle();
  const w1 = await next();
  ok(has(w1, 'read me first') && typeof (w1 && w1.key) === 'string' && w1.key.length > 0, 'a wake carries its key', 'wake: ' + short(w1));
  const t2 = Date.now();
  const w2 = await next();
  ok(has(w2, 'read me first') && w2.key === w1.key && Date.now() - t2 < 3000, 'a wait that names no key gets the unread wake again at once, under the same key', 'second wait: ' + short(w2) + ' after ' + (Date.now() - t2) + ' ms');
  const w3 = await next('an older key');
  ok(has(w3, 'read me first') && w3.key === w1.key, 'a wait that names an older key gets the unread wake again', 'third wait: ' + short(w3));
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: and then this' } });
  await settle();
  const w4 = await next(w1.key);
  ok(has(w4, 'and then this') && !has(w4, 'read me first') && w4.key && w4.key !== w1.key, 'naming its key drops the wake: the next wait hands only what came after, under a new key', 'fourth wait: ' + short(w4));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
