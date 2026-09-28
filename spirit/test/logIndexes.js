'use strict';

// spirit/test/logIndexes.js
// THE LOG'S READERS USE ITS INDEXES — transport/R19.4, written FIRST.
//
//   Andy, 2026-09-28: "they must be red before wsl pulls the
//   implementation, and green after he pull the implementation", and go on
//   transport/R19.4. Decided with the keys ("i agree to the keys as well"):
//     (1) hash, skipping blank hashes         — byHash, taken
//     (2) at, over owner rows only            — ownerEvents
//     (3) at, over admitted incoming rows     — arrivals
//   read() returns everything, so no index helps it and none is asked for.
//
// HOW "USES ITS INDEX" IS SEEN, without adding anything to the product: the
// suite records the SQL each reader actually runs (node:sqlite's
// StatementSync, wrapped here only), then asks SQLite for that statement's
// query plan. A reader that runs no SQL, or whose plan scans the whole
// table, has not used an index.

const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite = require('node:sqlite');
const test = require('./testSupport.js');

test.startTest('transport/R19.4: the node log\'s readers use their indexes');

const OWED = 'OWED by transport/R19.4: ';

// ── THE RECORDER ──────────────────────────────────────────────────────
let ran = null;
['all', 'get', 'iterate', 'run'].forEach(function (m) {
  const orig = sqlite.StatementSync.prototype[m];
  sqlite.StatementSync.prototype[m] = function () {
    if (ran && /\btraffic\b/.test(this.sourceSQL || '')) ran.push(this.sourceSQL);
    return orig.apply(this, arguments);
  };
});
function recording(fn) {
  ran = [];
  const out = fn();
  const sql = ran;
  ran = null;
  return { out: out, sql: sql };
}

const { createTrafficLog } = require('../run/js/trafficLog.js');
const nodeStore = require('../run/js/nodeStore.js');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-logindexes-'));
const dbFile = path.join(root, 'relay-state', 'node.db');
const PEER = 'MCowBQYDK2VwAyEAlogIndexesPeer0000000000000000000000=';
const log = createTrafficLog({ rootDir: root });

// Enough rows of every kind that a plan has a real choice to make.
for (let i = 0; i < 300; i++) {
  log.note({ dir: 'out', kind: 'request', peer: PEER, outcome: 'sent', hash: 'out-' + i });
  log.note({ dir: 'in', kind: 'request', peer: PEER, outcome: 'received', admitted: i % 2 === 0, hash: 'in-' + i });
  log.note({ dir: 'out', peer: PEER, outcome: 'refused', reason: 'no-seal-key' });
}
log.note({ dir: 'in', kind: 'owner', event: 'claim-taken', peer: PEER });
log.note({ dir: 'in', kind: 'request', peer: PEER, outcome: 'first', admitted: true, hash: 'twice' });
log.note({ dir: 'in', kind: 'request', peer: PEER, outcome: 'second', admitted: true, hash: 'twice' });
log.note({ dir: 'in', kind: 'owner', event: 'invite-minted', peer: PEER });

function plan(sql) {
  const { DatabaseSync } = sqlite;
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    const st = db.prepare('EXPLAIN QUERY PLAN ' + sql);
    const n = (sql.match(/\?/g) || []).length;
    return st.all.apply(st, new Array(n).fill(null)).map(function (r) { return r.detail; }).join(' | ');
  } finally { db.close(); }
}
function indexed(sql) {
  const p = plan(sql);
  return { ok: /USING (COVERING )?INDEX/.test(p) && !/\bSCAN traffic\b(?! USING)/.test(p), plan: p };
}
function indexes() {
  if (!fs.existsSync(dbFile)) return [];
  const db = new sqlite.DatabaseSync(dbFile, { readOnly: true });
  try {
    return db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'traffic' AND sql IS NOT NULL").all();
  } finally { db.close(); }
}

