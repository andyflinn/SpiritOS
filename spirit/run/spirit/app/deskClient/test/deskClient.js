'use strict';

// spirit/run/spirit/app/deskClient/test/deskClient.js
// The tests of spirit/app/deskClient/deskClient.js, and of no other module (spec: ./deskClient.md; goal/G41.11). The
// server runs in this process on a state folder of its own: the spirit object, appServer and the file watcher are
// stubs, the data set and the desk's translator are the real ones, and the desk is a fake that keeps every ask and
// answers what the test tells it to. The desk's stream is fed by hand, as appServer's streamListener feeds it.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the chokidar and noTeamChat parts, once files of
// their own, are sections at its end, run after the checks above and counted with them.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskClient.js');
// The family paths, as the one function names them (goal/G41.12).
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
const API = path.join(__dirname, '..', 'api.js');

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
const D = require(path.join(RUN, 'spirit', 'data.js'));
let served = null;
let subscribes = 0;   // each time deskClient asks its node's appServer to subscribe it to the desk
const subscribeArgs = [];   // what each subscribe was handed: { key, family, since }
let curD = D;   // the data set the running deskClient holds (a restarted one gets a fresh one)
let cacheSaves = 0;   // each time deskClient asks appServer to save its cache now
let cacheAnswer = [];   // what appServer answers: [{ file, bytes }], a file per sender it caches
// goal/G41.22: the rows appServer's cache keeps, as it keeps them (the desk family's own cache.keep, spirit/appServer.js
// keepRow), and, set before a restart, the rows it reads back into the fresh data set at the start, before deskClient
// runs a line past serve() (appServer restoreCaches): through the translator, no onRow.
// goal/G41.24: the desk's cache rules and its translator are one file in the desk's family folder, data.js.
const CCM = path.join(RUN, 'spirit', 'app', 'desk', 'data.js');
const DESK_API = (function () { try { return require(CCM); } catch (e) { return { cache: { keep: function (rows, r) { return rows.concat([r]); } } }; } }());
let cacheRows = [];
let restoreRows = null;
const appServerStub = {
  get data() { return curD; },
  serve: function (verbs, opts) {
    // As appServer takes a stream's translator (goal/G41.24): required, and attached to the data set when it hands an attach.
    if (opts && opts.stream && opts.stream.translator) {
      require(path.resolve(String(opts.stream.translator)));
    }
    // Each row under its sender, as appServer's restoreCaches writes it (written(st, row): take(job, st.key); goal/G41.28).
    if (restoreRows) { restoreRows.forEach(function (r) { curD.takeJob({ module: 'spirit.app.desk', data: {}, app: r }, DESK); }); restoreRows = null; }
    served = { verbs: verbs, opts: opts || {} };
    return { subscribe: function (key, family, since) { subscribes += 1; subscribeArgs.push({ key: key, family: family, since: since }); return Promise.resolve(true); }, follow: function () { return Promise.resolve(true); } };
  },
  publish: function () {},
  // goal/G41.12: the cache is appServer's (spirit/state/<server>/<sender key in base64url>.json, goal/G41.28); deskClient's
  // cache.dump asks it to save now.
  saveCaches: function () { cacheSaves += 1; return cacheAnswer.slice(); },
};
globalThis.spirit = {
  familyPath: familyPath,
  require: function (p) {
    if (p === 'spirit/app/desk/api.js') return Promise.resolve(deskFamily);
    if (/spirit\/contact\/api\.js$/.test(p)) return Promise.resolve({ get: function () { return Promise.resolve({ person: { blocked: true } }); } });
    // goal/G43.32, decided 3: on the node spirit.require is a path-translating wrapper, a script's module at once;
    // appServer is the stand-in above.
    if (/(^|\/)appServer\.js$/.test(p)) return appServerStub;
    if (!/\/api\.js$/.test(p)) return require(path.join(RUN, p));
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function () { return { status: 0, body: null }; }); },
};
// The data set lives on the one spirit object, where the desk's translator finds it (spirit/data.js).
globalThis.spirit.data = D;
// What the checkout's watcher does on a file event, kept from its on('all').
let watchAll = null;
// The verifier's publishes, as this client hears them: its subscribers on the node's event stream.
const eventSubscribers = [];
globalThis.spirit.event = { subscribe: function (h) { eventSubscribers.push(h); return function () {}; }, publish: function () { return Promise.resolve({}); } };
const verifierSays = function (run) {
  const job = { id: 'verify-job', module: 'spirit.app.deskVerify', data: {}, app: run };
  eventSubscribers.forEach(function (h) { if (h && typeof h.onUpdate === 'function') h.onUpdate(job); });
};
const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|\/)spirit\.js$/.test(request) && parent && parent.filename === FILE) return globalThis.spirit;
  if (/(^|\/)appServer\.js$/.test(request)) return appServerStub;
  // The node's own chokidar component (spirit/job/chokidar/), as deskClient.js requires it.
  // goal/G43.32: spirit.require hands node the run-root path made whole, so on Windows its separators are backslashes.
  if (request === 'chokidar' || /(^|[\\/])chokidar[\\/]index\.js$/.test(request)) return { watch: function () { const w = { on: function (ev, fn) { if (ev === 'all') watchAll = fn; return w; } }; return w; } };
  return realLoad.apply(this, arguments);
};
// resubscribeMs 1 is read by nothing: deskClient.js has no such value. It subscribes again after QUIET_MS (10 s) of
// silence (resubscribeQuiet, goal/G41.12), so the 30 ms silence below never reaches that.
process.argv = [process.argv[0], FILE, JSON.stringify({ historyMax: 1000, resubscribeMs: 1 }), '--state', STATE,
  '--node', JSON.stringify({ name: SELF, publicKey: SELF_KEY, ownerKey: '' })];

