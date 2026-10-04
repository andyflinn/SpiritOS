'use strict';

// goal/G4.31: opening a node's event stream asks only for undelivered arrivals instead of reading the whole traffic
// log. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   Found under goal/G4.30 (wsl-claude, measured 2026-10-04): every kernel.peerPost opens the node's /api/events, and
//   on each open arrivals.subscribe asks waiting(), which calls traffic.read(), the whole log, to find the few rows not
//   yet taken (arrivals.js 156-161). On wsl-claude's node: 112,192 rows back to 2026-09-22, read in 1,047 ms, and the
//   stream's first byte came 1.0-1.25 s after the open, while any other request answered in 2-5 ms.
//   Andy, 2026-10-04, to "on opening the stream, ask the traffic table only for undelivered arrivals ... instead of
//   reading the whole log; the log stays permanent": "yes"; then his Go on goal/G4.31. The log stays permanent:
//   "the log should be permanent. period." (peerPost.js 78-82).
//
// THE SHAPES, NAMED HERE where the item names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  Subscribing never calls traffic.read(); what it replays comes from a query that touches only the rows that
//      can be waiting (admitted, inbound, no taken mark).
//   2  What it replays is unchanged: every untaken admitted inbound row, oldest first, the newest included (the 200-row
//      cap that once hid it stays fixed, arrivals.js theBacklogIsNotTheFirstPage), never an ignored or outbound row;
//      and once handed over they are marked taken, so the next page gets none.
//   3  It is cheap with a long log: subscribing over 20,000 taken rows costs under a fifth of reading them all.
//
// FOUND IN THE DRY RUN: the hash index is partial (nodeStore.js, traffic_hash ... WHERE hash <> ''), so a lookup by
//   hash that does not repeat hash <> '' scans the table once per row: a NOT EXISTS written without it took 33 s here.
// LEFT OPEN, not asserted: the name of the query on the log (untaken(), or arrivals with no cap); the legacy
//   traffic.jsonl rows a node migrated, which arrivals() still reads from the file.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const trafficLog = require('../run/js/trafficLog.js');
const arrivalsModule = require('../run/js/arrivals.js');
const packet = require('../run/js/client/packet.js');

const OWED = 'OWED by goal/G4.31: ';

function removeHome(home) {
  try { require('../run/js/nodeStore.js').open(home).close(); } catch (e) { /* no store */ }
  fs.rmSync(home, { recursive: true, force: true });
}
function logAt(home) { return trafficLog.createTrafficLog({ rootDir: home, relayMode: false }); }
function landed(log, hash, text, admitted) {
  log.note({ dir: 'in', kind: 'request', peer: 'PEERKEY', relay: 'https://relay.example', hash: hash,
    outcome: admitted === false ? 'ignored' : 'delivered', payload: text, admitted: admitted !== false });
}
function sent(log, hash) {
  log.note({ dir: 'out', kind: 'request', peer: 'PEERKEY', relay: 'https://relay.example', hash: hash, outcome: 'sent' });
}
// The log as the seam would see it, with every call to read() counted.
function counted(log) {
  const c = Object.assign({}, log);
  c.reads = 0;
  c.read = function () { c.reads += 1; return log.read(); };
  return c;
}

test.startTest('goal/G4.31: opening the event stream asks only for undelivered arrivals');

(function theBacklogWithoutReadingTheLog() {
  test.subHeading('1-2. the same backlog, without reading the whole log');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlog-quick-'));
  const log = logAt(home);
  const text = packet.encode('agents', { text: 'x' }).text;
  const taken = [];
  landed(log, 'first', text);
  for (let i = 0; i < 300; i += 1) { landed(log, 'old' + i, text); taken.push('old' + i); sent(log, 'out' + i); }
  landed(log, 'middle', text);
  landed(log, 'held', text, false);
  for (let i = 300; i < 600; i += 1) { landed(log, 'old' + i, text); taken.push('old' + i); }
  landed(log, 'newest', text);
  log.taken(taken);
  const spy = counted(logAt(home));
  const got = [];
  arrivalsModule.createArrivals({ traffic: spy }).subscribe(function (m) { got.push(m.hash); });
  if (got.join(',') === 'first,middle,newest') test.check('the untaken admitted arrivals come back, oldest first, the newest included; no ignored or outbound row');
  else test.fail('the page got ' + JSON.stringify(got.slice(0, 6)) + ' (' + got.length + ')');
  if (spy.reads === 0) test.check('subscribing never read the whole log');
  else test.fail(OWED + 'subscribing called traffic.read() ' + spy.reads + ' time(s), the whole log each time');
  const again = [];
  arrivalsModule.createArrivals({ traffic: counted(logAt(home)) }).subscribe(function (m) { again.push(m.hash); });
  if (again.length === 0) test.check('and they are marked taken, so the next page gets none');
  else test.fail('replayed again: ' + JSON.stringify(again));
  removeHome(home);
})();

(function cheapWithALongLog() {
  test.subHeading('3. cheap with a long log');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-backlog-long-'));
  const log = logAt(home);
  const text = packet.encode('agents', { text: 'x' }).text;
  landed(log, 'seed', text);
  log.taken(['seed']);
  // TWENTY THOUSAND TAKEN ROWS IN ONE TRANSACTION, written to the table directly ("tests can read what they need to
  // read", arrivals.js): one note() a row is a write to disk each, and 20,000 of them did not finish in five minutes.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(require('../run/js/nodeStore.js').dbPath(home));
  const put = db.prepare('INSERT INTO traffic (at, dir, kind, peer, relay, hash, outcome, admitted, payload, mark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const t0 = Date.parse('2026-09-22T00:00:00Z');
  db.exec('BEGIN');
  for (let i = 0; i < 20000; i += 1) {
    const at = new Date(t0 + i * 1000).toISOString();
    put.run(at, 'in', 'request', 'PEERKEY', 'https://relay.example', 'h' + i, 'delivered', 1, text, null);
    put.run(at, 'out', null, null, null, 'h' + i, null, null, null, 'taken');
  }
  db.exec('COMMIT');
  db.close();
  landed(log, 'waiting', text);
  const fresh = logAt(home);
  let t = process.hrtime.bigint();
  fresh.read();
  const readMs = Number(process.hrtime.bigint() - t) / 1e6;
  const got = [];
  t = process.hrtime.bigint();
  arrivalsModule.createArrivals({ traffic: logAt(home) }).subscribe(function (m) { got.push(m.hash); });
  const subMs = Number(process.hrtime.bigint() - t) / 1e6;
  if (got.join(',') === 'waiting') test.check('over 20,000 taken rows the one waiting row comes back');
  else test.fail('over 20,000 rows the page got ' + JSON.stringify(got.slice(0, 3)) + ' (' + got.length + ')');
  if (subMs < readMs / 5) test.check('subscribing took ' + subMs.toFixed(1) + ' ms, reading the whole log ' + readMs.toFixed(1) + ' ms');
  else test.fail(OWED + 'subscribing took ' + subMs.toFixed(1) + ' ms, reading the whole log ' + readMs.toFixed(1) + ' ms: not under a fifth');
  removeHome(home);
})();

test.reportSuccessFailureCount();
