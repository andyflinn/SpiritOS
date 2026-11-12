'use strict';

// spirit/run/spirit/test/nodeStore.js
// The tests of spirit/nodeStore.js, and of no other module, in this one file (spec: ./nodeStore.md). Its sections: no
// admitted mark (goal/G43.23), after its own. This file holds goal/G41.30: no
// rescue of old stores is left in it (Andy, 2026-11-02: "let's get rid of those \"rescue operations\""). A store is
// opened on a scratch folder that still holds the old address book; the store must leave it as it is, unread.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'nodeStore.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Its code, comments left out.
const code = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');

// its code holds no move of an old store
// The move of goal/G40.11 read four old stores into the seen table on a node's first start: the old seen rows, the
// relays list, apiAuth's peer names and spirit/state/contacts.json, then deleted them.
test.run('it names no contacts.json', 0.2, function () { return !/contacts\.json/.test(code) || 'nodeStore.js still names contacts.json'; }, test.limit.quick);
test.run('it has no moveIn', 0.2, function () { return !/\bmoveIn\b/.test(code) || 'nodeStore.js still has its moveIn'; }, test.limit.quick);
test.run('it reads no old relays or peers table', 0.2, function () {
  return (!/FROM\s+(relays|peers)\b/i.test(code) && !/has\(\s*['"`](relays|peers)['"`]\s*\)/.test(code)) || 'nodeStore.js still reads an old relays or peers table';
}, test.limit.quick);

// an old address book beside it is left as it is, unread
const KEY = 'MCowBQYDK2VwAyEAOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLDOLD=';
const book = JSON.stringify([{ publicKey: KEY, label: 'old friend' }]);
const W = { home: null, store: null, noAdmitHome: null };
test.run('the world: the store opens beside an old book', 0.2, function () {
  W.home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-nodestore-'));
  const state = path.join(W.home, 'spirit', 'state');
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, 'contacts.json'), book);
  try { W.store = require(FILE).open(W.home); } catch (e) { return 'the store did not open beside an old book: ' + (e && e.message); }
  return true;
}, test.limit.quick);
test.run('the old contacts.json is still there, byte for byte', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  const f = path.join(W.home, 'spirit', 'state', 'contacts.json');
  const left = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  return left === book || (left === null ? 'the old contacts.json was deleted' : 'the old contacts.json was changed: ' + short(left));
}, test.limit.quick);
test.run('and nothing of it was read into the store', 0.2, function () {
  if (!W.home) return 'no scratch folder: the world failed';
  let row = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(require(FILE).dbPath(W.home), { readOnly: true });
    row = db.prepare('SELECT publicKey FROM seen WHERE publicKey = ?').get(KEY) || null;
    db.close();
  } catch (e) { row = { error: String(e && e.message) }; }
  return !row || 'the store took a row from the old book: ' + short(row);
}, test.limit.quick);

// ── THE NO ADMITTED PART ──
// NODESTORE.JS MARKS NO ADMITTED, AND ITS TRAFFIC TABLE HAS NO admitted COLUMN (goal/G43.23, item 6, after goal/G43.17; spec: ./nodeStore.md, its section). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

