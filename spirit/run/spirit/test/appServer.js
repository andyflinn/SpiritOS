'use strict';

// spirit/run/spirit/test/appServer.js
// The tests of spirit/appServer.js, and of no other module (spec: ./appServer.md; goal/G41.11, goal/G41.12). The real
// appServer serves one server on a pipe of its own in a temp folder, publishing a stream and following it: its client
// half subscribes to its own publisher half, and the publisher hands its rows back over the same pipe, to its own
// streamListener. The one spirit object is a stand-in, so nothing reaches a real node: the families answer by posting to
// that pipe, and a delivery can be held back, or refused, until the test says otherwise. A restart is a second process:
// this file run with --child <mode>, printing one RESULT line.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '../..');
const FILE = path.join(__dirname, '..', 'appServer.js');
const SELF_FILE = __filename;
const TRANSLATOR = path.join(RUN, 'shell', 'shared', 'js', 'deskData.js');
const CHILD = process.argv[2] === '--child' ? String(process.argv[3] || '') : '';
const test = CHILD ? null : require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 20); }); };

// The publisher's key, base64 as a node key is; the cache file names it in hex (box v15: cache-<sender key in hex>.json).
const PUBLISHER = Buffer.from('KEY-DESK').toString('base64');
const PUBLISHER_HEX = Buffer.from(PUBLISHER, 'base64').toString('hex');
const SELF = 'KEY-CLIENT';
// The eight server families (box v15, Family folders).
const FAMILIES = ['agent', 'backup', 'chatClerver', 'desk', 'deskAgent', 'deskClient', 'deskVerify', 'fileServer'];

const TMP = CHILD ? String(process.argv[4]) : fs.mkdtempSync(path.join(os.tmpdir(), 'appServer-test-'));
// A server name of the test's own, so its cache folder (relay-state/process/<name>/) is no real server's.
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
const fake = {
  require: function (p, key) {
    const q = String(p);
    if (/spirit\/auth\/api\.js$/.test(q)) {
      return Promise.resolve({
        grant: function (a) { asked.push({ verb: 'auth.grant', args: a }); return Promise.resolve({ ok: true }); },
        search: function () { return Promise.resolve({ items: [], more: false }); },
      });
    }
    // A server family under a key (the publisher's, as the client subscribes; the client's, as the publisher delivers),
    // by the old name or the new: routing only, this test writes no family path of its own.
    if (key && /(?:^|\/)([^/]+)\/(?:family|\1\.family)\/api\.js$/.test(q)) {
      return Promise.resolve({
        subscribe: function (a) { asked.push({ verb: 'subscribe', key: key, args: a }); return post('subscribe', a, SELF).then(function (r) { return r.body; }); },
        streamListener: function (a) { return deliver(a.json); },
      });
    }
    return Promise.resolve({});
  },
  outcome: function (p) { return Promise.resolve(p).then(function (b) { return { status: 200, body: b }; }, function (e) { return { status: 500, body: { ok: false, error: String(e && e.message || e) } }; }); },
  events: { publish: function () {}, subscribe: function () {} },
};
const realLoad = Module._load;
Module._load = function (request, parent) {
  if (/(^|[\\/])spirit\.js$/.test(request) && parent && String(parent.filename).indexOf(RUN) === 0) { globalThis.spirit = fake; return fake; }
  return realLoad.apply(this, arguments);
};
globalThis.spirit = fake;
if (process.platform === 'win32') PIPE = require(path.join(RUN, 'spirit', 'appClient.js')).pipePathFor(TMP, NAME, 'win32', 'process');
const childArgv = process.argv.slice();
process.argv = [process.argv[0], path.join(TMP, NAME + '.js'), '--pipe', PIPE];

let bootstrap = [];
let bootstraps = 0;
const GOAL = { id: 'goal/G9', goal: '', title: 'the goal', version: 1 };
const item = function (n, extra) { return Object.assign({ id: 'goal/G9.' + n, goal: 'goal/G9', title: 'item ' + n, version: 1 }, extra || {}); };
const row = function (f) { return { verb: 'goal.whole', goal: 9, item: f }; };
// The client's cache file for the publisher (box v15): relay-state/process/<client server>/cache-<sender key in hex>.json,
// under the run root, where spirit.js sits.
const cacheFile = function (name) { return path.join(RUN, 'relay-state', 'process', name, 'cache-' + PUBLISHER_HEX + '.json'); };

