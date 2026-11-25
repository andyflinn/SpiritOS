'use strict';

// spirit/run/spirit/trafficLog/test/script.js
// The tests of spirit/trafficLog/script.js, and of no other module (spec: ./script.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1).
//
// createTrafficLog(opts): what this node sent and what it received, a row each, in node.db's `traffic` table, the
// payload kept whole and never read. Every check runs on a scratch node home under the OS temp folder: real rows
// written through note() and taken(), read back through the log's own readers, the store closed and opened again.

require('../../script.js');
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../tempFolder/script.js');
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/trafficLog/' + name + tempAsked); }
// ITS STORES CLOSED BEFORE ITS FOLDER GOES (goal/G49.7, as spirit/relay/processor/test/script.js does it, goal/G48.4; Andy, of the 0.7s: "it leaves no temp folder behind"): on Windows a
// folder holding an open database cannot be removed, and nodeStore keeps each store it opened open; every one under the
// suite's folder (a node.db or a relay.db at <root>/spirit/state) is closed first.
function closeStoresUnder(top) {
  const NS = S.requireScript('spirit/nodeStore/script.js');
  (function walk(dir, depth) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return; }
    if (names.indexOf('node.db') !== -1 && path.basename(dir) === 'state') { try { NS.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ } }
    // A relay's own store too (relay.db beside it), which relayStore keeps open the same way.
    // Through every copy of relayStore this process loaded (a relay made on a scratch tree loads that tree's own), so it is
    // the store that relay holds open.
    if (names.indexOf('relay.db') !== -1 && path.basename(dir) === 'state') {
      Object.keys(require.cache).filter(function (k) { return /[\\/]relayStore\.js$/.test(k); }).forEach(function (k) {
        try { require.cache[k].exports.open(path.dirname(path.dirname(dir))).close(); } catch (e) { /* closed */ }
      });
    }
    if (depth > 6) return;
    names.forEach(function (n) { const p = path.join(dir, n); try { if (fs.statSync(p).isDirectory()) walk(p, depth + 1); } catch (e) { /* gone */ } });
  }(top, 0));
}
test.after(function () { const top = tempFolder.path('spirit/test/trafficLog'); closeStoresUnder(top); try { fs.rmSync(top, { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const T = S.requireScript('spirit/trafficLog/script.js');
const nodeStore = S.requireScript('spirit/nodeStore/script.js');

const ROOTS = [];
function scratch() { const d = ownTemp('spirit-trafficlog-'); ROOTS.push(d); return d; }
function hasDb(root) { return fs.existsSync(nodeStore.dbPath(root)); }
// The same object, whatever order its keys came in.
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object') { const o = {}; Object.keys(x).sort().forEach(function (k) { o[k] = canon(x[k]); }); return o; }
  return x;
}
function same(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
function hashes(rows) { return rows.map(function (r) { return r.hash; }).join(','); }
function delivered(log, hash, extra) { return log.note(Object.assign({ dir: 'in', kind: 'request', peer: 'K', relay: 'R', hash: hash, outcome: 'delivered', payload: 'p-' + hash }, extra || {})); }

const W = { root: null, log: null };

// ── what it is ──
test.run('the module hands out a log maker, and a log answers every reader and writer a caller uses', 0.2, function () {
  if (typeof T.createTrafficLog !== 'function') return false;
  W.root = scratch();
  W.log = T.createTrafficLog({ rootDir: W.root });
  return ['note', 'read', 'size', 'arrivals', 'untaken', 'byHash', 'taken'].every(function (k) {
    return typeof W.log[k] === 'function';
  }) || false;
}, test.limit.quick);
test.run('a log has no reader of owner events', 0.2, function () {
  return (!!W.log && !('ownerEvents' in W.log)) || false;
}, test.limit.quick);

// ── no store yet ──
test.run('a home with no database reads as no history from every reader', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  return (same(log.read(), []) && log.size() === 0 && same(log.arrivals(), []) && same(log.untaken(), []) &&
    log.byHash('h') === null && log.taken(['h']) === 0) || false;
}, test.limit.quick);
test.run('asking what the log holds never brings a database into existence', 0.4, function () {
  const root = scratch();
  const log = T.createTrafficLog({ rootDir: root });
  log.read(); log.size(); log.arrivals(); log.untaken(); log.byHash('h'); log.taken('h');
  return !hasDb(root) || false;
}, test.limit.quick);
test.run('the first note writes the database, and the row it hands back is read back the same', 0.4, function () {
  if (!W.log) return false;
  const row = W.log.note({ dir: 'out', kind: 'request', peer: 'peerKey', relay: 'https://r.example', hash: 'h-first', outcome: 'sent', status: 200, ms: 12 });
  const back = W.log.read();
  return (!!row && hasDb(W.root) && back.length === 1 && same(back[0], row)) || false;
}, test.limit.quick);

// ── the gate ──
test.run('a log in relay mode writes nothing and makes no database, whatever it is handed', 0.8, function () {
  const root = scratch();
  const log = T.createTrafficLog({ rootDir: root, relayMode: true });
  const r = log.note({ dir: 'in', kind: 'request', hash: 'h', outcome: 'delivered', payload: 'somebody\'s words' });
  return (r === null && !hasDb(root) && same(log.read(), [])) || false;
}, test.limit.quick);
test.run('a log with no home, or a note with no entry, writes nothing', 0.4, function () {
  const none = T.createTrafficLog({});
  const bare = T.createTrafficLog();
  const root = scratch();
  const log = T.createTrafficLog({ rootDir: root });
  return (none.note({ dir: 'in', hash: 'h' }) === null && bare.note({ dir: 'in', hash: 'h' }) === null &&
    same(none.read(), []) && log.note() === null && log.note(null) === null && !hasDb(root)) || false;
}, test.limit.quick);

// ── what a row is ──
test.run('a row names its time, direction, kind, peer, relay, hash and outcome, each as text', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const r = log.note({ dir: 'in', kind: 'reply', peer: 7, relay: 'https://r', hash: 99, outcome: 'delivered' });
  const back = log.read()[0] || {};
  return (typeof r.at === 'string' && !isNaN(Date.parse(r.at)) && r.dir === 'in' && r.kind === 'reply' && r.peer === '7' &&
    r.relay === 'https://r' && r.hash === '99' && r.outcome === 'delivered' && same(back, r)) || false;
}, test.limit.quick);
test.run('a direction that is not in is out, and a kind that is not reply is request', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const a = log.note({ dir: 'sideways', kind: 'gossip', hash: 'a' });
  const b = log.note({ hash: 'b' });
  return (a.dir === 'out' && a.kind === 'request' && b.dir === 'out' && b.kind === 'request' &&
    b.peer === '' && b.relay === '' && b.outcome === '') || false;
}, test.limit.quick);
test.run('status, code, time, queue wait and attempts are kept when given, numbers as numbers, and left out when not', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const a = log.note({ hash: 'a', status: '503', code: 'relay-full', ms: '40', waitMs: 25, attempts: 3 });
  const b = log.note({ hash: 'b', status: 'nonsense', ms: 'x', waitMs: null, attempts: undefined });
  const c = log.note({ hash: 'c' });
  const back = log.read();
  return (a.status === 503 && a.code === 'relay-full' && a.ms === 40 && a.waitMs === 25 && a.attempts === 3 &&
    b.status === 0 && b.ms === 0 && !('waitMs' in b) && !('attempts' in b) && !('code' in b) &&
    !('status' in c) && !('ms' in c) && !('code' in c) &&
    back.length === 3 && same(back[0], a) && same(back[1], b) && same(back[2], c)) || false;
}, test.limit.quick);

// ── the payload, whole and unread ──
test.run('a payload is kept byte for byte and comes back exactly as it was written', 0.8, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const payload = '{"app":"chat","body":"grüße — 😀","n":1}\n  trailing  ';
  log.note({ dir: 'in', hash: 'p', outcome: 'delivered', payload: payload });
  const back = log.read()[0] || {};
  return back.payload === payload || false;
}, test.limit.quick);
test.run('a payload is never read: the row carries no app field, even when the payload names one', 0.8, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const r = log.note({ dir: 'in', hash: 'p', outcome: 'delivered', app: 'chat', payload: '{"app":"chat","v":1}' });
  const back = log.read()[0] || {};
  return (!('app' in r) && !('app' in back) && !('v' in back) && back.payload === '{"app":"chat","v":1}') || false;
}, test.limit.quick);
test.run('the size of a payload is its bytes in UTF-8, not its characters', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const ascii = log.note({ hash: 'a', payload: 'hello' });
  const wide = log.note({ hash: 'b', payload: 'grüße 😀' });
  const empty = log.note({ hash: 'c', payload: '' });
  return (ascii.bytes === 5 && wide.bytes === Buffer.byteLength('grüße 😀', 'utf8') && wide.bytes !== 'grüße 😀'.length &&
    empty.payload === '' && empty.bytes === 0) || false;
}, test.limit.quick);
test.run('a payload that is not text is not kept, and the row has no size', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const a = log.note({ hash: 'a', payload: { body: 'x' } });
  const b = log.note({ hash: 'b', payload: 42 });
  const back = log.read();
  return (!('payload' in a) && !('bytes' in a) && !('payload' in b) && !('bytes' in b) &&
    back.every(function (r) { return !('payload' in r) && !('bytes' in r); })) || false;
}, test.limit.quick);