// ── THE STREAM, FED BY HAND ──────────────────────────────────────────
// Each row under the node that sent it, the desk (goal/G41.28; Andy, the box: "The RAM-CACHE-is organized BY
// SERVER-NODE-ID at it's lowest level."): appServer's streamListener takes it with its sender, take(job, key).
let change = 0;
function push(row) {
  change += 1;
  const r = Object.assign({ change: change }, row);
  curD.takeJob({ module: 'spirit.app.desk', data: {}, app: r }, DESK);
  cacheRows = DESK_API.cache.keep(cacheRows, r);
  return Promise.resolve(served.opts.stream.onRow(r, DESK));
}
// UNUSED: no case below calls pushNoted, and spirit/data.js has no noting or renewed for it to call; a push's end is
// { full: true, end: true } since goal/G41.12, and appServer lands a push (spirit/test/appServer.js).
function pushNoted(row) {
  if (row && row.bootstrapped === true) { curD.renewed(); return Promise.resolve(); }
  change += 1;
  const r = Object.assign({ change: change }, row);
  let said = null;
  curD.noting(function () { curD.takeJob({ module: 'spirit.app.desk', data: {}, app: r }, DESK); said = served.opts.stream.onRow(r, DESK); });
  return Promise.resolve(said);
}
let tick = Date.parse('2030-01-01T00:00:00Z');
const at = function () { tick += 1000; return new Date(tick).toISOString(); };
function factsOf(extra) { return Object.assign({ id: ITEM, goal: GOAL, title: 'an item', version: 1, with: '', phase: '', go: true }, extra || {}); }
const verb = function (name) { return served.verbs[name]; };
// WHAT THE CACHE HOLDS, ASKED OF THE DESK'S MANAGER (goal/G41.28; Andy: "doesn't the fucking ... clientCacheManager.js take
// care of that"): spirit.data.desk.data answers by what a thing is, the running deskClient's (a restart attaches it anew); no
// branch is named here.
const DD = function () { return ((globalThis.spirit.data || {}).desk || {}).data || { item: function () { return null; }, part: function () { return null; }, current: function () { return ''; }, change: function () { return 0; } }; };
function call(name, args, caller) { return Promise.resolve().then(function () { return verb(name).handler(args || {}, caller || OWNER); }); }
function ask(name, args) { return call('desk', { name: name, json: JSON.stringify(args || {}) }); }
// One wait, as the agent's listener asks it: its lines, or a refusal's code.
// read: the key of the last wake the agent read (goal/G41.11: "the next arm must name it"), or none.
function next(read) { return call('next', read ? { read: read } : {}).then(function (r) { return r; }, function (e) { return { refused: e.refusal || e.message }; }); }
const has = function (r, s) { return !!(r && Array.isArray(r.lines) && r.lines.some(function (l) { return String(l).indexOf(s) !== -1; })); };

// ── THE TESTS, ONE test.run EACH (goal/G47.2) ──────────────────────────────────────────────────────────────────────────
// One scenario on one running deskClient: each test does its step and judges it, in order, so a test needs those before
// it (`--test <title>` runs the sequence up to it). What a step leaves for a later one is kept in V.
const V = {};
const statusesOf = function (from) { return asksOf('item.status').slice(from).map(function (a) { return a.args; }); };
const waitAsk = async function (fn, ms) { for (let i = 0; i < ms / 50; i++) { await settle(); if (fn()) return true; await new Promise(function (r) { setTimeout(r, 50); }); } return !!fn(); };
const HELD = 'goal/G9.60';
const CHECKOUT = path.resolve(RUN, '..', '..');
const NOT_SERVED = 'deskClient serves nothing: the world failed';
const toneOf = async function (rel) {
  const from = asksOf('item.status').length;
  watchAll('change', path.join(CHECKOUT, rel));
  await waitAsk(function () { return statusesOf(from).length > 0; }, 4000);
  const said = statusesOf(from)[0];
  return said && said.id === HELD ? said.tone : '(' + short(said) + ')';
};
const running = function (i) { return { doing: 'run', suite: 'spirit/test/a.js', index: i, of: 256, line: 'running a.js, suite ' + i + ' of 256', since: at() }; };
const kept = function (name, args) { return call('desk', { name: name, json: JSON.stringify(args || {}), kept: true }).then(function (r) { return r; }, function (e) { return { threw: e.refusal || e.message }; }); };
// A restart: a new deskClient on the same state folder, on a fresh data set.
const restart = function () {
  [FILE, path.join(RUN, 'spirit', 'data.js'), CCM].forEach(function (f) { try { delete require.cache[require.resolve(f)]; } catch (e) { /* not there yet */ } });
  curD = require(path.join(RUN, 'spirit', 'data.js'));
  globalThis.spirit.data = curD;
  served = null;
};
const count = function (r, s) { return (r && Array.isArray(r.lines) ? r.lines : []).filter(function (l) { return String(l).indexOf(s) !== -1; }).length; };
const line = function (id, text, when, to) { return { table: 'chat', id: id, goal: 9, item: Number(id.split('.')[1]), to: [to || SELF_KEY], row: { at: when, by: 'andy', text: text, taken: '' } }; };
const ITEM2 = 'goal/G9.2';
const ITEM3 = 'goal/G9.3';
const ITEM4 = 'goal/G9.4';
const ITEM7 = 'goal/G9.7';
const OTHER_GOAL_ITEM = 'goal/G8.1';

test.after(function () { try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

test.run('it serves its verbs and follows the desk\'s stream', 0.2, async function () {
  require(FILE);
  if (!(!!served && !!served.verbs.next && !!served.opts.stream)) return 'served: ' + short(served && Object.keys(served.verbs));
  await call('setDesk', { key: DESK });
  desk.answers['work.open'] = { items: [], more: false };
  // What the desk holds of the item from the start: its file list and its checks.
  desk.answers['item.files'] = function (a) { return a.id === ITEM ? { files: [{ path: 'spirit/run/a.js', by: OTHER, core: false, grant: '' }], filesMore: false } : { files: [], filesMore: false }; };
  desk.answers['item.checks'] = function (a) { return a.id === ITEM ? { checks: [{ number: 'G1', kind: 'G', state: 'open', placedBy: OTHER, placedKey: OTHER_KEY }] } : { checks: [] }; };
  // The current goal, pushed whole: the goal's row, then its item's facts.
  await push({ verb: 'goal.whole', goal: 9, item: { id: GOAL, goal: '', title: 'the goal', version: 1 } });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf() });
  await settle();
  // goal/G43.3: WHAT THE AGENT IS DOING REACHES THE DESK: an item this agent holds.
  await push({ verb: 'phase.done', goal: 9, item: factsOf({ id: HELD, phase: 'red', red: SELF, with: SELF, withKey: SELF_KEY, phaseWith: SELF, go: true }) });
  await settle();
  return true;
}, test.limit.quick);