function start(streamOpts, publisherOpts) {
  const A = require(FILE);
  const s = A.serve({ ping: { request: {}, reply: { pong: true }, handler: function () { return { pong: true }; } } }, {
    stream: Object.assign({ module: 'process/js/desk', translator: TRANSLATOR }, streamOpts || {}),
    publisher: Object.assign({ family: NAME, bootstrap: function () { bootstraps += 1; return bootstrap.slice(); }, waitMs: 5000 }, publisherOpts || {}),
  });
  return { A: A, s: s, D: A.data };
}
const hasIn = function (D, n) { return !!(D && D.get('deskItems/goal/G9.' + n)); };

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
  } else if (mode === 'restart') {
    // The same client again, a new process: the publisher in it a new run. Its cache read back before any subscribe.
    const { s, D } = start({ cache: true });
    await tick(300);
    out.readOne = hasIn(D, 1); out.readTwo = hasIn(D, 2);
    bootstrap = [row(GOAL), row(item(1, { title: 'item 1, renamed', version: 2 }))];
    out.subscribed = await s.subscribe(PUBLISHER, FAM);
    await tick(400);
    out.title = D.get('deskItems/goal/G9.1') && D.get('deskItems/goal/G9.1').title;
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
    for (let i = 1; i <= 3; i++) { if (D.get('deskItems/goal/G9.' + i)) out.g9.push(i); if (D.get('deskItems/goal/G10.' + i)) out.g10.push(i); }
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
    out.goal = !!D.get('deskItems/goal/G9');
    out.items = []; for (let i = 1; i <= 10; i++) if (D.get('deskItems/goal/G9.' + i)) out.items.push(i);
    const whole = D.get('deskItem/goal/G9.1');
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
    for (let i = 1; i <= 10; i++) { if (D.get('deskItems/goal/G9.' + i)) out.g9.push(i); if (D.get('deskItems/goal/G10.' + i)) out.g10.push(i); }
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n');
  process.exit(0);
}
function runChild(mode, name, fam) {
  const r = spawnSync(process.execPath, [SELF_FILE, '--child', mode, TMP, name, fam || 'desk'], { encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').filter(function (l) { return l.indexOf('RESULT ') === 0; })[0];
  try { return JSON.parse(line.slice(7)); } catch (e) { return { failed: short(r.stderr || r.stdout || r.error) }; }
}
function clearCache(name) { try { fs.rmSync(path.join(RUN, 'relay-state', 'process', name), { recursive: true, force: true }); } catch (e) { /* none */ } }

// ── the tree: one family path, eight folders (box v15, Family folders) ─────────────────────────────────────────────
function codeFiles(dir, out) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'node_modules' || d.name === '.git' || p === path.join(RUN, 'brains') || p === path.join(RUN, 'relay-state')) return;
      codeFiles(p, out);
    } else if (/\.(js|html)$/.test(d.name)) out.push(p);
  });
  return out;
}