// ── no owner rows ──
test.run('no row is written with the owner kind, nor with an owner event\'s facts', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const r = log.note({ dir: 'in', kind: 'owner', hash: 'h', event: 'claim', label: 'andy', invite: '+49', key: 'pk', why: 'w',
    owner: true, revoked: 2, invitesRevoked: 1, expiresAt: '2026-12-01T00:00:00.000Z', cause: 'x' });
  const back = log.read();
  const facts = ['event', 'label', 'invite', 'key', 'why', 'owner', 'revoked', 'invitesRevoked', 'expiresAt', 'cause'];
  return (r.kind === 'request' && back.length === 1 && back[0].kind === 'request' &&
    facts.every(function (k) { return !(k in r) && !(k in back[0]); })) || false;
}, test.limit.quick);
test.run('a packet row does not take an owner event\'s facts', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  const r = log.note({ dir: 'in', kind: 'request', hash: 'h', event: 'claim', label: 'andy', invite: '+49', cause: 'x' });
  return (!('event' in r) && !('label' in r) && !('invite' in r) && !('cause' in r)) || false;
}, test.limit.quick);

// ── the stamp ──
test.run('two rows written in one millisecond get distinct, increasing times', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch(), now: function () { return 1000; } });
  const a = log.note({ hash: 'a' }); const b = log.note({ hash: 'b' }); const c = log.note({ hash: 'c' });
  return (a.at === new Date(1000).toISOString() && b.at === new Date(1001).toISOString() && c.at === new Date(1002).toISOString()) || false;
}, test.limit.quick);
test.run('a clock that goes backwards never makes a time go backwards', 0.4, function () {
  let clock = 5000;
  const log = T.createTrafficLog({ rootDir: scratch(), now: function () { return clock; } });
  const a = log.note({ hash: 'a' }); clock = 3000;
  const b = log.note({ hash: 'b' }); clock = 9000;
  const c = log.note({ hash: 'c' });
  return (a.at === new Date(5000).toISOString() && b.at === new Date(5001).toISOString() && c.at === new Date(9000).toISOString()) || false;
}, test.limit.quick);
test.run('a new log on the same home starts after the highest time already written, so a restart reuses no position', 0.4, function () {
  const root = scratch();
  const first = T.createTrafficLog({ rootDir: root, now: function () { return 50000; } });
  first.note({ hash: 'a' }); first.note({ hash: 'b' });
  nodeStore.open(root).close();
  const again = T.createTrafficLog({ rootDir: root, now: function () { return 1000; } });
  const c = again.note({ hash: 'c' });
  return (c.at === new Date(50002).toISOString() && hashes(again.read()) === 'a,b,c') || false;
}, test.limit.quick);
test.run('read hands every row back in the order it was written', 0.4, function () {
  let clock = 9000;
  const log = T.createTrafficLog({ rootDir: scratch(), now: function () { return clock; } });
  ['a', 'b', 'c', 'd'].forEach(function (h, i) { clock = i % 2 ? 2000 : 9000; log.note({ hash: h }); });
  return hashes(log.read()) === 'a,b,c,d' || false;
}, test.limit.quick);