// goal/G43.3: a product test modified shows as a test, in red; a production file as code. Andy: "when product tests are
// modified, they should show up as red file-status in desk. product tests are the test folders under spirit/run/."
test.run('the world: the client watches its checkout', 0.2, async function () {
  await waitAsk(function () { return !!watchAll; }, 5000);
  return !!watchAll || 'no watcher was set: the file status is not judged';
}, test.limit.slow);
test.run('the desk element\'s test desk.js has the tone test', 0.2, async function () {
  if (!watchAll) return 'no watcher: the world failed';
  const rel = 'spirit/run/spirit/app/desk/element/desk/test/desk.js';
  const tone = await toneOf(rel);
  return tone === 'test' || rel + ': tone ' + short(tone);
}, test.limit.slow);
test.run('the general test relay.js has the tone test', 0.2, async function () {
  if (!watchAll) return 'no watcher: the world failed';
  const rel = 'spirit/run/spirit/test/relay.js';
  const tone = await toneOf(rel);
  return tone === 'test' || rel + ': tone ' + short(tone);
}, test.limit.slow);
test.run('the general test testModule.js has the tone test', 0.2, async function () {
  if (!watchAll) return 'no watcher: the world failed';
  const rel = 'spirit/run/spirit/test/testModule.js';
  const tone = await toneOf(rel);
  return tone === 'test' || rel + ': tone ' + short(tone);
}, test.limit.slow);
test.run('a production file under spirit/run/: tone code', 0.2, async function () {
  if (!watchAll) return 'no watcher: the world failed';
  const prod = await toneOf('spirit/run/spirit/app/desk/element/desk/desk.js');
  return prod === 'code' || 'spirit/run/spirit/app/desk/element/desk/desk.js: tone ' + short(prod);
}, test.limit.slow);

// goal/G43.3: its own verifier's run is relayed to the desk. Andy: "the agents deskClient should relay the agents
// deskVerifier status during a run, this will tell desk that the agent "is busy". with no held item, it shows on the agent
// as working."
test.run('a run under a held item: its status goes under that item', 0.2, async function () {
  const fromRun = asksOf('item.status').length;
  verifierSays(running(1));
  const relayed = await waitAsk(function () { return statusesOf(fromRun).some(function (a) { return a.id === HELD && /suite 1 of 256/.test(a.word); }); }, 3000);
  return relayed || 'the statuses asked: ' + short(statusesOf(fromRun));
}, test.limit.slow);
test.run('and each next suite the same', 0.2, async function () {
  const fromRun2 = asksOf('item.status').length;
  verifierSays(running(2));
  const relayed2 = await waitAsk(function () { return statusesOf(fromRun2).some(function (a) { return /suite 2 of 256/.test(a.word); }); }, 3000);
  return relayed2 || 'the statuses asked: ' + short(statusesOf(fromRun2));
}, test.limit.slow);
test.run('a verify it holds counts as held too', 0.2, async function () {
  await push({ verb: 'phase.done', goal: 9, item: factsOf({ id: HELD, phase: 'verify', verifier: SELF, with: SELF, withKey: SELF_KEY, phaseWith: SELF, go: true }) });
  await settle();
  const fromRun3 = asksOf('item.status').length;
  verifierSays(running(3));
  const relayed3 = await waitAsk(function () { return statusesOf(fromRun3).some(function (a) { return a.id === HELD && /suite 3 of 256/.test(a.word); }); }, 3000);
  return relayed3 || 'the statuses asked: ' + short(statusesOf(fromRun3));
}, test.limit.slow);
test.run('a run with no held item: the agent shows as working, and no item gets a status', 0.2, async function () {
  await push({ verb: 'phase.done', goal: 9, item: factsOf({ id: HELD, phase: 'build', with: '', withKey: '', phaseWith: '', go: true }) });
  await settle();
  const fromIdle = asksOf('item.status').length;
  const stateFrom = asksOf('agent.state').length;
  verifierSays(running(4));
  const working = await waitAsk(function () { return asksOf('agent.state').slice(stateFrom).some(function (a) { return a.args && a.args.word === 'working'; }); }, 3000);
  return (working && statusesOf(fromIdle).length === 0) || 'agent.state asked ' + short(asksOf('agent.state').slice(stateFrom)) + ', statuses ' + short(statusesOf(fromIdle));
}, test.limit.slow);