// A file's code, comments blanked (line numbers kept); null when the file is not there.
function codeOf(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}
// The lines of a file's code matching re, as "name:line text".
function hits(file, re) {
  const c = codeOf(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(path.basename(file) + ':' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  return out;
}

// noAdmitted: nodeStore.js names no admitted mark, and the traffic table it makes has no admitted column
// the traffic log's admitted mark: nodeStore
test.run('the world: the file is read, and its code, comments left out, still holds a line of code', 0.2, function () {
  const c = codeOf(FILE);
  return (c !== null && /module\.exports/.test(c)) ||
    (c === null ? path.relative(RUN, FILE) + ' is not there: nothing judged' : path.relative(RUN, FILE) + '\'s code holds no /module\\.exports/: the comment stripper ate it, nothing judged');
}, test.limit.quick);
test.run('nodeStore.js\'s code names no admitted mark', 0.2, function () {
  const h = hits(FILE, /admit/i);
  if (h === null) return 'nodeStore.js is not there: nothing judged';
  return !h.length || 'nodeStore.js\'s code still marks or reads admitted: ' + short(h);
}, test.limit.quick);

// the node's own store makes no admitted column in node.db's traffic table
let cols = null;
test.run('the world: the store made node.db with a traffic table', 0.2, function () {
  W.noAdmitHome = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-noadmit-'));
  let store = null;
  try { store = require(FILE).open(W.noAdmitHome); } catch (e) { return 'the store did not open on a scratch folder: ' + (e && e.message) + ': nothing judged'; }
  try { store.close(); } catch (e) { /* closed */ }
  try {
    const db = new (require('node:sqlite').DatabaseSync)(path.join(W.noAdmitHome, 'spirit', 'state', 'node.db'), { readOnly: true });
    cols = db.prepare('PRAGMA table_info(traffic)').all().map(function (r) { return r.name; });
    db.close();
  } catch (e) { return 'node.db could not be read: ' + (e && e.message) + ': nothing judged'; }
  return (cols.indexOf('dir') !== -1 && cols.indexOf('hash') !== -1) || 'node.db holds no traffic table of the log\'s: ' + short(cols) + ': nothing judged';
}, test.limit.quick);
test.run('and that traffic table has no admitted column', 0.2, function () {
  if (!cols) return 'no traffic table read: the world failed';
  return cols.indexOf('admitted') === -1 || 'the traffic table the store makes still has an admitted column';
}, test.limit.quick);

// ── THE ROUTE CACHING GOES ──
// goal/G47.1, the cycle "the route caching goes" (box v69; Andy: "We can probably shut down the \"route-caching\" crap",
// and "the \"routes\" aren't read by anybody in the fucking system"): "The node keeps no route of a peer: the table
// seen_routes is dropped, and with it every write of a route (an arrival, a relay's route event, presence, a contact
// added) and every read (the routes of a key, the best route flattened onto a seen row)". A fresh node.db, and one made
// with a seen_routes table holding a row, as a node made before this cycle has it.
const ROUTE_VERBS = ['putRoute', 'routes', 'trimRoutes', 'dropRoutes', 'dropRoute', 'routeByUrl', 'clearRoutes', 'route'];
const tablesOf = function (home) {
  const db = new (require('node:sqlite').DatabaseSync)(path.join(home, 'spirit', 'state', 'node.db'), { readOnly: true });
  try { return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(function (r) { return r.name; }); } finally { db.close(); }
};
// Every function the store hands out, one level into each object it answers (its seen rows, its traffic, its queue).
const verbsOf = function (store) {
  const out = [];
  Object.keys(store || {}).forEach(function (k) {
    const v = store[k];
    if (typeof v === 'function') out.push(k);
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k2) { if (typeof v[k2] === 'function') out.push(k + '.' + k2); });
  });
  return out;
};
let fresh = null, routeStore = null, old = null;
test.run('the world: a fresh node.db, and a node.db made before with a seen_routes table holding a row, each opened by the store', 0.2, function () {
  try {
    fresh = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-noroute-'));
    routeStore = require(FILE).open(fresh);
    old = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-oldroute-'));
    fs.mkdirSync(path.join(old, 'spirit', 'state'), { recursive: true });
    const db = new (require('node:sqlite').DatabaseSync)(path.join(old, 'spirit', 'state', 'node.db'));
    db.exec('PRAGMA auto_vacuum = INCREMENTAL');
    db.exec("CREATE TABLE seen_routes (publicKey TEXT NOT NULL, via TEXT NOT NULL DEFAULT '', at TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', rank INTEGER NOT NULL DEFAULT 9, told INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (publicKey, via, at))");
    db.prepare('INSERT INTO seen_routes (publicKey, via, at, url, rank, told) VALUES (?, ?, ?, ?, ?, ?)').run(KEY, '', KEY, 'https://relay.example', 1, Date.now());
    db.close();
    const s = require(FILE).open(old);
    try { s.close(); } catch (e) { /* closed */ }
  } catch (e) { return 'a store did not open: ' + (e && e.message); }
  return true;
}, test.limit.quick);
test.run('a fresh node.db has no seen_routes table', 0.2, function () {
  if (!fresh) return 'no fresh store: the world failed';
  const t = tablesOf(fresh);
  return t.indexOf('seen_routes') === -1 || 'the fresh node.db has the tables ' + short(t);
}, test.limit.quick);
test.run('a node.db made with a seen_routes table has it no more once the store opened it', 0.2, function () {
  if (!old) return 'no old store: the world failed';
  const t = tablesOf(old);
  return t.indexOf('seen_routes') === -1 || 'the old node.db still has the tables ' + short(t);
}, test.limit.quick);
test.run('the store hands out no function that writes or reads a route', 0.2, function () {
  if (!routeStore) return 'no fresh store: the world failed';
  const v = verbsOf(routeStore);
  const left = v.filter(function (name) { return ROUTE_VERBS.indexOf(name.split('.').pop()) !== -1; });
  return (v.length > 0 && !left.length) || (v.length ? 'the store still hands out ' + short(left) : 'the store hands out no function at all: nothing judged');
}, test.limit.quick);
// ITS RELAYS' ADDRESSES MOVE FIRST, ONCE (goal/G47.1; Andy, after his node lost both relay addresses on the drop and Desk
// went dark: "cw, just finish what you're doing first"): a node.db made before, as a node had it, its seen table without
// url, a relay's row and that relay's own route (via empty, at its own key), and a peer's route through it. Opened, the
// relay's row holds its address, and the peer's row none.
const RELAY = 'MCowBQYDK2VwAyEAOLDRELAYOLDRELAYOLDRELAYOLDRELAYOLDRELAYOLD=';
let moved = null;
test.run('the world: a node.db made before, a relay row and its own route in seen_routes, opened by the store', 0.2, function () {
  try {
    moved = fs.mkdtempSync(path.join(os.platform() === 'win32' ? os.tmpdir() : '/tmp', 'spirit-moveroute-'));
    fs.mkdirSync(path.join(moved, 'spirit', 'state'), { recursive: true });
    const db = new (require('node:sqlite').DatabaseSync)(path.join(moved, 'spirit', 'state', 'node.db'));
    db.exec('PRAGMA auto_vacuum = INCREMENTAL');
    db.exec("CREATE TABLE seen (publicKey TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', labelRank INTEGER NOT NULL DEFAULT 4, labelAt INTEGER NOT NULL DEFAULT 0, present INTEGER NOT NULL DEFAULT -1, myLabel TEXT NOT NULL DEFAULT '', card TEXT NOT NULL DEFAULT '', face TEXT NOT NULL DEFAULT '', firstSeen INTEGER NOT NULL DEFAULT 0, lastSeen INTEGER NOT NULL DEFAULT 0, keep INTEGER NOT NULL DEFAULT 0, mine INTEGER NOT NULL DEFAULT 0, relay INTEGER NOT NULL DEFAULT 0, ignored INTEGER NOT NULL DEFAULT 0, blocked INTEGER NOT NULL DEFAULT 0, seated INTEGER NOT NULL DEFAULT 0)");
    db.prepare('INSERT INTO seen (publicKey, label, relay, keep, seated) VALUES (?, ?, 1, 1, 1)').run(RELAY, 'old relay');
    db.prepare('INSERT INTO seen (publicKey, label) VALUES (?, ?)').run(KEY, 'a peer');
    db.exec("CREATE TABLE seen_routes (publicKey TEXT NOT NULL, via TEXT NOT NULL DEFAULT '', at TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', rank INTEGER NOT NULL DEFAULT 9, told INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (publicKey, via, at))");
    db.prepare('INSERT INTO seen_routes (publicKey, via, at, url, rank, told) VALUES (?, ?, ?, ?, ?, ?)').run(RELAY, '', RELAY, 'https://old.relay.example', 1, Date.now());
    db.prepare('INSERT INTO seen_routes (publicKey, via, at, url, rank, told) VALUES (?, ?, ?, ?, ?, ?)').run(KEY, RELAY, RELAY, 'https://old.relay.example', 3, Date.now());
    db.close();
    const s = require(FILE).open(moved);
    try { s.close(); } catch (e) { /* closed */ }
  } catch (e) { return 'the store did not open it: ' + (e && e.message); }
  return true;
}, test.limit.quick);
const urlOf = function (home, key) {
  const db = new (require('node:sqlite').DatabaseSync)(path.join(home, 'spirit', 'state', 'node.db'), { readOnly: true });
  try { const r = db.prepare('SELECT url FROM seen WHERE publicKey = ?').get(key); return r ? r.url : null; } finally { db.close(); }
};
test.run('a relay\'s own address moved onto its row before seen_routes went', 0.2, function () {
  if (!moved) return 'no old store: the world failed';
  const u = urlOf(moved, RELAY);
  return (u === 'https://old.relay.example' && tablesOf(moved).indexOf('seen_routes') === -1) || 'the relay row\'s url: ' + short(u) + ', tables ' + short(tablesOf(moved));
}, test.limit.quick);
test.run('a peer\'s route moved nowhere: its row has no address', 0.2, function () {
  if (!moved) return 'no old store: the world failed';
  const u = urlOf(moved, KEY);
  return u === '' || 'the peer row\'s url: ' + short(u);
}, test.limit.quick);

test.after(function () {
  void W.store;
  try { if (routeStore) routeStore.close(); } catch (e) { /* closed */ }
  for (const d of [W.home, W.noAdmitHome, fresh, old, moved]) { if (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* scratch */ } } }
});