// ── T1 ────────────────────────────────────────────────────────────────
test.subHeading('T1: all three indexes exist');
const idx = indexes();
const onHash = idx.find(function (i) { return /\(\s*"?hash"?\s*\)/i.test(i.sql) && /WHERE/i.test(i.sql); });
const onOwner = idx.find(function (i) { return /"?at"?/i.test(i.sql) && /WHERE[\s\S]*kind[\s\S]*owner/i.test(i.sql); });
const onArrivals = idx.find(function (i) { return /"?at"?/i.test(i.sql) && /WHERE[\s\S]*\bdir\b\s*=\s*'in'/i.test(i.sql) && /WHERE[\s\S]*\badmitted\b/i.test(i.sql); });
if (onHash && onOwner && onArrivals) {
  test.check('three partial indexes on the log: hash skipping blanks, owner rows by time, admitted arrivals by time');
} else {
  test.fail(OWED + 'missing: ' + [!onHash && 'hash (partial)', !onOwner && 'at over owner rows', !onArrivals && 'at over admitted incoming rows']
    .filter(Boolean).join(', ') + ' (found ' + JSON.stringify(idx.map(function (i) { return i.name; })) + ')');
}

// ── T2 ────────────────────────────────────────────────────────────────
test.subHeading('T2: each reader\'s query plan uses an index, not a full scan');
const readers = {
  byHash: function () { return log.byHash('in-4'); },
  taken: function () { return log.taken(['in-6']); },
  ownerEvents: function () { return log.ownerEvents({}); },
  arrivals: function () { return log.arrivals({ since: '2000-01-01T00:00:00.000Z' }); },
};
Object.keys(readers).forEach(function (name) {
  const r = recording(readers[name]);
  const reads = r.sql.filter(function (s) { return /^\s*SELECT/i.test(s); });
  const verdicts = reads.map(indexed);
  if (reads.length && verdicts.every(function (v) { return v.ok; })) {
    test.check(name + '() reads the log through an index (' + verdicts[0].plan + ')');
  } else {
    test.fail(OWED + name + '() ' + (reads.length ? 'scans: ' + verdicts.map(function (v) { return v.plan; }).join(' / ') : 'runs no SQL of its own: it reads the whole log and filters it'));
  }
});

// ── T3 ────────────────────────────────────────────────────────────────
test.subHeading('T3: byHash returns the latest row, and rows with no hash stay out of the hash index');
const latest = log.byHash('twice');
const partialBlank = onHash && /hash\s*(<>|!=)\s*''|hash\s+IS\s+NOT\s+NULL[\s\S]*<>|length\(\s*"?hash"?\s*\)\s*>\s*0/i.test(onHash.sql);
if (latest && latest.outcome === 'second' && partialBlank) {
  test.check('byHash("twice") is the second row, and the hash index excludes blank hashes (' + onHash.sql.replace(/\s+/g, ' ') + ')');
} else {
  test.fail(OWED + 'byHash latest: ' + (latest && latest.outcome) + '; hash index excluding blanks: ' + (onHash ? onHash.sql : 'none'));
}

// ── T4 ────────────────────────────────────────────────────────────────
test.subHeading('T4: ownerEvents and arrivals give the same answers as filtering the whole log, from the table');
const all = log.read();
const wantOwner = JSON.stringify(all.filter(function (r) { return r.kind === 'owner'; }).slice(0, 200));
const wantArrivals = JSON.stringify(all.filter(function (r) { return r.dir === 'in' && r.admitted; }).slice(0, 200));
const gotOwner = recording(function () { return log.ownerEvents({}); });
const gotArrivals = recording(function () { return log.arrivals({}); });
const sameOwner = JSON.stringify(gotOwner.out) === wantOwner;
const sameArrivals = JSON.stringify(gotArrivals.out) === wantArrivals;
// FROM THE TABLE means an indexed query of its own, not the whole-log read
// every reader already does today: that one would make this check pass on
// the old code, where it is worth nothing.
function asked(r) { return r.sql.some(function (q) { return /^\s*SELECT/i.test(q) && indexed(q).ok; }); }
const fromTable = asked(gotOwner) && asked(gotArrivals);
if (sameOwner && sameArrivals && fromTable) {
  test.check('ownerEvents and arrivals answer exactly what filtering read() answers, and each asked the table through its index');
} else {
  test.fail(OWED + 'same answers: owner ' + sameOwner + ', arrivals ' + sameArrivals + '; asked the table through an index: ' + fromTable);
}

nodeStore.open(root).close();
fs.rmSync(root, { recursive: true, force: true });
test.reportSuccessFailureCount();