// ── kept across a close ──
test.run('the rows are still there when the store is closed and the log is made again', 0.8, function () {
  const root = scratch();
  const log = T.createTrafficLog({ rootDir: root });
  const rows = [log.note({ dir: 'in', hash: 'x', outcome: 'delivered', payload: 'one' }), log.note({ dir: 'out', hash: 'y', outcome: 'sent', payload: 'two' })];
  nodeStore.open(root).close();
  const again = T.createTrafficLog({ rootDir: root });
  return same(again.read(), rows) || false;
}, test.limit.quick);
test.run('a database file that is not a database reads as no history, and a note on it does not throw', 0.4, function () {
  const root = scratch();
  fs.mkdirSync(path.dirname(nodeStore.dbPath(root)), { recursive: true });
  fs.writeFileSync(nodeStore.dbPath(root), 'this is not a database, it is a sentence of exactly this length.....'.repeat(20));
  const log = T.createTrafficLog({ rootDir: root });
  log.note({ dir: 'in', hash: 'h', outcome: 'delivered', payload: 'x' });
  return (same(log.read(), []) && log.size() === 0 && same(log.arrivals(), []) && log.byHash('h') === null) || false;
}, test.limit.quick);

// ── arrivals ──
const A = { log: null, rows: null };
test.run('arrivals are delivered inbound rows only, oldest first: nothing sent, held or ignored', 0.8, function () {
  A.log = T.createTrafficLog({ rootDir: scratch() });
  A.rows = [];
  A.rows.push(delivered(A.log, 'd1'));
  A.log.note({ dir: 'out', hash: 'o1', outcome: 'delivered', payload: 'mine' });
  A.log.note({ dir: 'in', hash: 'i1', outcome: 'ignored', payload: 'x' });
  A.log.note({ dir: 'in', hash: 'i2', outcome: 'refused', payload: 'x' });
  A.rows.push(delivered(A.log, 'd2'));
  A.rows.push(delivered(A.log, 'd3', { kind: 'reply' }));
  return hashes(A.log.arrivals()) === 'd1,d2,d3' || false;
}, test.limit.quick);
test.run('arrivals since a time are the ones written after it, and not the one at it', 0.4, function () {
  if (!A.rows) return false;
  return (hashes(A.log.arrivals({ since: A.rows[0].at })) === 'd2,d3' && hashes(A.log.arrivals({ since: A.rows[2].at })) === '' &&
    hashes(A.log.arrivals({ since: 42 })) === 'd1,d2,d3') || false;
}, test.limit.quick);
test.run('arrivals hand back as many as the limit asks, oldest first', 0.4, function () {
  if (!A.rows) return false;
  return (hashes(A.log.arrivals({ limit: 2 })) === 'd1,d2' && hashes(A.log.arrivals({ since: A.rows[0].at, limit: 1 })) === 'd2') || false;
}, test.limit.quick);
test.run('arrivals keep the payload whole, as written', 0.4, function () {
  if (!A.rows) return false;
  return same(A.log.arrivals(), A.rows) || false;
}, test.limit.quick);
test.run('arrivals are capped: a limit of none, zero or below asks the default, and a large one stops at the ceiling', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  for (let i = 0; i < 501; i += 1) delivered(log, 'n' + i);
  return (log.arrivals().length === 200 && log.arrivals({ limit: 0 }).length === 200 && log.arrivals({ limit: -3 }).length === 200 &&
    log.arrivals({ limit: 'many' }).length === 200 && log.arrivals({ limit: 10000 }).length === 500 &&
    (log.arrivals({ limit: 10000 })[0] || {}).hash === 'n0') || false;
}, test.limit.slow);

