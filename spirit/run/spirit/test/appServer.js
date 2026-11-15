'use strict';

// spirit/run/spirit/test/appServer.js
// The tests of spirit/appServer.js, and of no other module (spec: ./appServer.md; goal/G41.11, goal/G41.12). The real
// appServer serves one server on a pipe of its own in a temp folder, publishing a stream and following it: its client
// half subscribes to its own publisher half, and the publisher hands its rows back over the same pipe, to its own
// streamListener. The one spirit object is a stand-in, so nothing reaches a real node: the families answer by posting to
// that pipe, and a delivery can be held back, or refused, until the test says otherwise. A restart is a second process:
// this file run with --child <mode>, printing one RESULT line.
// The one test file of appServer.js: the agentsFile part (AGENTS.md through spirit.fs.loadFile), the mount part (the
// node starts a server from spirit/app/<name>/) and the stateCache part (its cache in spirit/state/<name>/cache/), once
// appServer-agentsFile.js, appServer-mount.js and appServer-stateCache.js, are sections of it, run after its own checks
// and never in a --child process.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const FILE = path.join(__dirname, '..', 'appServer.js');
const SELF_FILE = __filename;
const TRANSLATOR = path.join(RUN, 'spirit', 'app', 'desk', 'data.js');
const CHILD = process.argv[2] === '--child' ? String(process.argv[3] || '') : '';
const test = CHILD ? null : require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };

// The publisher's key, base64 as a node key is. It holds a + and a /, as real keys do (goal/G41.28), so only base64url
// names its cache file and its branch (cacheFile below). PUBLISHER_HEX is left from the hex name of box v15; nothing reads it.
const PUBLISHER = Buffer.from('KEY-DESK\xfb\xef\xbf\xfe', 'latin1').toString('base64');
const PUBLISHER_HEX = Buffer.from(PUBLISHER, 'base64').toString('hex');
const SELF = 'KEY-CLIENT';
// The server families (box v15, Family folders); deskAgent killed on goal/G41.28 (Andy: "all, KILL deskAgent!").
const FAMILIES = ['backup', 'deskClient', 'testicle'];

const TMP = CHILD ? String(process.argv[4]) : fs.mkdtempSync(path.join(os.tmpdir(), 'appServer-test-'));
// A server name of the test's own, so its cache folder (spirit/state/<name>/) is no real server's.
const NAME = CHILD ? String(process.argv[5]) : 'streamProbe';
let PIPE = path.join(TMP, NAME + '.sock');
function post(verb, args, callerKey) {
  return new Promise(function (resolve) {
    const body = JSON.stringify({ [verb]: args });
    const req = http.request({ socketPath: PIPE, path: '/', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Spirit-Caller': callerKey } }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { let b = null; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { b = null; } resolve({ status: res.statusCode, body: b }); });
    });
    req.on('error', function (e) { resolve({ status: 0, body: { error: e.message } }); });
    req.end(body);
  });
}
// Every delivery the publisher makes, parsed; held while gate.held, refused while gate.refuse.
const gate = { held: false, refuse: false, waiting: [] };
const posts = [];
function deliver(json) {
  let parsed = null;
  try { parsed = JSON.parse(json); } catch (e) { parsed = null; }
  posts.push(parsed);
  if (gate.refuse) return Promise.reject(new Error('refused by the test'));
  const go = function () { return post('streamListener', { json: json }, PUBLISHER).then(function (r) { return r.status === 200 ? r.body : Promise.reject(new Error('refused ' + short(r.body))); }); };
  if (!gate.held) return go();
  return new Promise(function (resolve, reject) { gate.waiting.push(function () { go().then(resolve, reject); }); });
}
function release() { gate.held = false; const w = gate.waiting.splice(0); w.forEach(function (fn) { fn(); }); }
const asked = [];
// The one family path function (goal/G41.12), spirit.js's own, read before the stand-in takes spirit.js's place. spirit.js
// loads the data set as it is required, onto the real spirit object; it is let go again, so appServer's own load of it
// puts it on the stand-in, where the desk's translator finds it.
const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;
delete require.cache[require.resolve(path.join(RUN, 'spirit', 'data.js'))];
const fake = {
  familyPath: familyPath,
  require: function (p, key) {
    const q = String(p);
    if (/spirit\/auth\/api\.js$/.test(q)) {
      return Promise.resolve({
        grant: function (a) { asked.push({ verb: 'auth.grant', args: a }); return Promise.resolve({ ok: true }); },
        search: function () { return Promise.resolve({ items: [], more: false }); },
      });
    }
    // A server family under a key (the publisher's, as the client subscribes; the client's, as the publisher delivers),
    // at the path spirit.familyPath gives: routing only, this test writes no family path of its own.
    if (key && /^spirit\/(?:app\/)?[^/]+\/api\.js$/.test(q)) {
      return Promise.resolve({
        subscribe: function (a) { asked.push({ verb: 'subscribe', key: key, args: a }); return post('subscribe', a, SELF).then(function (r) { return r.body; }); },
        streamListener: function (a) { return deliver(a.json); },
      });
    }
    // goal/G43.32, decided 3: on the node spirit.require is a path-translating wrapper, a script's module at once.
    if (!/\/api\.js$/.test(q)) return require(path.join(RUN, q));
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: 500, body: { ok: false, error: String(e && e.message || e) } }; }); },
  event: { publish: function () {}, subscribe: function () {} },
  // A server reports its DEBUG on its job (goal/G43.15); the stand-in node takes the report and keeps nothing.
  job: { report: function () { return Promise.resolve({ ok: true }); } },
  // Its DEBUG flag, as spirit.js keeps one: read with no argument, set with a boolean.
  debug: (function () { let on = false; return function (v) { if (typeof v === 'boolean') on = v; return on; }; }()),
};
const realLoad = Module._load;
Module._load = function (request, parent) {
  if (/(^|[\\/])spirit\.js$/.test(request) && parent && String(parent.filename).indexOf(RUN) === 0) { globalThis.spirit = fake; return fake; }
  return realLoad.apply(this, arguments);
};
globalThis.spirit = fake;
if (process.platform === 'win32') PIPE = require(path.join(RUN, 'spirit', 'appClient.js')).pipePathFor(TMP, NAME, 'win32');
const childArgv = process.argv.slice();
process.argv = [process.argv[0], path.join(TMP, NAME + '.js'), '--pipe', PIPE];