// The cache dump: one owner-only verb, appServer's own file. goal/G41.12: the cache is appServer's, saved as
// spirit/state/deskClient/<desk key in base64url>.json (goal/G41.28); deskClient keeps no cache file of its own, and its
// cache.dump asks appServer to save now (Andy, goal/G41.15: "the 3 cache.json checks look for the cache in appServer's own
// file, as G41.12 put it").
test.run('deskClient serves cache.dump', 0.2, function () {
  if (!served) return NOT_SERVED;
  return !!verb('cache.dump') || 'no cache.dump among ' + short(Object.keys(served.verbs));
}, test.limit.quick);
test.run('its family interface names cache.dump', 0.2, function () {
  const apiText = fs.existsSync(API) ? fs.readFileSync(API, 'utf8') : '';
  return (/['"]?cache\.dump['"]?\s*:/).test(apiText) || 'api.js does not name cache.dump';
}, test.limit.quick);
test.run('a caller who is not the owner is refused, and nothing is saved', 0.8, async function () {
  V.before = fs.readdirSync(STATE).sort();
  let refusedStranger = null;
  try { await call('cache.dump', {}, STRANGER); } catch (e) { refusedStranger = e.refusal || e.message; }
  return (refusedStranger === 'not-owner' && cacheSaves === 0) || 'stranger: ' + short(refusedStranger) + ', saves ' + cacheSaves;
}, test.limit.quick);
test.run('with no cache kept yet, the dump is refused not-saved', 0.2, async function () {
  let none = null;
  try { none = await call('cache.dump', {}); } catch (e) { none = { threw: e.refusal || e.message }; }
  return (none && none.threw === 'not-saved') || 'answer: ' + short(none);
}, test.limit.quick);
test.run('the owner\'s dump asks appServer to save its cache now, and answers appServer\'s file and its bytes', 0.2, async function () {
  cacheAnswer = [{ file: D.nodeId(DESK) + '.json', bytes: 1234 }];
  let r = null;
  try { r = await call('cache.dump', { path: '../elsewhere.json' }); } catch (e) { r = { threw: e.refusal || e.message }; }
  return (r && r.file === cacheAnswer[0].file && r.bytes === 1234 && cacheSaves === 2) || 'answer: ' + short(r) + ', saves ' + cacheSaves;
}, test.limit.quick);
test.run('deskClient writes no cache file of its own, whatever the caller names: no cache.json, nothing elsewhere', 0.2, function () {
  const before = V.before || [];
  const after = fs.readdirSync(STATE).sort();
  const newFiles = after.filter(function (f) { return before.indexOf(f) === -1; });
  return (newFiles.length === 0 && after.indexOf('cache.json') === -1 && !fs.existsSync(path.join(path.dirname(STATE), 'elsewhere.json'))) || 'new files: ' + short(newFiles) + ', state: ' + short(after);
}, test.limit.quick);

// The cache, whole from the first push: the agent's reads ask the desk nothing.
test.run('item.files of a current-goal item is answered from the cache, the desk not asked', 0.2, async function () {
  // The desk's side rows for the item, as it publishes them.
  await push({ table: 'files', id: ITEM, goal: 9, row: { path: 'spirit/run/a.js', by: OTHER, core: false } });
  await push({ table: 'checks', id: ITEM, goal: 9, row: { number: 'G1', kind: 'G', state: 'open', placedBy: OTHER, placedKey: OTHER_KEY } });
  await settle();
  const filesAsked = asksOf('item.files').length;
  V.checksAsked = asksOf('item.checks').length;
  const files = await ask('item.files', { id: ITEM });
  V.checks = await ask('item.checks', { id: ITEM });
  return (asksOf('item.files').length === filesAsked && files && Array.isArray(files.files) && files.files.some(function (f) { return f.path === 'spirit/run/a.js'; })) ||
    'asked ' + (asksOf('item.files').length - filesAsked) + ' time(s); answer ' + short(files);
}, test.limit.quick);
test.run('item.checks the same', 0.2, function () {
  const checks = V.checks;
  return (asksOf('item.checks').length === V.checksAsked && checks && Array.isArray(checks.checks) && checks.checks.some(function (c) { return c.number === 'G1'; })) ||
    'asked ' + (asksOf('item.checks').length - V.checksAsked) + ' time(s); answer ' + short(checks);
}, test.limit.quick);

// A kept read: cache only, never the desk.
test.run('the desk verb takes kept beside name and json', 0.2, function () {
  if (!served) return NOT_SERVED;
  const deskDecl = verb('desk') && verb('desk').request;
  return (!!deskDecl && Object.prototype.hasOwnProperty.call(deskDecl, 'kept')) || 'request: ' + short(deskDecl);
}, test.limit.quick);
test.run('a kept item.get answers the item\'s facts, with current (the current goal) and self (its own agent) beside them', 0.2, async function () {
  V.before3 = desk.asks.length;
  const kGet = await kept('item.get', { id: ITEM });
  V.kFiles = await kept('item.files', { id: ITEM });
  V.kChecks = await kept('item.checks', { id: ITEM });
  let kItem = {};
  try { kItem = JSON.parse((kGet && kGet.item) || '{}'); } catch (e) { kItem = {}; }
  return (kItem.id === ITEM && kGet.current === GOAL && kGet.self === SELF) || 'answer: ' + short(kGet);
}, test.limit.quick);
test.run('a kept item.files answers {files, filesMore}, a kept item.checks {checks}', 0.2, function () {
  const kFiles = V.kFiles, kChecks = V.kChecks;
  return (kFiles && Array.isArray(kFiles.files) && kFiles.filesMore === false && kChecks && Array.isArray(kChecks.checks)) || 'files ' + short(kFiles) + ', checks ' + short(kChecks);
}, test.limit.quick);
test.run('a kept read the cache cannot answer is refused not-kept, saying why', 0.2, async function () {
  const kMiss = await kept('item.files', { id: 'goal/G9.99' });
  V.kNotRead = await kept('history.search', {});
  return (kMiss && kMiss.ok === false && kMiss.code === 'not-kept' && !!kMiss.why) || 'answer: ' + short(kMiss);
}, test.limit.quick);
test.run('and so is a verb that is no kept read', 0.2, function () {
  const kNotRead = V.kNotRead;
  return (kNotRead && kNotRead.ok === false && kNotRead.code === 'not-kept') || 'answer: ' + short(kNotRead);
}, test.limit.quick);
test.run('no kept read asks the desk', 0.2, function () {
  if (V.before3 === undefined) return 'no kept read was made: the test before failed';
  return desk.asks.length === V.before3 || 'the desk was asked: ' + short(desk.asks.slice(V.before3).map(function (x) { return x.verb; }));
}, test.limit.quick);

// The cache, current: a part the desk moves is answered as moved.
test.run('after the desk moves the box to v6, item.box answers v6 from the cache', 0.2, async function () {
  desk.answers['item.box'] = { box: 'box text v5', version: 5 };
  const first = await ask('item.box', { id: ITEM });
  await push({ table: 'box', id: ITEM, goal: 9, row: { text: 'box text v6', version: 6, at: at(), by: 'KEY-ANDY' } });
  await settle();
  const boxAsked = asksOf('item.box').length;
  const box = await ask('item.box', { id: ITEM });
  return (first && first.version === 5 && box && box.version === 6 && box.box === 'box text v6' && asksOf('item.box').length === boxAsked) || 'first ' + short(first) + ', then ' + short(box);
}, test.limit.quick);
test.run('a file the desk adds later is in the kept list', 0.2, async function () {
  await push({ table: 'files', id: ITEM, goal: 9, row: { path: 'spirit/run/b.js', by: OTHER, core: true } });
  await settle();
  const files2 = await ask('item.files', { id: ITEM });
  return (files2 && Array.isArray(files2.files) && files2.files.some(function (f) { return f.path === 'spirit/run/b.js'; })) || 'files: ' + short(files2);
}, test.limit.quick);

// A grant wakes every agent that placed a G, and the holder of the phase.
test.run('a G placed by another agent, granted on the item whose phase this agent holds, wakes it as its own (DESK)', 0.2, async function () {
  // This agent holds the red of the item; another agent placed G1. His grant of G1 is news this agent must act on.
  await push({ verb: 'phase.take', goal: 9, item: factsOf({ phase: 'red', red: SELF, phaseWith: SELF, with: SELF, withKey: SELF_KEY, version: 2 }) });
  await settle();
  await next();
  await push({ table: 'checks', id: ITEM, goal: 9, by: 'andy', row: { number: 'G1', kind: 'G', state: 'granted', placedBy: OTHER, placedKey: OTHER_KEY } });
  await settle();
  const g1 = await next();
  return (has(g1, 'DESK') && has(g1, '"check":"G1"') && has(g1, 'granted')) || 'wake: ' + short(g1);
}, test.limit.quick);
test.run('a G this agent placed, granted on an item another holds, wakes it', 0.2, async function () {
  // On an item it does not hold, its own G granted wakes it too.
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM2, with: OTHER, withKey: OTHER_KEY, phase: 'build', builder: OTHER, phaseWith: OTHER }) });
  await push({ table: 'checks', id: ITEM2, goal: 9, by: 'andy', row: { number: 'G2', kind: 'G', state: 'granted', placedBy: SELF, placedKey: SELF_KEY } });
  await settle();
  const g2 = await next();
  return (has(g2, 'DESK') && has(g2, '"check":"G2"')) || 'wake: ' + short(g2);
}, test.limit.quick);

