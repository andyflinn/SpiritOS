'use strict';

// spirit/test/logTable.js
// THE NODE LOG AS A TABLE IN node.db — transport/R19.3, written FIRST.
//
//   Andy, 2026-09-28: "they must be red before wsl pulls the
//   implementation, and green after he pull the implementation", and "on
//   go, the tests should be run ASAP against the unmodified production code.
//   if they are green then, they may be worth less". His go on R19.3 came
//   with that rule, so every check here is red until the table is built.
//
//   Decided (Andy: "i agree to the keys as well"): seq INTEGER PRIMARY KEY
//   AUTOINCREMENT, every field a column, every row kept. The table is found
//   by that key, not by a name, so the build may name it.
//
//   T5, rule 1 ("nothing above trafficLog.js changes"), is a GUARD, not
//   proof: storeOwnership.js holds it and must stay green throughout.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const { createTrafficLog } = require('../run/js/trafficLog.js');

test.startTest('transport/R19.3: the node log is a table in node.db, keyed by seq');

const OWED = 'OWED by transport/R19.3: ';
const PEER = 'MCowBQYDK2VwAyEAlogTablePeer000000000000000000000000=';
const RELAY = 'https://relay.example';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-logtable-'));
const dbFile = path.join(root, 'relay-state', 'node.db');
const log = createTrafficLog({ rootDir: root });
log.note({ dir: 'out', kind: 'request', peer: PEER, relay: RELAY, outcome: 'sent', hash: 'h-1' });
log.note({ dir: 'in', kind: 'reply', peer: PEER, relay: RELAY, outcome: 'receipted', hash: 'h-1' });
log.note({ dir: 'out', peer: PEER, outcome: 'refused', reason: 'no-seal-key' });

// Reads node.db the way a person would, and closes it again.
function withDb(fn, writable) {
  if (!fs.existsSync(dbFile)) return null;
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbFile, writable ? {} : { readOnly: true });
  try { return fn(db); } finally { db.close(); }
}
function logTable() {
  return withDb(function (db) {
    const t = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'").all()
      .find(function (r) { return /\bseq\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/i.test(r.sql || ''); });
    return t ? t.name : null;
  });
}
function rowCount(name) {
  return withDb(function (db) { return db.prepare('SELECT COUNT(*) AS n, MAX(seq) AS top FROM "' + name + '"').get(); });
}

// ── T1 ────────────────────────────────────────────────────────────────
test.subHeading('T1: the table exists, keyed by seq, with a column for every field');
const table = logTable();
const fields = Object.create(null);
log.read().forEach(function (r) { Object.keys(r).forEach(function (k) { fields[k] = true; }); });
const cols = table ? withDb(function (db) { return db.prepare('PRAGMA table_info("' + table + '")').all().map(function (c) { return c.name; }); }) : [];
const missing = Object.keys(fields).filter(function (k) { return cols.indexOf(k) === -1; });
if (table && !missing.length) {
  test.check('node.db holds the log table "' + table + '", seq INTEGER PRIMARY KEY AUTOINCREMENT, and every field written has a column');
} else {
  test.fail(OWED + (table ? 'the table lacks columns for ' + JSON.stringify(missing) : 'no table in node.db is keyed by seq INTEGER PRIMARY KEY AUTOINCREMENT'));
}

// ── T2 ────────────────────────────────────────────────────────────────
test.subHeading('T2: each note() adds exactly one row, with the next seq');
const before = table ? rowCount(table) : null;
log.note({ dir: 'out', kind: 'request', peer: PEER, relay: RELAY, outcome: 'sent', hash: 'h-2' });
const after = table ? rowCount(table) : null;
if (before && after && after.n === before.n + 1 && after.top === before.top + 1) {
  test.check('one note() is one row, and its seq is the one after the last');
} else {
  test.fail(OWED + 'one note() did not add exactly one row with the next seq (before ' + JSON.stringify(before) + ', after ' + JSON.stringify(after) + ')');
}

// ── T3 ────────────────────────────────────────────────────────────────
test.subHeading('T3: a seq is never reused, even after the newest row is deleted');
let dropped = null;
if (table) {
  dropped = rowCount(table).top;
  withDb(function (db) { db.prepare('DELETE FROM "' + table + '" WHERE seq = ?').run(dropped); }, true);
  log.note({ dir: 'out', kind: 'request', peer: PEER, relay: RELAY, outcome: 'sent', hash: 'h-3' });
}
const next = table ? rowCount(table).top : null;
if (table && next > dropped) {
  test.check('with the newest row deleted, the next note() still gets a higher seq (' + dropped + ' is never used again)');
} else {
  test.fail(OWED + 'seq was reused or there is no table (deleted ' + dropped + ', next ' + next + ')');
}

// ── T4 ────────────────────────────────────────────────────────────────
test.subHeading('T4: read() answers from the table: the same rows, in the same order, with the file gone');
const expected = JSON.stringify(log.read());
try { fs.unlinkSync(path.join(root, 'relay-state', 'traffic.jsonl')); } catch (e) { /* not there: fine */ }
const fresh = createTrafficLog({ rootDir: root });
const got = JSON.stringify(fresh.read());
if (expected !== '[]' && got === expected) {
  test.check('with traffic.jsonl deleted, a fresh log reads back every row, in order, unchanged');
} else {
  test.fail(OWED + 'with traffic.jsonl deleted, read() returned ' + (got === '[]' ? 'nothing' : 'different rows'));
}

fs.rmSync(root, { recursive: true, force: true });
test.reportSuccessFailureCount();