let bootstrap = [];
let bootstraps = 0;
const GOAL = { id: 'goal/G9', goal: '', title: 'the goal', version: 1 };
const item = function (n, extra) { return Object.assign({ id: 'goal/G9.' + n, goal: 'goal/G9', title: 'item ' + n, version: 1 }, extra || {}); };
const row = function (f) { return { verb: 'goal.whole', goal: 9, item: f }; };
// The client's cache file for the publisher (goal/G41.28, box v19; Andy: "this way an appServer in client-mode can derive
// the name of it's ./relay-state/<appServerName>/<server-public-key-in-base64>.json"): in spirit/state/<client server>/cache/
// (goal/G43.20: "cache, which is written by spirit/appServer.js was ALWAYS supposed to go into spirit/state/<name>/cache/"),
// named by the sender's key in base64url (Andy, Q9 of Desk: "Shall the server key in spirit.data and in the cache file
// name be base64url (- for +, _ for /), since a plain base64 / splits both?" "yes"): no + and no /, and it reads back
// to the sender's key.
const SENDER = Buffer.from(PUBLISHER, 'base64');
const namesSender = function (n) { return /^[A-Za-z0-9_-]+=*$/.test(n) && Buffer.from(n, 'base64url').equals(SENDER); };
const cacheFile = function (name) {
  const dir = path.join(RUN, 'spirit', 'state', name, 'cache');
  let found = '';
  try { found = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f) && namesSender(f.slice(0, -5)); })[0] || ''; } catch (e) { found = ''; }
  return found ? path.join(dir, found) : path.join(dir, SENDER.toString('base64url') + '.json');
};

function start(streamOpts, publisherOpts) {
  const A = require(FILE);
  const s = A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, {
    stream: Object.assign({ module: 'spirit.app.desk', translator: TRANSLATOR }, streamOpts || {}),
    publisher: Object.assign({ family: NAME, bootstrap: function () { bootstraps += 1; return bootstrap.slice(); }, waitMs: 5000 }, publisherOpts || {}),
  });
  return { A: A, s: s, D: A.data };
}
// What the client's cache holds, asked of the desk's data.js, which alone names its branches (goal/G41.28; Andy:
// "the client manager should keep that cache"): spirit.data.desk.data, attached by appServer to the process's spirit.
const kept = function () { return (globalThis.spirit && ((globalThis.spirit.data || {}).desk || {}).data) || null; };
const itemOf = function (id) { const K = kept(); return K ? K.item(id) : null; };
const partOf = function (id) { const K = kept(); return K ? K.part(id) : null; };
const hasIn = function (D, n) { return !!itemOf('goal/G9.' + n); };

// ── a child: one process of a restart, or of a cache switch ────────────────────────────────────────────────────────
async function child(mode) {
  const out = {};
  const FAM = childArgv[6] || 'desk';
  if (mode === 'first') {
    // Cache on: the first run of a client, its push landed.
    const { s, D } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.one = hasIn(D, 1); out.two = hasIn(D, 2);
    // THE CACHE BY SERVER NODE (box v19: "The RAM-CACHE-is organized BY SERVER-NODE-ID at it's lowest level. IE:
    // spirit.data.<server-public-key-in-base64>.<api-family>...."): what the data set holds at its top, and under it.
    const kept = (D && D.allBranches()) || [];
    const top = kept.map(function (b) { return b.split('/')[0]; }).filter(function (n, i, all) { return all.indexOf(n) === i; });
    out.top = top;
    out.byNode = top.filter(namesSender);
    out.family = out.byNode.length === 1 ? kept.filter(function (b) { return b.split('/')[0] === out.byNode[0]; }).map(function (b) { return b.split('/')[1]; }).filter(function (f, i, all) { return all.indexOf(f) === i; }) : [];
  } else if (mode === 'restart') {
    // The same client again, a new process: the publisher in it a new run. Its cache read back before any subscribe.
    const { s, D } = start({ cache: true });
    await tick(300);
    out.readOne = hasIn(D, 1); out.readTwo = hasIn(D, 2);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, renamed', version: 2 }))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.title = itemOf('goal/G9.1') && itemOf('goal/G9.1').title;
    out.two = hasIn(D, 2);
  } else if (mode === 'off' || mode === 'nofamily') {
    // off: no cache switch; nofamily: the switch on, but the sender's family has no folder on this node.
    const { s } = start(mode === 'off' ? {} : { cache: true });
    await tick(100);
    bootstrap = [row(GOAL), row(item(1))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
  } else if (mode === 'every') {
    // The default limit: two goals, both kept, every row of each (box v15: "every goal, no filtering on the client side").
    const { A, s, D } = start({ cache: true });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish(row(item(i)));
    await tick(200);
    for (let i = 1; i <= 3; i++) A.publish({ verb: 'goal.whole', goal: 10, item: { id: 'goal/G10.' + i, goal: 'goal/G10', title: 'item ' + i, version: 1 } });
    await tick(800);
    out.g9 = []; out.g10 = [];
    for (let i = 1; i <= 3; i++) { if (itemOf('goal/G9.' + i)) out.g9.push(i); if (itemOf('goal/G10.' + i)) out.g10.push(i); }
  } else if (mode === 'items' || mode === 'chat') {
    // One goal (Andy, Q2: "when there is only one goal, then you shed the longest untouched item, LOCK, stock and
    // barrel, when there is only one goal with one item you shed the oldest chat line").
    const { A, s, D } = start({ cache: { limit: mode === 'items' ? 1500 : 2500 } });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    const long = function (n) { return 'a row long enough to fill a small cache quickly, number ' + n + ' '.repeat(140) + '.'; };
    const line = function (id, n) { return { table: 'chat', id: id, row: { at: '2026-10-28T05:00:' + String(n).padStart(2, '0') + '.000Z', by: 'andy', text: long(n) } }; };
    if (mode === 'items') {
      A.publish(row(item(1)));
      A.publish(line('goal/G9.1', 0));
      for (let i = 2; i <= 10; i++) { await tick(30); A.publish(row(item(i, { title: long(i) }))); }
    } else {
      A.publish(row(item(1)));
      for (let i = 1; i <= 30; i++) { await tick(10); A.publish(line('goal/G9.1', i)); }
    }
    await tick(1500);
    out.goal = !!itemOf('goal/G9');
    out.items = []; for (let i = 1; i <= 10; i++) if (itemOf('goal/G9.' + i)) out.items.push(i);
    const whole = partOf('goal/G9.1');
    out.chat = whole && Array.isArray(whole.chat) ? whole.chat.map(function (l) { return Number(String(l.at).slice(17, 19)); }) : [];
  } else if (mode === 'limit') {
    // Two goals, ten rows each: goal/G9 first and untouched since, goal/G10 after. Together past the limit, either alone
    // within it: the desk's family api.js (Andy, Q2: "THE LONGEST UNTOUCHED GOAL GOES, LOCK, STOCK AND BARREL").
    const { A, s, D } = start({ cache: { limit: 3500 } });
    await tick(100);
    bootstrap = [row(GOAL)];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(200);
    const long = function (n) { return 'a row long enough to fill a small cache quickly, number ' + n + ' '.repeat(140) + '.'; };
    for (let i = 1; i <= 10; i++) A.publish(row(item(i, { title: long(i) })));
    await tick(300);
    for (let i = 1; i <= 10; i++) A.publish({ verb: 'goal.whole', goal: 10, item: { id: 'goal/G10.' + i, goal: 'goal/G10', title: long(i), version: 1 } });
    await tick(1500);
    out.g9 = []; out.g10 = [];
    for (let i = 1; i <= 10; i++) { if (itemOf('goal/G9.' + i)) out.g9.push(i); if (itemOf('goal/G10.' + i)) out.g10.push(i); }
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n');
  process.exit(0);
}
function runChild(mode, name, fam) {
  const r = spawnSync(process.execPath, [SELF_FILE, '--child', mode, TMP, name, fam || 'desk'], { encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('RESULT ') === 0; })[0];
  try { return JSON.parse(line.slice(7)); } catch (e) { return { failed: short(r.stderr || r.stdout || r.error) }; }
}
function clearCache(name) { [path.join(RUN, 'spirit', 'state', name)].forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* none */ } }); }