if (CHILD) {
  child(CHILD).catch(function (e) { process.stdout.write('RESULT ' + JSON.stringify({ failed: String(e && e.stack || e) }) + '\n'); process.exit(1); });
} else {
  test.startTest('appServer.js: one stream protocol for every server (goal/G41.11, goal/G41.12)');
  (async function () {
    test.subHeading('the family path: one function, in appServer (box v15)');
    const A0 = require(FILE);
    ok(typeof A0.familyPath === 'function', 'appServer exports familyPath', 'appServer has no familyPath export: ' + typeof A0.familyPath);
    const fp = typeof A0.familyPath === 'function' ? A0.familyPath('desk') : null;
    ok(fp === 'process/js/desk/family/api.js', 'familyPath(name) is process/js/<name>/family/api.js', 'familyPath(\'desk\') is ' + short(fp));
    FAMILIES.forEach(function (n) {
      const moved = fs.existsSync(path.join(RUN, 'process', 'js', n, 'family', 'api.js')) && !fs.existsSync(path.join(RUN, 'process', 'js', n, n + '.family'));
      ok(moved, n + ': its family folder is process/js/' + n + '/family/, no ' + n + '.family is left',
        n + ': family/api.js ' + fs.existsSync(path.join(RUN, 'process', 'js', n, 'family', 'api.js')) + ', ' + n + '.family still there: ' + fs.existsSync(path.join(RUN, 'process', 'js', n, n + '.family')));
    });
    // No file but appServer writes a family path: no <name>.family, no family/api.js, no join onto 'family'. This file
    // routes by the pattern and is left out; so are appServer.js and spirit.js: the browser cannot load appServer, so
    // spirit.js holds the function and appServer hands out the same one (cw, goal/G41.12 Q3).
    const SPIRIT_JS = path.join(RUN, 'spirit.js');
    const writers = codeFiles(RUN, []).filter(function (f) { return f !== FILE && f !== SELF_FILE && f !== SPIRIT_JS; }).filter(function (f) {
      const t = fs.readFileSync(f, 'utf8');
      return /\.family(?=['"`\/\\]|$)/m.test(t) || /(^|[^\\])\/?family\/api\.js/.test(t) || /['"`]family['"`]\s*[),]/.test(t);
    }).map(function (f) { return path.relative(RUN, f); });
    ok(writers.length === 0, 'no file outside appServer\'s familyPath writes a family path', writers.length + ' files write one: ' + writers.join(', '));

    test.subHeading('what goes (box v15)');
    const deskJs = fs.readFileSync(path.join(RUN, 'process', 'js', 'desk', 'desk.js'), 'utf8');
    const clientJs = fs.readFileSync(path.join(RUN, 'process', 'js', 'deskClient', 'deskClient.js'), 'utf8');
    ok(!/function\s+bundled\s*\(/.test(deskJs), 'the desk has no bundled() of its own', 'desk.js still defines bundled()');
    ok(!/cache\.json/.test(clientJs), 'deskClient keeps no cache.json of its own', 'deskClient.js still names cache.json');

    // ── one process: a client following its own publisher ──────────────────────────────────────────────────────────
    const { A, s, D } = start({}, { logMax: 5 });
    await tick(100);
    ok(!!D && typeof D.get === 'function' && !!s && typeof s.subscribe === 'function', 'it serves, keeps a data set and has its client half (subscribe)', 'data ' + typeof (D && D.get) + ', subscribe ' + typeof (s && s.subscribe));
    if (!D || !s || typeof s.subscribe !== 'function') return;
    const has = function (n) { return hasIn(D, n); };

    test.subHeading('the first subscribe: a full push');
    bootstrap = [row(GOAL), row(item(1)), row(item(2))];
    const first = await s.subscribe(PUBLISHER, NAME);
    await tick(300);
    ok(first === true && asked.some(function (a) { return a.verb === 'subscribe' && a.key === PUBLISHER; }) && asked.some(function (a) { return a.verb === 'auth.grant'; }),
      'a subscribe follows the publisher\'s key and asks its family to subscribe it', 'answered ' + short(first) + ', asked ' + short(asked));
    ok(has(1) && has(2), 'the bootstrap lands in the cache: both items', short({ one: D.get('deskItems/goal/G9.1'), two: D.get('deskItems/goal/G9.2') }));
    ok(posts.length > 0 && posts.every(Array.isArray), 'every delivery is a bundle: one JSON array of rows in one peerPost', 'deliveries: ' + short(posts));

    test.subHeading('rows that back up go as bundles (box v15)');
    let before = posts.length;
    gate.held = true;
    A.publish(row(item(10)));
    await tick(50);
    for (let i = 11; i < 30; i++) A.publish(row(item(i)));
    await tick(300);
    release();
    await tick(800);
    const landed = []; for (let i = 10; i < 30; i++) if (has(i)) landed.push(i);
    ok(landed.length === 20, 'twenty rows published, twenty landed', 'landed: ' + short(landed));
    ok(posts.length - before <= 3, 'nineteen rows backed up behind a held one went in a bundle, not one peerPost each', (posts.length - before) + ' peerPosts for 20 rows');

    test.subHeading('the position: a subscribe again is handed what came after it, no push (box v15)');
    before = bootstraps;
    gate.refuse = true;
    A.publish(row(item(30)));
    await tick(300);
    gate.refuse = false;
    A.publish(row(item(31)));
    A.publish(row(item(32)));
    A.publish(Object.assign(row(item(33)), { to: ['KEY-SOMEONE-ELSE'] }));
    await tick(100);
    // The new bootstrap holds no item 2: a full push would sweep it.
    bootstrap = [row(GOAL), row(item(1))];
    const again = await s.subscribe(PUBLISHER, NAME);
    await tick(500);
    ok(again === true && has(30) && has(31) && has(32), 'dropped by a refused delivery, it subscribes again and is handed the rows it missed', 'answered ' + short(again) + ', items 30-32: ' + [has(30), has(31), has(32)].join(' '));
    ok(again === true && has(32) && !has(33), 'a row addressed to another key is left out of what it is handed', 'item 33, addressed to another key: ' + has(33));
    ok(bootstraps === before && has(2),'the sender\'s log answers it: no bootstrap, and the cache is not replaced', 'bootstraps ' + before + ' -> ' + bootstraps + ', item 2 kept: ' + has(2));
    const subArgs = asked.filter(function (a) { return a.verb === 'subscribe'; }).map(function (a) { return a.args; });
    const last = subArgs[subArgs.length - 1] || {};
    ok(subArgs.length >= 2 && JSON.stringify(last) !== JSON.stringify(subArgs[0]), 'the subscribe again carries the position the client holds', 'subscribes: ' + short(subArgs));

    test.subHeading('older than the bounded log: a full push, the cache replaced whole (box v15)');
    before = bootstraps;
    gate.refuse = true;
    A.publish(row(item(40)));
    await tick(300);
    gate.refuse = false;
    for (let i = 41; i < 50; i++) A.publish(row(item(i)));
    await tick(100);
    bootstrap = [row(GOAL), row(item(1))];
    await s.subscribe(PUBLISHER, NAME);
    await tick(600);
    ok(bootstraps === before + 1, 'nine rows missed past a log of five: the sender pushes in full', 'bootstraps ' + before + ' -> ' + bootstraps);
    ok(has(1) && !has(2) && !has(45), 'a full push replaces the sender\'s cache whole', 'item 1 ' + has(1) + ', item 2 ' + has(2) + ', item 45 ' + has(45));

    // ── restarts and the cache switch: each a process of its own ───────────────────────────────────────────────────
    test.subHeading('the cache, per sender, saved and read back (box v15)');
    clearCache('cacheProbe');
    const one = runChild('first', 'cacheProbe');
    const file = cacheFile('cacheProbe');
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { text = ''; }
    ok(one.subscribed === true && one.one && one.two, 'a client with the cache switch on takes the push', short(one));
    ok(text.indexOf('item 2') !== -1, 'it saves the cache as relay-state/process/<client>/cache-<sender key in hex>.json', path.relative(RUN, file) + ': ' + (text ? short(text) : 'no file'));
    const two = runChild('restart', 'cacheProbe');
    ok(two.readOne && two.readTwo, 'started again, it reads its cache back before it subscribes', short(two));
    ok(two.subscribed === true && two.title === 'item 1, renamed' && !two.two, 'a sender of a new run pushes in full, and the cache is replaced whole', short(two));
    clearCache('cacheOff');
    runChild('off', 'cacheOff');
    ok(!fs.existsSync(cacheFile('cacheOff')), 'without the switch no cache file is kept', 'cache file found: ' + path.relative(RUN, cacheFile('cacheOff')));
    clearCache('cacheNoFam');
    runChild('nofamily', 'cacheNoFam', 'noSuchServer');
    ok(!fs.existsSync(cacheFile('cacheNoFam')), 'a sender whose family has no folder on this node is not cached', 'cache file found: ' + path.relative(RUN, cacheFile('cacheNoFam')));
    clearCache('cacheEvery');
    const every = runChild('every', 'cacheEvery');
    ok(Array.isArray(every.g9) && every.g9.length === 3 && Array.isArray(every.g10) && every.g10.length === 3,
      'within the limit the cache keeps every goal the sender sends, no filtering on the client side', short(every));
    clearCache('cacheLimit');
    const full = runChild('limit', 'cacheLimit');
    let size = -1;
    try { size = fs.statSync(cacheFile('cacheLimit')).size; } catch (e) { size = -1; }
    ok(size > 0 && size <= 3500, 'the cache keeps to the limit the client sets', 'cache file of ' + size + ' bytes for a limit of 3500');
    ok(Array.isArray(full.g9) && full.g9.length === 0 && Array.isArray(full.g10) && full.g10.length === 10,
      'past the limit the goal untouched longest goes whole, the other is kept whole (Andy, Q2)', short(full));
    // One goal: the item untouched longest goes, its chat with it; the newest stay (Andy, Q2).
    clearCache('cacheItems');
    const items = runChild('items', 'cacheItems');
    const kept = Array.isArray(items.items) ? items.items : [];
    const prefixGone = kept.length > 0 && kept.length < 10 && kept.every(function (n, i) { return n === 10 - kept.length + 1 + i; });
    ok(items.goal && prefixGone, 'one goal past the limit: the items untouched longest go whole, the newest stay, the goal stays', short(items));
    ok(kept.indexOf(1) === -1 && Array.isArray(items.chat) && items.chat.length === 0, 'an item shed goes lock, stock and barrel: its chat with it', short(items));
    clearCache('cacheChat');
    const chat = runChild('chat', 'cacheChat');
    const lines = Array.isArray(chat.chat) ? chat.chat : [];
    const newest = lines.length > 0 && lines.length < 30 && lines.every(function (n, i) { return n === 30 - lines.length + 1 + i; });
    ok(chat.goal && Array.isArray(chat.items) && chat.items.length === 1 && newest, 'one goal with one item past the limit: the oldest chat lines go, the item and the newest lines stay', short(chat));
    ['cacheProbe', 'cacheOff', 'cacheNoFam', 'cacheEvery', 'cacheLimit', 'cacheItems', 'cacheChat'].forEach(clearCache);
  }()).then(function () {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* a temp folder left is no failure */ }
    test.reportSuccessFailureCount(); process.exit(process.exitCode || 0);
  }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(1); });
}