// A take with no answer wakes nobody (one line, one agent).
test.run('his line addressed to this agent wakes it', 0.2, async function () {
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM3 }) });
  desk.answers['line.take'] = { ok: false, code: 'no-answer', error: 'no answer yet' };
  await push({ table: 'chat', id: ITEM3, goal: 9, row: { at: at(), by: 'andy', text: 'a line for whoever takes it' } });
  await settle();
  // A line addressed to this agent, so the wait ends at once with what is waiting.
  await push({ table: 'chat', id: ITEM3, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: a line for you alone' } });
  await settle();
  V.taken = await next();
  return has(V.taken, 'a line for you alone') || 'wake: ' + short(V.taken);
}, test.limit.quick);
test.run('a line for whoever takes it, whose take got no answer, is not handed over as this agent\'s', 0.2, function () {
  delete desk.answers['line.take'];
  const taken = V.taken || {};
  return !(taken.lines || []).some(function (l) { return /^DESK/.test(l) && l.indexOf('a line for whoever takes it') !== -1; }) || 'wake: ' + short(taken);
}, test.limit.quick);

// No wake is lost: what does not fit, or waits while the agent is busy, comes with the next wait.
test.run('the line meant for it is handed over', 0.2, async function () {
  // 250 lines of another agent in the current goal while this agent is busy (news), and one meant for it.
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM4 }) });
  V.sent = [];
  for (let i = 0; i < 250; i++) {
    const text = 'news line ' + i + ' ' + 'x'.repeat(200);
    V.sent.push('news line ' + i + ' ');
    await push({ table: 'chat', id: ITEM4, goal: 9, row: { at: at(), by: OTHER, key: OTHER_KEY, text: text } });
  }
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: the trigger' } });
  await settle();
  const got = V.got = [];
  let r = await next();
  let rounds = 0;
  V.firstMore = !!(r && r.more);
  while (r && Array.isArray(r.lines) && r.lines.length && rounds < 40) {
    r.lines.forEach(function (l) { got.push(String(l)); });
    if (!r.more) break;
    rounds += 1;
    // Each wait names the wake just read, so deskClient may drop it and hand on the rest.
    r = await next(r.key);
  }
  V.lastWait = r;
  return got.some(function (l) { return l.indexOf('the trigger') !== -1; }) || 'got ' + got.length + ' lines';
}, test.limit.quick);
test.run('more than one answer holds: the first says more', 0.2, function () {
  return V.firstMore === true || 'first answer had no more';
}, test.limit.quick);
test.run('every one of the 250 lines that came while it was busy is handed over, over as many waits as it takes: none dropped by a cap, none cut and lost', 0.2, async function () {
  const got = V.got || [];
  const missing = (V.sent || []).filter(function (s) { return !got.some(function (l) { return l.indexOf(s) !== -1; }); });
  // Whatever the last wait handed is read: its key comes back, so the queue is clear for what follows.
  if (V.lastWait && V.lastWait.key) await next(V.lastWait.key);
  if (!V.sent) return 'no lines were sent: the test before failed';
  return missing.length === 0 || missing.length + ' of 250 never handed over (first missing: ' + short(missing[0]) + ')';
}, test.limit.long);

// A wake is dropped only once read: the next wait names its key (Andy, goal/G41: "make the red assert it").
test.run('a wake carries its key', 0.2, async function () {
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: read me first' } });
  await settle();
  const w1 = V.w1 = await next();
  return (has(w1, 'read me first') && typeof (w1 && w1.key) === 'string' && w1.key.length > 0) || 'wake: ' + short(w1);
}, test.limit.quick);
test.run('a wait that names no key gets the unread wake again at once, under the same key', 0.2, async function () {
  const w1 = V.w1 || {};
  const t2 = Date.now();
  const w2 = await next();
  return (has(w2, 'read me first') && w2.key === w1.key && Date.now() - t2 < 3000) || 'second wait: ' + short(w2) + ' after ' + (Date.now() - t2) + ' ms';
}, test.limit.quick);
test.run('a wait that names an older key gets the unread wake again', 0.2, async function () {
  const w1 = V.w1 || {};
  const w3 = await next('an older key');
  return (has(w3, 'read me first') && w3.key === w1.key) || 'third wait: ' + short(w3);
}, test.limit.quick);
test.run('naming its key drops the wake: the next wait hands only what came after, under a new key', 0.2, async function () {
  const w1 = V.w1 || {};
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: and then this' } });
  await settle();
  const w4 = V.w4 = await next(w1.key);
  return (has(w4, 'and then this') && !has(w4, 'read me first') && w4.key && w4.key !== w1.key) || 'fourth wait: ' + short(w4);
}, test.limit.quick);