// ── the tree: one family path, a folder per server (box v15, Family folders) ─────────────────────────────────────────────
function jsonFiles(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) jsonFiles(p, out);
    else if (/\.json$/.test(d.name)) out.push(p);
  });
  return out;
}
function codeFiles(dir, out) {
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (VENDORED_FOLDERS.holds(p) || d.name === '.git' || p === path.join(RUN, 'brains') || p === path.join(RUN, 'spirit', 'state')) return;
      codeFiles(p, out);
    } else if (/\.(js|html)$/.test(d.name)) out.push(p);
  });
  return out;
}


// THE SHARED GATE, EVERY PERMUTATION, IN MEMORY (goal/G41.30, the box: "Test the shared gate once, in full. appServer's
// one check guards every verb with a request shape. Every permutation is thrown at that check directly, in memory:
// thousands a second, no network."). The check is appServer's matches(request, args), which route() asks for every verb
// without a check of its own. Each request shape below is given, key by key, each of the box's kinds ("EVERY ARGUMENT gets
// tested with EVERY javascript object type ... PLUS: \"missing\" and \"extraneous\""): JSON.parse's six types, the key
// missing, an extraneous key beside it. Then every pair of keys in every pair of kinds ("Pairs, not every combination"),
// and every combination where a shape has 3 keys or fewer. The value of the shape's own types passes; every other is refused.
function gateSection() {
  const SHAPES = {
    'one string': { name: '' },
    'a string and a number': { id: '', n: 0 },
    'three of three types': { id: '', on: false, n: 0 },
    'four, an array among them': { id: '', tags: [''], on: false, n: 0 },
    'five, an object among them': { id: '', text: '', version: 0, on: false, opts: { a: '' } },
    'one nested two deep': { id: '', where: { path: '', depth: 0 } },
  };
  const KINDS = ['string', 'number', 'boolean', 'null', 'object', 'array', 'missing', 'extraneous'];
  // A JSON value of a kind, as it arrives over the wire (JSON.parse makes no date: a date is a string).
  function valueOf(kind) {
    return kind === 'string' ? 'garbage' : kind === 'number' ? 12345 : kind === 'boolean' ? true : kind === 'null' ? null
      : kind === 'object' ? { x: 1 } : kind === 'array' ? ['x'] : undefined;
  }
  // The kind a shape's own value is.
  function kindOf(v) { return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v; }
  // The shape's own value, which must pass: each key its own type ('' a string, 0 a number, [x] an array of x).
  function own(v) { return Array.isArray(v) ? [own(v[0])] : v && typeof v === 'object' ? Object.keys(v).reduce(function (o, k) { o[k] = own(v[k]); return o; }, {}) : v; }
  // The args with the keys in `set` given the kinds named; a kind the key already is, is not garbage.
  function made(shape, set) {
    const out = own(shape);
    Object.keys(set).forEach(function (k) {
      const kind = set[k];
      if (kind === 'missing') delete out[k];
      else if (kind === 'extraneous') out[k + 'Extra'] = 'garbage';
      else out[k] = valueOf(kind);
    });
    return out;
  }
  // An object of other keys is garbage for an object key: the gate wants exactly its keys.
  function garbage(shape, set) { return Object.keys(set).some(function (k) { return set[k] === 'missing' || set[k] === 'extraneous' || set[k] !== kindOf(shape[k]) || set[k] === 'object'; }); }
  let asks = 0;
  // One shape thrown at the gate: true, or what it got wrong.
  function judge(title) {
    const A = require(FILE);
    const shape = SHAPES[title];
    const keys = Object.keys(shape);
    const wrong = [];
    let n = 0;
    function ask(set) {
      n += 1;
      const passed = A.matches(shape, made(shape, set));
      const should = !garbage(shape, set);
      if (passed !== should) wrong.push((should ? 'refused ' : 'passed ') + JSON.stringify(set));
    }
    ask({});
    // Each key, each kind.
    keys.forEach(function (k) { KINDS.forEach(function (kind) { const s = {}; s[k] = kind; ask(s); }); });
    // Every pair of keys, every pair of kinds.
    keys.forEach(function (k1, i) { keys.slice(i + 1).forEach(function (k2) {
      KINDS.forEach(function (a) { KINDS.forEach(function (b) { const s = {}; s[k1] = a; s[k2] = b; ask(s); }); });
    }); });
    // Every combination, where a shape has 3 keys or fewer.
    if (keys.length <= 3) {
      (function every(i, s) {
        if (i === keys.length) { ask(Object.assign({}, s)); return; }
        KINDS.forEach(function (kind) { s[keys[i]] = kind; every(i + 1, s); });
        delete s[keys[i]];
      }(0, {}));
    }
    // A nested shape's inner keys, each kind.
    keys.filter(function (k) { return kindOf(shape[k]) === 'object'; }).forEach(function (k) {
      Object.keys(shape[k]).forEach(function (inner) { KINDS.forEach(function (kind) {
        n += 1;
        const args = own(shape);
        if (kind === 'missing') delete args[k][inner];
        else if (kind === 'extraneous') args[k][inner + 'Extra'] = 'garbage';
        else args[k][inner] = valueOf(kind);
        const should = kind !== 'missing' && kind !== 'extraneous' && kind === kindOf(shape[k][inner]);
        if (A.matches(shape, args) !== should) wrong.push((should ? 'refused ' : 'passed ') + k + '.' + inner + ' ' + kind);
      }); });
    });
    asks += n;
    return !wrong.length || title + ': ' + wrong.length + ' of ' + n + ' wrong, first: ' + short(wrong.slice(0, 4));
  }
  test.run('a request of one string (name): its own value passes and every garbage one is refused', 0.2, function () { return judge('one string'); }, test.limit.quick);
  test.run('a request of a string and a number (id, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('a string and a number'); }, test.limit.quick);
  test.run('a request of three of three types (id, on, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('three of three types'); }, test.limit.quick);
  test.run('a request of four, an array among them (id, tags, on, n): its own value passes and every garbage one is refused', 0.2, function () { return judge('four, an array among them'); }, test.limit.quick);
  test.run('a request of five, an object among them (id, text, version, on, opts): its own value passes and every garbage one is refused', 0.2, function () { return judge('five, an object among them'); }, test.limit.quick);
  test.run('a request of one nested two deep (id, where): its own value passes and every garbage one is refused', 0.2, function () { return judge('one nested two deep'); }, test.limit.quick);
  test.run('every permutation of the box\'s kinds was thrown at it, more than a thousand asks', 0.2, function () {
    test.comment('the shared gate was asked ' + asks + ' times, in memory');
    return asks > 1000 || 'only ' + asks + ' asks were made';
  }, test.limit.quick);
  // A VERB WITH A CHECK OF ITS OWN SKIPS THE GATE (appServer.js route: its own accepts() if it has one, else matches):
  // its own check is the only one, so the gate's test does not cover it; the deep garbage goes to those verbs.
  const G = { seen: [], r: null };
  test.run('a verb with an accepts() of its own is asked that alone: garbage it lets through reaches its handler', 0.2, async function () {
    const A = require(FILE);
    const s = A.createAppServer({
      own: { request: { id: '' }, reply: {}, accepts: function (a) { G.seen.push(a); return true; }, handler: function () { return {}; } },
      shared: { request: { id: '' }, reply: {}, handler: function () { return {}; } },
    });
    G.r = await Promise.all([s.route({ own: { garbage: 12345 } }), s.route({ shared: { garbage: 12345 } })]);
    return (G.seen.length === 1 && G.r[0].status === 200) || 'own check asked ' + G.seen.length + ', status ' + G.r[0].status;
  }, test.limit.quick);
  test.run('a verb with no check of its own is refused that garbage by the gate', 0.2, function () {
    if (!G.r) return 'no answers to judge: the test before failed';
    return (!!G.r[1].body && G.r[1].body.code === 'no-such-argument') || 'shared: ' + short(G.r[1]);
  }, test.limit.quick);
}

// The parts ran each in a process of its own before they were folded in: the stand-in spirit.js, the module loader and
// the argv this file set up for its own server are put back, so they find the real spirit object as they did. Done once,
// at the first test of the parts that needs it (the stream checks before them run on the stand-in).
let realPutBack = false;
function putBackTheRealSpirit() {
  if (realPutBack) return;
  realPutBack = true;
  Module._load = realLoad;
  globalThis.spirit = require(path.join(RUN, 'spirit', 'spirit.js'));
  process.argv = childArgv;
}

// THE AGENTSFILE PART, once appServer-agentsFile.js.
function agentsFilePart() {
  // Once spirit/run/spirit/test/appServer-agentsFile.js.
  // THE AGENT'S AGENTS.md THROUGH spirit.fs.loadFile AT ITS PATH (goal/G43.27, requirement 8; spec: ./appServer.md),
  // not through the family's FS: appServer.js's AGENTS paragraph. Andy: "easily changed, no?". appServer.js read as it is.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..');

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  // Line ends aside: a Windows checkout (autocrlf) holds CRLF where git holds LF.
  function read(rel) { const f = path.join(RUN, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : ''; }

  // appServer-agentsFile: the agent's AGENTS.md through spirit.fs.loadFile at its path (goal/G43.27), 8.
  let block = '';
  test.run('the world: appServer.js\'s AGENTS paragraph is read', 0.2, function () {
    putBackTheRealSpirit();
    const as = read('spirit/appServer.js');
    block = (as.match(/AGENTS: AN APP'S RULES FOR AGENTS[\s\S]*?\n\n/) || [''])[0];
    return block.length > 100 || 'no AGENTS paragraph in appServer.js: nothing judged';
  }, test.limit.quick);
  test.run('it says AGENTS.md is read with spirit.fs.loadFile at its path', 0.2, function () {
    return (/spirit\.fs\.loadFile/.test(block) && !/family's FS|FS\.loadFile \{path: "AGENTS\.md"\}/.test(block)) || 'it still says: ' + short((block.match(/.*FS.*/g) || []).join(' / '));
  }, test.limit.quick);
}

// The mount part, the node starting a server from spirit/app/<name>/, is job.js's: ./job.js (goal/G47.1).

// THE STATECACHE PART, once appServer-stateCache.js.
function stateCachePart() {
  // Once spirit/run/spirit/test/appServer-stateCache.js.
  // The tests of spirit/appServer.js by name: ITS CACHE IN spirit/state/<name>/cache/ (goal/G43.20, its box; spec:
  // ./appServer.md). Andy: "cache, which is written by spirit/appServer.js was ALWAYS supposed to go into
  // spirit/state/<name>/cache/", and "NO FUCKING RESCUE CODE, MOVE YOUR OWN deskClient cache where it belongs." A throwaway
  // follower app, planted in a scratch copy of the tracked files, is run as the node runs a server: what it kept is read back
  // at its start, and its saveCaches (deskClient's cache.dump) writes it again. Never a live node.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, spawnSync, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  let until, sleep;

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  const NAME = 'follower';
  // A sender whose family has a data.js on the node: desk's (spirit/app/desk/data.js), so what is kept of it comes back.
  const SENDER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';
  const FAMILY = 'desk';

  // appServer-stateCache: appServer reads and writes its cache in spirit/state/<name>/cache/, and nowhere else (goal/G43.20)
  let root = '', run = '', id = '', state = '', cache = '';
  const kids = [];
  test.after(async function () {
    kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
    await new Promise(function (r) { setTimeout(r, 300); });
    if (root) { try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  });
  // One start of the follower over a kept file planted at where: what came back, and what it saved.
  const startWith = async function (where) {
    fs.rmSync(state, { recursive: true, force: true });
    fs.mkdirSync(where, { recursive: true });
    fs.writeFileSync(path.join(where, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: where }] }));
    const seen = path.join(root, 'seen-' + kids.length + '.json');
    const saved = path.join(root, 'saved-' + kids.length + '.json');
    const pipe = require(path.join(run, 'spirit', 'appClient.js')).pipePathFor(root, NAME, process.platform, 'app');
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
    kids.push(kid);
    await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
    await sleep(200);
    try { kid.kill(); } catch (e) { /* gone */ }
    return { seen: readJson(seen), saved: readJson(saved) };
  };
  const noTree = function () { return !id ? 'no scratch tree: the world failed' : ''; };
  test.run('the world: the sender\'s file name is its node id', 0.2, function () {
    putBackTheRealSpirit();
    ({ until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')));
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-state-cache-'));
    execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
      .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    run = path.join(root, 'spirit', 'run');
    const app = path.join(run, 'spirit', 'app', NAME);
    fs.mkdirSync(app, { recursive: true });
    // The follower: a server of spirit/app/ following a stream with its cache on. Its translator says by a file what came
    // back; once read back, it saves its caches (saveCaches) and says which files it wrote.
    fs.writeFileSync(path.join(app, 'rows.js'), [
      "const D = require('../../data.js');",
      "D.addTranslator({ onJob: function (job) { if (job && job.app) require('fs').writeFileSync(process.env.ROW_SEEN, JSON.stringify(job.app)); } });",
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(app, NAME + '.js'), [
      "require('../../spirit.js');",
      "const path = require('path');",
      "const S = require('../../appServer.js');",
      "S.serve({}, { stream: { translator: path.join(__dirname, 'rows.js'), cache: true, module: 'a.test' } });",
      "setTimeout(function () { require('fs').writeFileSync(process.env.SAVED, JSON.stringify(S.saveCaches())); }, 1500);",
    ].join('\n') + '\n');
    const nodeId = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./spirit/data.js').nodeId(" + JSON.stringify(SENDER) + "))"], { cwd: run, encoding: 'utf8' }).stdout;
    state = path.join(run, 'spirit', 'state', NAME);
    cache = path.join(state, 'cache');
    if (nodeId.length > 10) id = nodeId;
    return nodeId.length > 10 || 'no node id for the sender, its file name ' + short(nodeId) + ': nothing judged';
  }, test.limit.quick);

  // "cache ... was ALWAYS supposed to go into spirit/state/<name>/cache/": read back from there
  let inCache = null;
  test.run('what it kept in spirit/state/follower/cache/ comes back at its start', 0.2, async function () {
    if (noTree()) return noTree();
    inCache = await startWith(cache);
    return (!!inCache.seen && inCache.seen.kept === cache) || 'came back: ' + short(inCache.seen);
  }, test.limit.slow);
  test.run('and its cache.dump writes it there again, spirit/state/follower/cache/<id>.json', 0.2, function () {
    if (!inCache) return 'the follower did not start: the test before failed';
    const wrote = Array.isArray(inCache.saved) ? inCache.saved.map(function (f) { return f.file; }) : [];
    return (wrote.indexOf(id + '.json') !== -1 && fs.existsSync(path.join(cache, id + '.json'))) || 'saved: ' + short(inCache.saved);
  }, test.limit.quick);
  test.run('no cache file is written in spirit/state/follower/ itself', 0.2, function () {
    if (noTree()) return noTree();
    const top = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return /\.json$/.test(f) && f !== 'node.json'; }) : [];
    return !top.length || 'written there: ' + short(top);
  }, test.limit.quick);


  // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
  // startWith plants a good file; each case below then spoils cache/ before the follower starts again.
  const spoiled = async function (spoil) {
    fs.rmSync(state, { recursive: true, force: true });
    fs.mkdirSync(cache, { recursive: true });
    spoil();
    const seen = path.join(root, 'seen-x' + kids.length + '.json');
    const saved = path.join(root, 'saved-x' + kids.length + '.json');
    const pipe = require(path.join(run, 'spirit', 'appClient.js')).pipePathFor(root, NAME, process.platform, 'app');
    if (process.platform !== 'win32') fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, NAME + '.js'), '--pipe', pipe], { cwd: run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen, SAVED: saved }) });
    kids.push(kid);
    const up = await until(function () { return Promise.resolve(fs.existsSync(saved)); }, 8000);
    await sleep(200);
    try { kid.kill(); } catch (e) { /* gone */ }
    return { up: !!up, seen: readJson(seen), saved: readJson(saved) };
  };
  const OTHER = 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ=';
  // the attacker: a file named for one sender, holding another's key
  test.run('it is not read: a file is read only under its own sender\'s name', 0.8, async function () {
    if (noTree()) return noTree();
    const swapped = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: OTHER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'swapped' }] })); });
    return (swapped.up && !swapped.seen) || 'came back: ' + short(swapped.seen);
  }, test.limit.slow);
  // the attacker: only a half-written .tmp, as a kill leaves it
  test.run('a .tmp is never read back', 0.2, async function () {
    if (noTree()) return noTree();
    const half = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json.tmp'), JSON.stringify({ key: SENDER, family: FAMILY, run: 'r', n: 1, rows: [{ kept: 'half' }] })); });
    return (half.up && !half.seen) || 'came back: ' + short(half.seen);
  }, test.limit.slow);
  // the attacker: a cache file that is no JSON, and one that is JSON of the wrong shape
  test.run('a broken file: the server still starts, reads nothing back, and saves', 0.2, async function () {
    if (noTree()) return noTree();
    const broken = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), '{"key": "' + SENDER + '", "rows": [ {"kept": '); });
    return (broken.up && !broken.seen && Array.isArray(broken.saved)) || 'up ' + broken.up + ', seen ' + short(broken.seen) + ', saved ' + short(broken.saved);
  }, test.limit.slow);
  test.run('rows that are no list: nothing read back, and the server saves on', 0.2, async function () {
    if (noTree()) return noTree();
    const shape = await spoiled(function () { fs.writeFileSync(path.join(cache, id + '.json'), JSON.stringify({ key: SENDER, family: FAMILY, run: 7, n: -3, rows: 'not a list' })); });
    return (shape.up && !shape.seen && Array.isArray(shape.saved)) || 'up ' + shape.up + ', seen ' + short(shape.seen);
  }, test.limit.slow);
  test.run('and after all of it spirit/state/follower/ holds nothing beside cache/ (and its socket)', 0.2, function () {
    if (noTree()) return noTree();
    const strays = fs.existsSync(state) ? fs.readdirSync(state).filter(function (f) { return ['cache', 'data', 'node.json', 'door.sock'].indexOf(f) === -1; }) : [];
    return !strays.length || 'also there: ' + short(strays);
  }, test.limit.quick);
}