// ── taken ──
const K = { log: null, at: null };
test.run('taken marks the delivered inbound rows named and answers how many it marked', 0.4, function () {
  K.log = T.createTrafficLog({ rootDir: scratch() });
  delivered(K.log, 't1'); delivered(K.log, 't2'); delivered(K.log, 't3');
  K.log.note({ dir: 'out', hash: 'out1', outcome: 'delivered' });
  K.log.note({ dir: 'in', hash: 'held1', outcome: 'ignored' });
  return K.log.taken(['t1', 't2', 'out1', 'held1', 'nobody']) === 2 || false;
}, test.limit.quick);
test.run('a row is marked once: taking it again marks nothing and keeps its first time', 0.4, function () {
  if (!K.log) return false;
  const before = (K.log.byHash('t1') || {}).takenAt;
  const again = K.log.taken(['t1', 't2']);
  return (again === 0 && typeof before === 'string' && (K.log.byHash('t1') || {}).takenAt === before) || false;
}, test.limit.quick);
test.run('the marks of one delivery share one time, later than every row before them', 0.4, function () {
  if (!K.log) return false;
  const rows = K.log.read();
  const t1 = rows.filter(function (r) { return r.hash === 't1'; })[0] || {};
  const t2 = rows.filter(function (r) { return r.hash === 't2'; })[0] || {};
  const last = rows.map(function (r) { return r.at; }).sort().pop();
  return (!!t1.takenAt && t1.takenAt === t2.takenAt && t1.takenAt > last) || false;
}, test.limit.quick);
test.run('taken accepts one hash on its own, and nothing to mark answers none', 0.4, function () {
  if (!K.log) return false;
  return (K.log.taken('t3') === 1 && K.log.taken([]) === 0 && K.log.taken() === 0 && K.log.taken(['', null]) === 0) || false;
}, test.limit.quick);
test.run('a mark is not a row of history: read hands back the packets alone, the taken ones with when', 0.4, function () {
  if (!K.log) return false;
  const rows = K.log.read();
  const byH = {}; rows.forEach(function (r) { byH[r.hash] = r; });
  return (rows.length === 5 && rows.every(function (r) { return !('mark' in r); }) &&
    !!byH.t1.takenAt && !!byH.t3.takenAt && !('takenAt' in byH.out1) && !('takenAt' in byH.held1)) || false;
}, test.limit.quick);
test.run('arrivals carry when each was taken', 0.4, function () {
  if (!K.log) return false;
  const a = K.log.arrivals();
  return (hashes(a) === 't1,t2,t3' && a.every(function (r) { return typeof r.takenAt === 'string'; })) || false;
}, test.limit.quick);