// The desk's line addressed to the cap agents wakes them, with no take, and entitles them to the box.
// A delivery of several rows is appServer's bundle (goal/G41.12: one JSON array, taken row by row before onRow);
// deskClient sees each row alone (spirit/test/appServer.js); b1 is the last wake read above.
test.run('the desk\'s line whose to holds its key wakes it as its own, asking no take', 0.2, async function () {
  const b1 = V.w4 || {};
  const takesBefore = asksOf('line.take').length;
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'desk', text: 'the box of goal/G9.4 turned red; the cap is offered' } });
  await settle();
  const c1 = V.c1 = await next(b1.key);
  return (has(c1, 'DESK desk chat.add') && has(c1, 'the cap is offered') && asksOf('line.take').length === takesBefore) || 'answer: ' + short(c1) + ', takes ' + (asksOf('line.take').length - takesBefore);
}, test.limit.quick);
test.run('and its box.take there passes the gate, entitled by that line', 0.2, async function () {
  const getsBefore = asksOf('item.get').length;
  const boxTakes = asksOf('box.take').length;
  let took = null;
  try { took = await ask('box.take', { id: ITEM4 }); } catch (e) { took = { threw: e.refusal || e.message }; }
  return (asksOf('box.take').length === boxTakes + 1 && asksOf('item.get').length === getsBefore) || 'answer: ' + short(took);
}, test.limit.quick);

// ── THE FLOOD (Andy, goal/G41.11: "and we MUST look more precisely at performance again"; "deskClient keeps it's cache
// ... through new subscribes"; "subscribes over peerPost should NOT expire, at least not on the client-side") ──────
// The silence below is 30 ms, inside the 10 s after which a quiet stream is subscribed again (goal/G41.12: "the client
// after getting nothing for a while must resubscribe"), so this checks only that a short silence asks nothing.
// A subscribe over peerPost does not expire on the client side.
test.run('a wait after a silence hands its line and does not subscribe again', 0.2, async function () {
  let readKey = (V.w4 && V.w4.key) || '';
  for (const k of [V.c1 && V.c1.key, V.w4 && V.w4.key]) if (k) readKey = k;
  const subsBefore = subscribes;
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: after a silence' } });
  await settle();
  // Then quiet: nothing on the stream for longer than resubscribeMs.
  await new Promise(function (r) { setTimeout(r, 30); });
  const s1 = await next(readKey);
  if (s1 && s1.key) readKey = s1.key;
  V.readKey = readKey;
  return (has(s1, 'after a silence') && subscribes === subsBefore) || 'subscribes asked: ' + (subscribes - subsBefore) + ', answer ' + short(s1);
}, test.limit.quick);

// A goal pushed whole again asks the desk nothing it already keeps.
test.run('no item.files or item.checks is asked again for items whose lists the cache holds', 0.2, async function () {
  const filesBefore = asksOf('item.files').length;
  const checksBefore = asksOf('item.checks').length;
  await push({ verb: 'goal.whole', goal: 9, item: { id: GOAL, goal: '', title: 'the goal', version: 1 } });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf() });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM4 }) });
  await settle();
  return (asksOf('item.files').length === filesBefore && asksOf('item.checks').length === checksBefore) ||
    'asked again: item.files ' + (asksOf('item.files').length - filesBefore) + ', item.checks ' + (asksOf('item.checks').length - checksBefore);
}, test.limit.quick);

// A waiting wake is handed at once, even while the desk is slow.
test.run('the line is handed within 3 s, never held behind a slow job ask or a slow agent.state', 0.2, async function () {
  // As live on 2026-10-27: each ask of the desk took about 10 s, the node cut the wait at 12 s, the agent got a 504.
  const slow = function (value) { return function () { return new Promise(function (r) { setTimeout(function () { r(value); }, 10500); }); }; };
  desk.answers['work.open'] = slow({ items: [], more: false });
  desk.answers['agent.state'] = slow({ ok: true });
  // A row that may open a job (a phase nobody holds, with his Go), and a line for this agent.
  await push({ verb: 'phase.done', goal: 9, item: factsOf({ id: ITEM4, phase: 'build', phaseWith: '', go: true, version: 7 }) });
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: while the desk is slow' } });
  await settle();
  const t5 = Date.now();
  const s5 = await next(V.readKey);
  const handedIn = Date.now() - t5;
  delete desk.answers['work.open'];
  delete desk.answers['agent.state'];
  if (s5 && s5.key) V.readKey = s5.key;
  return (has(s5, 'while the desk is slow') && handedIn < 3000) || 'handed in ' + handedIn + ' ms: ' + short(s5);
}, test.limit.quick);

// ── THE POSITION, THE SAVED CACHE AND THE SWEEP (goal/G41.11) ──────────────────────────────────────────────────────
// goal/G41.12: saving is appServer's (within 10 ms of each row, spirit/test/appServer.js); deskClient only switches it on.
// The cache is appServer's: deskClient switches it on and saves nothing itself.
test.run('deskClient follows the desk\'s stream with the cache switch on', 0.2, function () {
  if (!served) return NOT_SERVED;
  return (served.opts.stream && served.opts.stream.cache === true) || 'stream: ' + short(served.opts.stream && { cache: served.opts.stream.cache });
}, test.limit.quick);
// goal/G41.24, Andy: "deskClient can get it form its own disc": its translator is the desk family's data.js.
test.run('its stream\'s translator is spirit/app/desk/data.js, from its own disc', 0.2, function () {
  if (!served) return NOT_SERVED;
  return (served.opts.stream && path.resolve(String(served.opts.stream.translator || '')) === CCM) || 'translator: ' + short(served.opts.stream && served.opts.stream.translator);
}, test.limit.quick);
test.run('a row lands in the data set, and deskClient writes no cache.json of its own', 0.2, async function () {
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: 'goal/G9.6', title: 'saved soon' }) });
  await settle();
  await new Promise(function (r) { setTimeout(r, 40); });
  return (!!DD().item('goal/G9.6') && !fs.existsSync(path.join(STATE, 'cache.json'))) || 'held: ' + !!DD().item('goal/G9.6') + ', cache.json: ' + fs.existsSync(path.join(STATE, 'cache.json'));
}, test.limit.quick);