// ── its own checks: one stream protocol for every server (goal/G41.11, goal/G41.12) ─────────────────────────────────────
function ownPart() {
  // the family path: one function, in appServer (box v15)
  test.run('appServer exports familyPath', 0.2, function () {
    const A0 = require(FILE);
    return typeof A0.familyPath === 'function' || 'appServer has no familyPath export: ' + typeof A0.familyPath;
  }, test.limit.quick);
  test.run('familyPath(name) of an app is spirit/app/<name>/api.js (goal/G43.20)', 0.2, function () {
    const A0 = require(FILE);
    const fp = typeof A0.familyPath === 'function' ? A0.familyPath('testicle') : null;
    return fp === 'spirit/app/testicle/api.js' || 'familyPath(\'testicle\') is ' + short(fp);
  }, test.limit.quick);
  // Apps of spirit/app/ since goal/G43.27 (Andy: "cw, you bring deskClient and ... into spirit/app/ under their old
  // names, do the backup as well"): the family's interface at the top of the app folder, no family/ left.
  const moved = function (n) {
    const app = path.join(RUN, 'spirit', 'app', n);
    return (fs.existsSync(path.join(app, 'api.js')) && !fs.existsSync(path.join(app, 'family'))) || n + ': api.js ' + fs.existsSync(path.join(app, 'api.js')) + ', family/ ' + fs.existsSync(path.join(app, 'family'));
  };
  test.run('backup: its interface is spirit/app/backup/api.js, no family/ is left', 0.2, function () { return moved('backup'); }, test.limit.quick);
  test.run('deskClient: its interface is spirit/app/deskClient/api.js, no family/ is left', 0.2, function () { return moved('deskClient'); }, test.limit.quick);
  // Andy, goal/G41.28: "all, KILL deskAgent!". The server goes, its folder and every file that names it.
  test.run('and no file names the deskAgent server', 0.2, function () {
    const namers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && /['"]deskAgent\/|deskAgent\.js\b/.test(fs.readFileSync(f, 'utf8')); }).map(function (f) { return path.relative(RUN, f); });
    return namers.length === 0 || namers.length + ' files still name it: ' + namers.join(', ');
  }, test.limit.quick);
  // No file but appServer writes a family path: no <name>.family, no family/api.js, no join onto 'family'. This file
  // routes by the pattern and is left out; so are appServer.js and spirit.js: the browser cannot load appServer, so
  // spirit.js holds the function and appServer hands out the same one (cw, goal/G41.12 Q3).
  // A join onto 'family' is a path; a bare 'family' is no path since goal/G41.14, where it names a column and a field
  // (Andy: "these four following NAMES will be used in SpiritOS: bundle > branch > family > verb").
  const FAMILY_PATH_WRITTEN = [/\.family(?=['"`\/\\]|$)/m, /(^|[^\\])\/?family\/api\.js/, /join\([^)]*['"`]family['"`]\s*[),]/];
  test.run('no file outside appServer\'s familyPath writes a family path', 0.2, function () {
    const SPIRIT_JS = path.join(RUN, 'spirit', 'spirit.js');
    const writers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && f !== SPIRIT_JS; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return FAMILY_PATH_WRITTEN.some(function (re) { return re.test(t); });
    }).map(function (f) { return path.relative(RUN, f); });
    return writers.length === 0 || writers.length + ' files write one: ' + writers.join(', ');
  }, test.limit.quick);

  // goal/G41.24: DEPENDENCIES is gone
  // Andy, box: "DEPENDENCIES will be killed, eradicated, from all code where it appears, and from the desk folder
  // itself." No code file names the verb or hands serve() a dependencies list; this file names it to look for it.
  test.run('no code file, and nothing in the desk folder, names DEPENDENCIES or hands serve() a dependencies list', 0.2, function () {
    const named = codeFiles(RUN, []).concat(jsonFiles(path.join(RUN, 'spirit', 'app', 'desk'), [])).filter(function (f) { return f !== SELF_FILE; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return /DEPENDENCIES/.test(t) || /\bdependencies\s*:/.test(t) || /opts\.dependencies|withDependencies|checkDependencies/.test(t);
    }).map(function (f) { return path.relative(RUN, f); });
    return named.length === 0 || named.length + ' still do: ' + named.join(', ');
  }, test.limit.quick);

  // goal/G43.20: no <name>Bundles.json is left
  // The box: "spirit/app/desk/deskBundles.json, deskClient/deskClientBundles.json and ... are
  // deleted. Bundles stay what they are, rows in node.db, made and changed through auth.bundle."
  test.run('no app folder holds a <name>Bundles.json', 0.2, function () {
    const bundleFiles = jsonFiles(path.join(RUN, 'spirit', 'app'), []).filter(function (f) { return /Bundles\.json$/.test(f); }).map(function (f) { return path.relative(RUN, f); });
    return bundleFiles.length === 0 || 'still there: ' + bundleFiles.join(', ');
  }, test.limit.quick);

  // what goes (box v15)
  test.run('the desk has no bundled() of its own', 0.2, function () {
    const deskJs = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'desk', 'nodeDesk.js'), 'utf8');
    return !/function\s+bundled\s*\(/.test(deskJs) || 'desk.js still defines bundled()';
  }, test.limit.quick);
  test.run('deskClient keeps no cache.json of its own', 0.2, function () {
    const clientJs = fs.readFileSync(path.join(RUN, 'spirit', 'app', 'deskClient', 'deskClient.js'), 'utf8');
    return !/cache\.json/.test(clientJs) || 'deskClient.js still names cache.json';
  }, test.limit.quick);

  // ── one process: a client following its own publisher ──────────────────────────────────────────────────────────
  // goal/G41.24: the desk's translator is its family's data.js; the stream checks below follow it.
  const O = { A: null, s: null, D: null };
  const has = function (n) { return hasIn(O.D, n); };
  const noServer = function () { return !O.D || !O.s || typeof O.s.subscribe !== 'function' ? 'no server with its client half: the world failed' : ''; };
  test.run('the world: the desk\'s translator, spirit/app/desk/data.js, is there', 0.2, function () {
    return fs.existsSync(TRANSLATOR) || 'the desk\'s translator, spirit/app/desk/data.js, is not there: the stream checks wait on it';
  }, test.limit.quick);
  test.run('it serves, keeps a data set and has its client half (subscribe)', 0.2, async function () {
    const { A, s, D } = start({}, { logMax: 5 });
    O.A = A; O.s = s; O.D = D;
    await tick(100);
    return (!!D && typeof D.getPath === 'function' && !!s && typeof s.subscribe === 'function') || 'data ' + typeof (D && D.getPath) + ', subscribe ' + typeof (s && s.subscribe);
  }, test.limit.quick);

  // the first subscribe: a full push
  test.run('a subscribe follows the publisher\'s key and asks its family to subscribe it', 0.2, async function () {
    if (noServer()) return noServer();
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    const first = await O.s.subscribe(PUBLISHER, NAME);
    await tick(300);
    return (first === true && asked.some(function (a) { return a.verb === 'subscribe' && a.key === PUBLISHER; }) && asked.some(function (a) { return a.verb === 'auth.grant'; }))
      || 'answered ' + short(first) + ', asked ' + short(asked);
  }, test.limit.quick);
  test.run('the bootstrap lands in the cache: both items', 0.2, function () {
    if (noServer()) return noServer();
    return (has(1) && has(2)) || short({ one: itemOf('goal/G9.1'), two: itemOf('goal/G9.2') });
  }, test.limit.quick);
  test.run('every delivery is a bundle: one JSON array of rows in one peerPost', 0.2, function () {
    return (posts.length > 0 && posts.every(Array.isArray)) || 'deliveries: ' + short(posts);
  }, test.limit.quick);

  // rows that back up go as bundles (box v15)
  let before = 0;
  test.run('twenty rows published, twenty landed', 0.2, async function () {
    if (noServer()) return noServer();
    before = posts.length;
    gate.held = true;
    O.A.publish(row(item(10)));
    await tick(50);
    for (let i = 11; i < 30; i++) O.A.publish(row(item(i)));
    await tick(300);
    release();
    await tick(800);
    const landed = []; for (let i = 10; i < 30; i++) if (has(i)) landed.push(i);
    return landed.length === 20 || 'landed: ' + short(landed);
  }, test.limit.slow);
  test.run('nineteen rows backed up behind a held one went in a bundle, not one peerPost each', 0.2, function () {
    if (noServer()) return noServer();
    return posts.length - before <= 3 || (posts.length - before) + ' peerPosts for 20 rows';
  }, test.limit.quick);

  // the position: a subscribe again is handed what came after it, no push (box v15)
  let again = null;
  test.run('dropped by a refused delivery, it subscribes again and is handed the rows it missed', 0.2, async function () {
    if (noServer()) return noServer();
    before = bootstraps;
    gate.refuse = true;
    O.A.publish(row(item(30)));
    await tick(300);
    gate.refuse = false;
    O.A.publish(row(item(31)));
    O.A.publish(row(item(32)));
    O.A.publish(Object.assign(row(item(33)), { to: ['KEY-SOMEONE-ELSE'] }));
    await tick(100);
    // The new bootstrap holds no item 2: a full push would sweep it.
    bootstrap = [row(GOAL), row(item(1))];
    again = await O.s.subscribe(PUBLISHER, NAME);
    await tick(500);
    return (again === true && has(30) && has(31) && has(32)) || 'answered ' + short(again) + ', items 30-32: ' + [has(30), has(31), has(32)].join(' ');
  }, test.limit.slow);
  test.run('a row addressed to another key is left out of what it is handed', 0.2, function () {
    if (noServer()) return noServer();
    return (again === true && has(32) && !has(33)) || 'item 33, addressed to another key: ' + has(33);
  }, test.limit.quick);
  test.run('the sender\'s log answers it: no bootstrap, and the cache is not replaced', 0.2, function () {
    if (noServer()) return noServer();
    return (bootstraps === before && has(2)) || 'bootstraps ' + before + ' -> ' + bootstraps + ', item 2 kept: ' + has(2);
  }, test.limit.quick);
  test.run('the subscribe again carries the position the client holds', 0.2, function () {
    const subArgs = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; });
    const last = subArgs[subArgs.length - 1] || {};
    return (subArgs.length >= 2 && JSON.stringify(last) !== JSON.stringify(subArgs[0])) || 'subscribes: ' + short(subArgs);
  }, test.limit.quick);

  // goal/G41.15, Andy: "make sure the deskClient doesn't loose cached info outside the current goal", Q1: "nothing
  // drops from the cache, unless the api.js from the server says so", and the box: "a goal pushed whole takes
  // precedence, and the client's place in the stream moves to that push".
  // older than the bounded log: a full push takes precedence and drops nothing (goal/G41.15)
  test.run('nine rows missed past a log of five: the sender pushes in full', 0.2, async function () {
    if (noServer()) return noServer();
    before = bootstraps;
    gate.refuse = true;
    O.A.publish(row(item(40)));
    await tick(300);
    gate.refuse = false;
    for (let i = 41; i < 50; i++) O.A.publish(row(item(i)));
    await tick(100);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, pushed' }))];
    await O.s.subscribe(PUBLISHER, NAME);
    await tick(600);
    return bootstraps === before + 1 || 'bootstraps ' + before + ' -> ' + bootstraps;
  }, test.limit.slow);
  test.run('the push takes precedence: a row it carries replaces the one kept', 0.2, function () {
    if (noServer()) return noServer();
    const one1 = itemOf('goal/G9.1');
    return (!!one1 && one1.title === 'item 1, pushed') || 'item 1: ' + short(one1);
  }, test.limit.quick);
  test.run('and drops nothing it does not carry: items the push leaves out stay kept', 0.2, function () {
    if (noServer()) return noServer();
    return (has(2) && has(30)) || 'item 2 ' + has(2) + ', item 30 ' + has(30);
  }, test.limit.quick);
  test.run('a row never delivered is not invented by the push', 0.2, function () {
    if (noServer()) return noServer();
    return !has(45) || 'item 45 ' + has(45);
  }, test.limit.quick);
  // The read-pointer: the push landed, so the client stands at the push's number; a subscribe again is answered from
  // the log, with no second push and nothing from before it.
  test.run('its place in the stream moved to the push: subscribed again, it is handed nothing older and pushed nothing again', 0.2, async function () {
    if (noServer()) return noServer();
    const pushedAt = bootstraps;
    const subsBefore = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    await O.s.subscribe(PUBLISHER, NAME);
    await tick(400);
    const lastSub = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; }).pop() || {};
    // The push's own end, as the sender sent it: { run, n, full, end }.
    const ends = [].concat.apply([], posts.filter(Array.isArray)).filter(function (e) { return e && e.full === true && e.end === true; });
    const pushEnd = ends[ends.length - 1] || {};
    return (asked.filter(function (a) { return a.verb === 'subscribe'; }).length === subsBefore + 1 && bootstraps === pushedAt && lastSub.since === pushEnd.n && lastSub.run === pushEnd.run)
      || 'bootstraps ' + pushedAt + ' -> ' + bootstraps + ', subscribed with ' + short(lastSub) + ', the push ended at ' + short(pushEnd);
  }, test.limit.quick);

  // goal/G41.22, Andy: "take the 3 seconds out, appServer.js calls peerPost in the most basic way": a subscriber that
  // answers late, within the publisher's own wait, is no subscriber gone (traced 2026-10-30: the node's one sending slot
  // held deliveries 4 to 7 s, and a 3 s race dropped a live client every time).
  // a late answer is no drop: a delivery is a plain peerPost (goal/G41.22)
  const L = { subs: 0, boots: 0, posts: 0 };
  test.run('held 4 s, past the old 3 s, the rows still land: none is dropped', 0.2, async function () {
    if (noServer()) return noServer();
    L.subs = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    L.boots = bootstraps;
    L.posts = posts.length;
    gate.held = true;
    O.A.publish(row(item(60)));
    await tick(50);
    O.A.publish(row(item(61)));
    O.A.publish(row(item(62)));
    await tick(4000);
    release();
    await tick(400);
    return (has(60) && has(61) && has(62)) || 'items 60-62: ' + [has(60), has(61), has(62)].join(' ');
  }, test.limit.slow);
  test.run('what piled up while the first was out goes in one bundle after it', 0.2, function () {
    if (noServer()) return noServer();
    const sentLate = posts.slice(L.posts).filter(Array.isArray);
    return (sentLate.length === 2 && sentLate[1].length === 2) || 'bundles after the hold: ' + short(sentLate.map(function (b) { return b.length; }));
  }, test.limit.quick);
  test.run('the subscriber was never dropped: the next row comes with no subscribe again and no push', 0.2, async function () {
    if (noServer()) return noServer();
    O.A.publish(row(item(63)));
    await tick(300);
    const subs = asked.filter(function (a) { return a.verb === 'subscribe'; }).length;
    return (has(63) && bootstraps === L.boots && subs === L.subs)
      || 'item 63 ' + has(63) + ', subscribes ' + L.subs + ' -> ' + subs + ', bootstraps ' + L.boots + ' -> ' + bootstraps;
  }, test.limit.quick);
  test.run('appServer.js races no delivery and no subscribe against a clock of its own', 0.2, function () {
    return !/FAST_MS|Promise\.race/.test(fs.readFileSync(FILE, 'utf8')) || 'appServer.js still names FAST_MS or Promise.race';
  }, test.limit.quick);

  // ── restarts and the cache switch: each a process of its own ───────────────────────────────────────────────────
  // the cache, per sender, saved and read back (box v15)
  const C = {};
  test.run('a client with the cache switch on takes the push', 0.2, function () {
    clearCache('cacheProbe');
    C.one = runChild('first', 'cacheProbe');
    return (C.one.subscribed === true && !!C.one.one && !!C.one.two) || short(C.one);
  }, test.limit.quick);
  test.run('it saves the cache as spirit/state/<client>/<sender key>.json (goal/G41.28, box v19)', 0.2, function () {
    const file = cacheFile('cacheProbe');
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = ''; }
    return text.indexOf('item 2') !== -1 || path.relative(RUN, file) + ': ' + (text ? short(text) : 'no file');
  }, test.limit.quick);
  test.run('its spirit.data holds the cache under the sender\'s key, and nothing beside it at the top (box v19)', 0.2, function () {
    const one = C.one || {};
    return (!!one.byNode && one.byNode.length === 1 && !!one.top && one.top.length === 1) || 'at the top of spirit.data: ' + short(one.top);
  }, test.limit.quick);
  test.run('and under the sender\'s key, the family: <key>.desk', 0.2, function () {
    const one = C.one || {};
    return (Array.isArray(one.family) && one.family.indexOf('desk') !== -1) || 'under the key: ' + short(one.family);
  }, test.limit.quick);
  test.run('started again, it reads its cache back before it subscribes', 0.2, function () {
    C.two = runChild('restart', 'cacheProbe');
    return (!!C.two.readOne && !!C.two.readTwo) || short(C.two);
  }, test.limit.slow);
  test.run('a sender of a new run pushes in full: its rows take precedence, and a kept row it does not carry stays (goal/G41.15)', 0.2, function () {
    const two = C.two || {};
    return (two.subscribed === true && two.title === 'item 1, renamed' && !!two.two) || short(two);
  }, test.limit.quick);
  test.run('without the switch no cache file is kept', 0.2, function () {
    clearCache('cacheOff');
    runChild('off', 'cacheOff');
    return !fs.existsSync(cacheFile('cacheOff')) || 'cache file found: ' + path.relative(RUN, cacheFile('cacheOff'));
  }, test.limit.quick);
  test.run('a sender whose family has no folder on this node is not cached', 0.2, function () {
    clearCache('cacheNoFam');
    runChild('nofamily', 'cacheNoFam', 'noSuchServer');
    return !fs.existsSync(cacheFile('cacheNoFam')) || 'cache file found: ' + path.relative(RUN, cacheFile('cacheNoFam'));
  }, test.limit.quick);
  test.run('within the limit the cache keeps every goal the sender sends, no filtering on the client side', 0.2, function () {
    clearCache('cacheEvery');
    const every = runChild('every', 'cacheEvery');
    return (Array.isArray(every.g9) && every.g9.length === 3 && Array.isArray(every.g10) && every.g10.length === 3) || short(every);
  }, test.limit.slow);
  test.run('the cache keeps to the limit the client sets', 0.2, function () {
    clearCache('cacheLimit');
    C.full = runChild('limit', 'cacheLimit');
    let size = -1;
    try { size = fs.statSync(cacheFile('cacheLimit')).size; } catch (e) { size = -1; }
    return (size > 0 && size <= 3500) || 'cache file of ' + size + ' bytes for a limit of 3500';
  }, test.limit.slow);
  test.run('past the limit the goal untouched longest goes whole, the other is kept whole (Andy, Q2)', 0.2, function () {
    const full = C.full || {};
    return (Array.isArray(full.g9) && full.g9.length === 0 && Array.isArray(full.g10) && full.g10.length === 10) || short(full);
  }, test.limit.quick);
  // One goal: the item untouched longest goes, its chat with it; the newest stay (Andy, Q2).
  test.run('one goal past the limit: the items untouched longest go whole, the newest stay, the goal stays', 0.2, function () {
    clearCache('cacheItems');
    C.items = runChild('items', 'cacheItems');
    const kept = Array.isArray(C.items.items) ? C.items.items : [];
    const prefixGone = kept.length > 0 && kept.length < 10 && kept.every(function (n, i) { return n === 10 - kept.length + 1 + i; });
    return (!!C.items.goal && prefixGone) || short(C.items);
  }, test.limit.slow);
  test.run('an item shed goes lock, stock and barrel: its chat with it', 0.2, function () {
    const items = C.items || {};
    const kept = Array.isArray(items.items) ? items.items : [];
    return (kept.indexOf(1) === -1 && Array.isArray(items.chat) && items.chat.length === 0) || short(items);
  }, test.limit.quick);
  test.run('one goal with one item past the limit: the oldest chat lines go, the item and the newest lines stay', 0.2, function () {
    clearCache('cacheChat');
    const chat = runChild('chat', 'cacheChat');
    const lines = Array.isArray(chat.chat) ? chat.chat : [];
    const newest = lines.length > 0 && lines.length < 30 && lines.every(function (n, i) { return n === 30 - lines.length + 1 + i; });
    return (!!chat.goal && Array.isArray(chat.items) && chat.items.length === 1 && newest) || short(chat);
  }, test.limit.slow);
}

if (CHILD) {
  child(CHILD).catch(function (e) { process.stdout.write('RESULT ' + JSON.stringify({ failed: String(e && e.stack || e) }) + '\n'); process.exit(1); });
} else {
  // appServer.js: one stream protocol for every server (goal/G41.11, goal/G41.12). Its own checks first, then the parts.
  test.after(function () {
    ['cacheProbe', 'cacheOff', 'cacheNoFam', 'cacheEvery', 'cacheLimit', 'cacheItems', 'cacheChat'].forEach(clearCache);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a temp folder left is no failure */ }
  });
  gateSection();
  ownPart();
  agentsFilePart();
  stateCachePart();
}
