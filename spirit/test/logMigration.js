'use strict';

// spirit/test/logMigration.js
// THE OLD LOG FILE MOVES INTO THE TABLE — transport/R19.5, written FIRST.
//
//   Andy, 2026-09-28: go on transport/R19.5, under his rule "they must be
//   red before wsl pulls the implementation, and green after".
//
// The contract, agreed with claude-windows before the build: rule 1 says
// nothing above trafficLog.js changes, so there is no new export for the
// node to call. The first time a log is opened with traffic.jsonl present,
// trafficLog imports it into node.db's table in ONE transaction and renames
// it traffic.jsonl.imported, which is never read again. The copy to Andy's
// Drive folder ("backup the old file to D:\countinn@google.com\SpiritOS-data-backup
// as well") is a one-off step on his machine, done by hand with his go, so
// it is not tested here: T1 holds that the original bytes survive.
//
// The fixture is a node as it stands today: a history in traffic.jsonl
// (written before transport/R19.3) and newer rows already in the table
// (written since), put there through nodeStore so nothing opens the log
// before the test means it to.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const trafficLog = require('../run/js/trafficLog.js');
const nodeStore = require('../run/js/nodeStore.js');

test.startTest('transport/R19.5: the old log file is imported, checked, and retired');

const OWED = 'OWED by transport/R19.5: ';
const PEER = 'MCowBQYDK2VwAyEAlogMigrationPeer00000000000000000000=';

function makeHome(tag) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-logmig-' + tag + '-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  const t0 = Date.parse('2026-09-20T00:00:00.000Z');
  const lines = [];
  for (let i = 0; i < 40; i++) {
    const at = new Date(t0 + i * 60000).toISOString();
    if (i % 10 === 3) lines.push({ at: at, dir: 'in', kind: 'owner', event: 'claim-taken', peer: PEER });
    else if (i % 10 === 5) lines.push({ at: at, dir: 'out', peer: PEER, outcome: 'refused', hash: '' });
    else if (i % 2 === 0) lines.push({ at: at, dir: 'in', kind: 'request', peer: PEER, outcome: 'received', admitted: true, hash: 'old-' + i });
    else lines.push({ at: at, dir: 'out', kind: 'request', peer: PEER, outcome: 'sent', hash: 'old-' + i });
  }
  lines.push({ at: new Date(t0 + 41 * 60000).toISOString(), mark: 'taken', hash: 'old-2' });
  const file = path.join(home, 'relay-state', 'traffic.jsonl');
  fs.writeFileSync(file, lines.map(function (l) { return JSON.stringify(l); }).join('\n') + '\n');
  const newer = [
    { at: '2026-09-28T08:00:00.000Z', dir: 'in', kind: 'request', peer: PEER, outcome: 'received', admitted: true, hash: 'new-1' },
    { at: '2026-09-28T08:01:00.000Z', dir: 'in', kind: 'owner', event: 'invite-minted', peer: PEER },
  ];
  const t = nodeStore.open(home).traffic;
  newer.forEach(function (r) { t.add(r); });
  return { home: home, lines: lines, newer: newer, file: file };
}

// WHAT THE LOG SHOULD ANSWER, worked out from the fixture itself, because
// opening the log to ask would already be the migration under test.
function expected(h) {
  const rows = h.lines.concat(h.newer);
  const taken = Object.create(null);
  rows.forEach(function (r) { if (r.mark === 'taken' && r.hash) taken[r.hash] = r.at; });
  const hist = rows.filter(function (r) { return !r.mark; }).map(function (r) {
    if (!taken[r.hash]) return r;
    const out = Object.assign({}, r);
    out.takenAt = taken[r.hash];
    return out;
  }).sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
  return canon({
    read: hist,
    owner: hist.filter(function (r) { return r.kind === 'owner'; }).slice(0, 200),
    arrivals: hist.filter(function (r) { return r.dir === 'in' && r.admitted; }).slice(0, 200),
  });
}
function view(home) {
  const log = trafficLog.createTrafficLog({ rootDir: home });
  return canon({ read: log.read(), owner: log.ownerEvents({}), arrivals: log.arrivals({}) });
}
function tableRows(home) { return nodeStore.open(home).traffic.all(); }
function done(home) {
  try { nodeStore.open(home).close(); } catch (e) { /* nothing open */ }
  fs.rmSync(home, { recursive: true, force: true });
}
// KEY ORDER IS NOT CONTENT: a table row comes back in column order, a file
// row in the order it was written. Compared with keys sorted.
function canon(v) {
  return JSON.stringify(v, function (k, x) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return x;
    const o = {};
    Object.keys(x).sort().forEach(function (key) { o[key] = x[key]; });
    return o;
  });
}
const same = function (a, b) { return canon(a) === canon(b); };

// ── ONE MIGRATION, CHECKED FIVE WAYS ─────────────────────────────────
const h = makeHome('a');
const fileBytes = fs.readFileSync(h.file);
const want = expected(h);
const tableBefore = tableRows(h.home).length;
let firstView = '';
let opened = null;
try { firstView = view(h.home); } catch (e) { opened = e.message; }
const retired = h.file + '.imported';
const after = tableRows(h.home);
const imported = after.slice(tableBefore);