// goal/G41.15, Andy: "deskClient keeps what it cached outside the current goal; a push of one goal never drops another's",
// and Q1: "nothing drops from the cache, unless the api.js from the server says so". A push is appServer's to land
// (spirit/test/appServer.js); deskClient names nothing for it to replace and sweeps nothing itself.
// A push drops nothing deskClient kept: it names nothing to replace, and sweeps nothing.
test.run('deskClient names nothing for a push to replace (no renews)', 0.2, function () {
  if (!served) return NOT_SERVED;
  return !(served.opts.stream && 'renews' in served.opts.stream) || 'stream: ' + short(served.opts.stream && Object.keys(served.opts.stream));
}, test.limit.quick);
test.run('an item the push leaves out stays kept, beside the ones it carries', 0.2, async function () {
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM7, title: 'left out of the next push' }) });
  await push({ verb: 'goal.whole', goal: 8, item: factsOf({ id: OTHER_GOAL_ITEM, goal: 'goal/G8', title: 'another goal' }) });
  await settle();
  V.partBefore = DD().part(ITEM);
  // The current goal pushed whole again, naming every item but ITEM7, and no item of goal/G8.
  await push({ verb: 'goal.whole', goal: 9, item: { id: GOAL, goal: '', title: 'the goal', version: 1 } });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf() });
  await push({ verb: 'goal.whole', goal: 9, item: factsOf({ id: ITEM4 }) });
  await settle();
  return (!!DD().item(ITEM7) && !!DD().item(ITEM) && !!DD().item(ITEM4)) || short({ item7: !!DD().item(ITEM7), item: !!DD().item(ITEM), item4: !!DD().item(ITEM4) });
}, test.limit.quick);
test.run('and another goal\'s items stay kept', 0.2, function () {
  return !!DD().item(OTHER_GOAL_ITEM) || 'goal/G8.1: ' + short(DD().item(OTHER_GOAL_ITEM));
}, test.limit.quick);
test.run('the push makes its goal current; the change heard and a kept file list are never swept', 0.2, function () {
  const partAfter = DD().part(ITEM);
  return (DD().current() === GOAL && DD().change() > 0 && !!V.partBefore && !!partAfter && Array.isArray(partAfter.files)) ||
    short({ current: DD().current(), change: DD().change(), part: partAfter && Object.keys(partAfter) });
}, test.limit.quick);

// goal/G41.12: reading the cache back, and the position (run, n) a subscribe carries, are appServer's
// (spirit/test/appServer.js: "started again, it reads its cache back before it subscribes"); deskClient subscribes to
// the desk and leaves the position to appServer.
// A restarted deskClient subscribes to its desk, the position appServer's.
test.run('it subscribes to the desk it knew, family desk, and names no position of its own', 0.2, async function () {
  await new Promise(function (r) { setTimeout(r, 40); });
  V.heard = DD().change();
  restart();
  subscribeArgs.length = 0;
  require(FILE);
  await settle();
  const firstSub = subscribeArgs[0];
  return (!!served && !!firstSub && firstSub.key === DESK && firstSub.family === 'desk' && firstSub.since === undefined) || 'subscribes: ' + short(subscribeArgs);
}, test.limit.quick);
test.run('setDesk naming the same desk subscribes to it again', 0.2, async function () {
  subscribeArgs.length = 0;
  await call('setDesk', { key: DESK });
  return (subscribeArgs.length === 1 && subscribeArgs[0].key === DESK && subscribeArgs[0].since === undefined) || 'subscribes: ' + short(subscribeArgs);
}, test.limit.quick);
test.run('setDesk naming another desk subscribes to that one', 0.2, async function () {
  subscribeArgs.length = 0;
  await call('setDesk', { key: 'KEY-ANOTHER-DESK' });
  const said = (subscribeArgs.length === 1 && subscribeArgs[0].key === 'KEY-ANOTHER-DESK') || 'subscribes: ' + short(subscribeArgs);
  await call('setDesk', { key: DESK });
  return said;
}, test.limit.quick);

// The catch-up after a since-subscribe: its own lines wake it, another's never.
test.run('a line addressed to it, handed in the catch-up, wakes it', 0.2, async function () {
  change = V.heard || change;
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [SELF_KEY], row: { at: at(), by: 'andy', text: 'wsl: missed while down' } });
  await push({ table: 'chat', id: ITEM4, goal: 9, to: [OTHER_KEY], row: { at: at(), by: 'andy', text: 'cw: for the other agent only' } });
  await settle();
  const caught = V.caught = await next();
  V.read = (caught && caught.key) || '';
  return has(caught, 'missed while down') || 'wake: ' + short(caught);
}, test.limit.quick);
test.run('a line addressed to another agent in the catch-up is neither its own nor its news', 0.2, function () {
  return !has(V.caught, 'for the other agent only') || 'wake: ' + short(V.caught);
}, test.limit.quick);