// ── untaken ──
test.run('untaken is every delivered inbound row not yet taken, oldest first', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  delivered(log, 'u1'); delivered(log, 'u2'); delivered(log, 'u3');
  log.note({ dir: 'out', hash: 'o', outcome: 'delivered' });
  log.note({ dir: 'in', hash: 'i', outcome: 'ignored' });
  const before = hashes(log.untaken());
  log.taken('u2');
  return (before === 'u1,u2,u3' && hashes(log.untaken()) === 'u1,u3') || false;
}, test.limit.quick);
test.run('untaken leaves out an arrival older than a day', 0.4, function () {
  let clock = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const log = T.createTrafficLog({ rootDir: scratch(), now: function () { return clock; } });
  delivered(log, 'old');
  clock = Date.now();
  delivered(log, 'new');
  return (hashes(log.untaken()) === 'new' && hashes(log.arrivals()) === 'old,new') || false;
}, test.limit.quick);

test.run('arrivals written in one millisecond are none of them lost to a reader asking after the first', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch(), now: function () { return Date.parse('2026-11-16T00:00:00.000Z'); } });
  const a = delivered(log, 'a');
  delivered(log, 'b');
  delivered(log, 'c');
  return hashes(log.arrivals({ since: a.at })) === 'b,c' || false;
}, test.limit.quick);

// ── byHash ──
test.run('byHash answers the newest row for that hash, with when it was taken', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  log.note({ dir: 'out', kind: 'request', hash: 'H', outcome: 'sent', payload: 'ask' });
  const reply = log.note({ dir: 'in', kind: 'reply', hash: 'H', outcome: 'delivered', payload: 'answer' });
  const before = log.byHash('H');
  log.taken('H');
  const after = log.byHash('H') || {};
  return (same(before, reply) && after.payload === 'answer' && after.kind === 'reply' && typeof after.takenAt === 'string' && !('mark' in after)) || false;
}, test.limit.quick);
test.run('byHash with no hash, an empty one or an unknown one is null', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  log.note({ hash: 'H' });
  log.note({ hash: '' });
  return (log.byHash() === null && log.byHash('') === null && log.byHash('nope') === null && !!log.byHash('H')) || false;
}, test.limit.quick);

// ── size ──
test.run('size answers the bytes the log takes, growing as rows are written', 0.4, function () {
  const log = T.createTrafficLog({ rootDir: scratch() });
  log.note({ hash: 'a', payload: 'x' });
  const small = log.size();
  for (let i = 0; i < 40; i += 1) log.note({ hash: 'b' + i, payload: 'y'.repeat(2000) });
  const big = log.size();
  return (typeof small === 'number' && small > 0 && big > small && big >= 40 * 2000) || false;
}, test.limit.quick);

test.after(function () {
  ROOTS.forEach(function (root) {
    try { if (hasDb(root)) nodeStore.open(root).close(); } catch (e) { /* not a database: nothing open */ }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  });
});