test.subHeading('T1: the old file\'s bytes survive, renamed, and it is no longer traffic.jsonl');
if (!opened && !fs.existsSync(h.file) && fs.existsSync(retired) && fs.readFileSync(retired).equals(fileBytes)) {
  test.check('traffic.jsonl became traffic.jsonl.imported, byte for byte');
} else {
  test.fail(OWED + (opened || 'traffic.jsonl ' + (fs.existsSync(h.file) ? 'is still in place' : 'is gone') +
    ', traffic.jsonl.imported ' + (fs.existsSync(retired) ? 'differs from the original' : 'does not exist')));
}

test.subHeading('T2: every line becomes a row; first and last match exactly');
if (after.length === tableBefore + h.lines.length && imported.length
    && same(imported[0], h.lines[0]) && same(imported[imported.length - 1], h.lines[h.lines.length - 1])) {
  test.check(h.lines.length + ' lines became ' + h.lines.length + ' new rows; the first and last row are the first and last line');
} else {
  test.fail(OWED + 'the table has ' + after.length + ' rows, expected ' + (tableBefore + h.lines.length));
}

test.subHeading('T3: seq follows the file\'s order');
if (imported.length === h.lines.length && imported.every(function (r, i) { return same(r, h.lines[i]); })) {
  test.check('the imported rows, in seq order, are the file\'s lines in the file\'s order');
} else {
  test.fail(OWED + 'the imported rows are not the file\'s lines in order');
}

test.subHeading('T4: the history is the same the moment the log opens');
if (!opened && firstView === want && !fs.existsSync(h.file)) {
  test.check('read(), owner events and arrivals on first opening equal the history before the move');
} else {
  test.fail(OWED + (opened || (firstView === want ? 'no move happened on first opening' : 'the history on first opening differs from before the move')));
}

test.subHeading('T5: after a restart the history is identical, and the retired file is never read');
// Anything added to the retired file must not appear: the table alone answers.
const hadRetired = fs.existsSync(retired);
if (hadRetired) try { fs.appendFileSync(retired, JSON.stringify({ at: '2026-09-28T09:00:00.000Z', dir: 'in', kind: 'owner', event: 'not-read', peer: PEER }) + '\n'); } catch (e) { /* no retired file: T1 said so */ }
let again = '';
try { again = view(h.home); } catch (e) { again = ''; }
if (hadRetired && again === want && tableRows(h.home).length === after.length) {
  test.check('a second opening imports nothing twice and reads nothing from traffic.jsonl.imported');
} else {
  test.fail(OWED + 'after a restart the history differs, rows were imported twice, or the retired file was read');
}
done(h.home);

// ── T6: THE WAY BACK ──────────────────────────────────────────────────
test.subHeading('T6: a failure half-way leaves the table as it was and the file in charge');
const f = makeHome('b');
const fBytes = fs.readFileSync(f.file);
const fWant = expected(f);
const fTable = tableRows(f.home).length;
// Forced from outside the product: the 20th imported row fails.
nodeStore.open(f.home).close();
{
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(f.home, 'relay-state', 'node.db'));
  db.exec('CREATE TRIGGER fail_halfway BEFORE INSERT ON traffic WHEN (SELECT COUNT(*) FROM traffic) >= ' + (fTable + 20) +
    " BEGIN SELECT RAISE(ABORT, 'forced half-way failure'); END;");
  db.close();
}
let fView = '';
let fErr = null;
try { fView = view(f.home); } catch (e) { fErr = e.message; }
const fAfter = tableRows(f.home).length;
const fileInCharge = fs.existsSync(f.file) && fs.readFileSync(f.file).equals(fBytes) && !fs.existsSync(f.file + '.imported');
// Without the migration, "nothing changed" is trivially true; the retry is
// what shows there was a migration to fail.
{
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(f.home, 'relay-state', 'node.db'));
  db.exec('DROP TRIGGER fail_halfway');
  db.close();
}
nodeStore.open(f.home).close();
let retried = '';
try { retried = view(f.home); } catch (e) { retried = ''; }
const retriedOk = !fs.existsSync(f.file) && fs.existsSync(f.file + '.imported') && tableRows(f.home).length === fTable + f.lines.length;
if (!fErr && fAfter === fTable && fileInCharge && fView === fWant && retriedOk && retried === fWant) {
  test.check('a forced failure imported nothing and the node kept its whole history from the file; the next opening finished the move');
} else {
  test.fail(OWED + (fErr ? 'opening the log threw: ' + fErr : 'after a failure half-way: table ' + fTable + ' -> ' + fAfter +
    ' rows, file in charge ' + fileInCharge + ', history unchanged ' + (fView === fWant) + ', retry finished the move ' + retriedOk));
}
done(f.home);

test.reportSuccessFailureCount();