// ── goal/G41.22: EVERY WAKE NOT YET READ COMES BACK IN ONE, NONE LOST AND NONE TWICE, ALSO AFTER A RESTART ─────────────
// Andy, the box (Desk Ear): "every wake not yet read comes back in one, none lost and none twice, also after a node
// restart."
// Within one run the first half is a guard, no test of its own: a break of it fails the test after it, with its words;
// its holding counts nothing. The restart then checks the wake kept in deskClient's settings (saveWake) and read back at
// start: a restarted deskClient loses nothing unread and hands nothing read.
test.run('the next wake hands, once each, the wake handed but never read and the line that waited', 0.2, async function () {
  let read = V.read || '';
  // Wakes nobody read come back in one, each line once (a guard within one run).
  await push(line(ITEM4, 'wsl: wake A', at()));
  await settle();
  const wA = await next(read);
  await push(line(ITEM4, 'wsl: wake B', at()));
  await settle();
  const wB = await next();
  await push(line(ITEM4, 'wsl: wake C', at()));
  await settle();
  const wC = await next(wA && wA.key);
  if (!(count(wC, 'wake A') === 1 && count(wC, 'wake B') === 1 && count(wC, 'wake C') === 1)) {
    return 'three wakes nobody read are not handed in one answer, each line once: A ' + short(wA) + ', B ' + short(wB) + ', C ' + short(wC);
  }
  await push(line(ITEM4, 'wsl: wake D', at()));
  await settle();
  const wD = await next(wC && wC.key);
  if (!(count(wD, 'wake D') === 1 && !has(wD, 'wake A') && !has(wD, 'wake B') && !has(wD, 'wake C'))) return 'reading with its key does not acknowledge them all: ' + short(wD);
  read = (wD && wD.key) || read;
  // The restart.
  await push(line(ITEM4, 'wsl: handed, never read', at()));
  await settle();
  const wE = await next(read);
  if (!has(wE, 'handed, never read')) return 'set up: the wake to leave unread is not handed: ' + short(wE);
  const rowF = line(ITEM4, 'wsl: came while it was down to restart', at());
  await push(rowF);
  await settle();
  // The restart: a new deskClient on the same state folder, its data set read back from appServer's cache.
  restart();
  restoreRows = cacheRows.slice();
  require(FILE);
  await settle();
  // The catch-up after it hands rows already handed again: D was read, E was not.
  const again = cacheRows.filter(function (r) { return r.table === 'chat' && r.row && /wake D|handed, never read/.test(String(r.row.text)); });
  for (const r of again) await Promise.resolve(served.opts.stream.onRow(r, DESK));
  await settle();
  // The agent read D and armed with its key before the restart; its listener asks with that key.
  const wAfter = V.wAfter = await next(read);
  return (count(wAfter, 'handed, never read') === 1 && count(wAfter, 'came while it was down') === 1) || 'wake: ' + short(wAfter);
}, test.limit.quick);
test.run('and nothing it already read comes back', 0.2, function () {
  const wAfter = V.wAfter;
  return (!!wAfter && Array.isArray(wAfter.lines) && wAfter.lines.length > 0 && !has(wAfter, 'wake D') && !has(wAfter, 'wake A')) || 'wake: ' + short(wAfter);
}, test.limit.quick);

// ── THE CHOKIDAR PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// deskClient WATCHES ITS CLONE WITH chokidar FROM spirit/job/ (goal/G43.25; spec: ./deskClient.md, section "chokidar"). Andy:
// "can we hide those suckers in spirit/jobs/ for now? without the damn node_modules container?". deskClient.js requires
// chokidar by path, the one in spirit/job/chokidar/, and what it requires, watching a folder, hears a file added. The move
// itself is spirit/test/job.js, its vendoredLibraries part. The watcher run in a child process on a scratch folder inside
// spirit/run.
const REPO = path.resolve(RUN, '..', '..');
const CHOKIDAR_USER = 'spirit/run/spirit/app/deskClient/deskClient.js';
function codeOf(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
function shortLong(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
// 3. the two users require it by path: deskClient.js here, job.js in spirit/test/job.js
test.run('it requires chokidar by a path that is spirit/job/chokidar/index.js', 0.2, function () {
  const idxNew = path.join(REPO, 'spirit/run/spirit/job/', 'chokidar', 'index.js');
  const u = CHOKIDAR_USER;
  const c = codeOf(fs.readFileSync(path.join(REPO, u), 'utf8'));
  const specs = (c.match(/require\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); });
  let to = '';
  // goal/G43.32: loaded by spirit.require, by its run-root path ("spirit/jobs/chokidar/index.js"); a relative path is the old way.
  try { to = specs.length === 1 ? require.resolve(specs[0].charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, u)), specs[0]) : path.join(RUN, specs[0])) : ''; } catch (e) { to = ''; }
  return to === idxNew || u + ' requires ' + shortLong(specs) + ' (resolves to ' + shortLong(to || 'nothing') + ')';
}, test.limit.quick);
// 4. the file watcher works as before: deskClient's. Scratch folders inside spirit/run (scanFolder refuses anything outside
// it, as fsWatcherCommands.js says), removed after.
test.run('its watcher hears a file added', 0.2, function () {
  const { spawnSync } = require('child_process');
  function child(src, dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
    fs.rmSync(dir, { recursive: true, force: true });
    return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : '');
  }
  // deskClient's watch of its clone: what deskClient requires, watching a folder, hears a file added.
  const dcSpec = (codeOf(fs.readFileSync(path.join(REPO, CHOKIDAR_USER), 'utf8')).match(/require\(\s*['"]([^'"]*chokidar[^'"]*)['"]\s*\)/) || [])[1] || '';
  const dcFrom = dcSpec.charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, CHOKIDAR_USER)), dcSpec) : path.join(RUN, dcSpec);
  const dcOut = child([
    "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
    "let w = null; try { w = require(require.resolve(" + JSON.stringify(dcFrom) + ", { paths: [" + JSON.stringify(path.dirname(path.join(REPO, CHOKIDAR_USER))) + "] })); } catch (e) { console.log('NOT LOADED ' + e.message); process.exit(0); }",
    "w.watch(dir, { ignoreInitial: true, persistent: true }).on('add', function (f) { if (/made\\.txt$/.test(f)) { console.log('HEARD'); process.exit(0); } });",
    "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
    "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
  ].join('\n'), path.join(RUN, 'vendoredFolders-desk-test'));
  return (/^HEARD/.test(dcOut) && dcFrom.indexOf('chokidar') !== -1) || 'deskClient\'s watcher (' + shortLong(dcSpec) + '): ' + shortLong(dcOut);
}, test.limit.slow);

// ── THE NOTEAMCHAT PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// deskClient WAKES NOBODY ON A TEAM CHAT LINE (goal/G43.22; spec: ./deskClient.md, section "noTeamChat"):
// spirit/app/deskClient/deskClient.js. Andy, the box: "the apps and plugin system goes.", "there will only be goals, items
// and rules left, plus the verifier stuff can stay for now.". Q5: "G0 goes, from ui and server, kept in database.". The
// tree read as it is, comments left out. Andy: "G0 goes, from ui and server".
test.run('deskClient wakes nobody on a team chat line', 0.2, function () {
  let client = '';
  try { client = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'deskClient', 'deskClient.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { client = ''; }
  return (!!client && !/goal\/G0['"]/.test(client)) || 'deskClient.js still names goal/G0';
}, test.limit.quick);
