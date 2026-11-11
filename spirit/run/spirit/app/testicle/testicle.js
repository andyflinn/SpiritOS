'use strict';
require('../../spirit.js');

// spirit/run/spirit/app/testicle/testicle.js
// TESTICLE'S SERVER (goal/G47.1, the server cycle). Its contract and its test: ./test/testicle.md and ./test/testicle.js.
//
// The box (goal/G47.1): "This cycle builds testicle's server, which keeps the first two tables of testicle.db, file and
// suite, in sync with run:// by itself", "on any change of a product file it makes sure that file has its row, and a suite
// row for every suite that concerns it", "When a suite or a product file is changed or added, the server adjusts the two
// tables file and suite by itself", "A product file or a suite that has not changed has no row in the database yet:
// nothing is read at start", "A removed file's row is marked deleted", "Any change in files is reflected in the database
// 1 second after it occurs", "The suites that concern a file: its own test/<name>.js, and the general tests that would
// include that production file if they were run without a file argument", "The server takes a file's suites from
// testModule.js, run as its own process, as deskVerify does: run with no file, it keeps the file's own test and the
// general tests' entries that name that file. testModule.js does not move.", "The testicle server will serve one first
// verb, \"busy\": it returns true if it is doing any work, false if it is idle." The columns are goal/G45.1's box.
//
// WHAT IT DOES:
//   - it watches run:// with the node's own watcher (spirit/job/chokidar), nothing read at start (ignoreInitial);
//   - a changed .js in a test/ folder is a suite, any other .js a product file; the node's state, .git and vendored
//     code are never watched, and a file that is no script is let go;
//   - the changes of one moment are taken together: testModule.js is run once, as its own process (a test file is run,
//     never loaded: spirit-sibling-testReachRules.js), and the rows are written in one transaction.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const appServer = spirit.require('spirit/appServer.js');
const { VENDORED_FOLDERS } = spirit.require('spirit/fileSystem.js');
const { createProbabilityBucket } = spirit.require('spirit/probabilityBucket.js');
const { probabilityStringObjectMatch } = spirit.require('spirit/probabilityStringObjectMatch.js');
const limits = spirit.require('spirit/limits.js');
// What one search answer holds once its frame is counted (as the agent's tables count it, rowTable.js).
const SEARCH_ROOM = limits.ANSWER_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');

const argv = process.argv;
function arg(name) { const at = argv.indexOf(name); return at !== -1 ? argv[at + 1] : ''; }

// ITS STATE IS THE NODE'S TO NAME (desk/G1 D5): spirit/state/testicle/data/, handed over as --state.
const STATE = arg('--state');
if (!STATE) {
  console.error('testicle: no --state; the node that starts this names its state folder');
  process.exit(2);
}
fs.mkdirSync(STATE, { recursive: true });
// run://, the tree it keeps: three folders above this one.
const RUN = path.resolve(__dirname, '..', '..', '..');
const TEST_MODULE = path.join(RUN, 'spirit', 'test', 'testModule.js');

// THE TWO TABLES OF testicle.db (goal/G45.1's box), script and suite. A boolean is 0 or 1; changed is a numeric UTC timestamp.
// goal/G47.1, the box: "This cycle will also rename the \"file\" table to \"script\"", "The name changes everywhere it
// means that table", "An existing testicle.db is renamed in place, its rows kept."
const db = new DatabaseSync(path.join(STATE, 'testicle.db'));
const tableThere = function (name) { return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name); };
if (tableThere('file') && !tableThere('script')) db.exec('ALTER TABLE file RENAME TO script');
if (tableThere('suite') && db.prepare('PRAGMA table_info(suite)').all().some(function (c) { return c.name === 'file'; })) db.exec('ALTER TABLE suite RENAME COLUMN file TO script');
db.exec('CREATE TABLE IF NOT EXISTS script (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT \'\', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS suite (script TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, ' +
  'hash TEXT NOT NULL DEFAULT \'\', outcome TEXT NOT NULL DEFAULT \'\', changed INTEGER NOT NULL, PRIMARY KEY (script, suite))');
const Q = {
  script: db.prepare('SELECT * FROM script WHERE name = ?'),
  putScript: db.prepare('INSERT INTO script (name, hash, deleted, changed) VALUES (?, ?, 0, ?) ON CONFLICT(name) DO UPDATE SET hash = excluded.hash, deleted = 0, changed = excluded.changed'),
  goneScript: db.prepare('INSERT INTO script (name, hash, deleted, changed) VALUES (?, \'\', 1, ?) ON CONFLICT(name) DO UPDATE SET deleted = 1, changed = excluded.changed'),
  // A suite row flagged test: the suite needs running (goal/G45.1). Its outcome is kept: nothing runs a suite yet.
  putSuite: db.prepare('INSERT INTO suite (script, suite, test, deleted, hash, outcome, changed) VALUES (?, ?, 1, 0, ?, \'\', ?) ' +
    'ON CONFLICT(script, suite) DO UPDATE SET test = 1, deleted = 0, hash = excluded.hash, changed = excluded.changed'),
  goneSuitesOfScript: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE script = ? AND deleted = 0'),
  goneRowsOfSuite: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE suite = ? AND deleted = 0'),
  suitesOfScript: db.prepare('SELECT * FROM suite WHERE script = ? ORDER BY suite'),
  rowsOfSuite: db.prepare('SELECT * FROM suite WHERE suite = ?'),
  suiteRow: db.prepare('SELECT * FROM suite WHERE script = ? AND suite = ?'),
};

// THE TABLE testicle (goal/G45.1's box; goal/G47.1, the test-table cycle; renamed from test in the rename cycle, the box:
// "The testicle test table is renamed \"testicle\""; Andy: "no fucking data-rescue missions!", so an older table test is
// left as it is, never moved over). One row per flip: a test's history is its rows, its
// status now its current one. The box: "If the test does not flip, the current row is only updated with the last checked
// date, and, if it exists, the hash of the product file", "If the test flips, a new active row is created; this will keep
// change history", "The server applies the severity to the row only if the new severity is higher than the old one" (on a
// flip the old one is the row it replaces: a test's severity never goes down). "One index over the current rows, by
// verified, then severity from high to low, then flipped" (G45.1): every test search reads the current rows alone.
db.exec('CREATE TABLE IF NOT EXISTS testicle (script TEXT NOT NULL, suite TEXT NOT NULL, test TEXT NOT NULL, flipped INTEGER NOT NULL, ' +
  'current INTEGER NOT NULL DEFAULT 1, verified INTEGER NOT NULL, tested INTEGER NOT NULL, judged TEXT NOT NULL DEFAULT \'\', ' +
  'severity REAL NOT NULL DEFAULT 0, PRIMARY KEY (script, suite, test, flipped))');
db.exec('CREATE INDEX IF NOT EXISTS testicle_current ON testicle (verified, severity DESC, flipped DESC) WHERE current = 1');
const T = {
  current: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? AND current = 1'),
  add: db.prepare('INSERT INTO testicle (script, suite, test, flipped, current, verified, tested, judged, severity) VALUES (?, ?, ? , ?, 1, ?, ?, ?, ?)'),
  tested: db.prepare('UPDATE testicle SET tested = ?, judged = ?, severity = MAX(severity, ?) WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  retire: db.prepare('UPDATE testicle SET current = 0 WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  // The current rows, most severe first, the newest flip first among equals (the index's order).
  currents: db.prepare('SELECT * FROM testicle WHERE current = 1 ORDER BY severity DESC, flipped DESC'),
  reds: db.prepare('SELECT * FROM testicle WHERE current = 1 AND verified = 0 ORDER BY severity DESC, flipped DESC'),
  row: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  // A test's history: every row of it, the newest flip first.
  history: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? ORDER BY flipped DESC'),
};
// A test row as the verbs and the stream carry it: its key its full key, script|suite|test|flipped, its booleans booleans
// (goal/G47.1, the box: "the page keeps test rows by their full key, script|suite|test|flipped, and shows a test's current
// row"), so a flipped test's replaced row and its current row are two rows wherever they are kept.
function testServed(r) {
  return { key: r.script + '|' + r.suite + '|' + r.test + '|' + Number(r.flipped), script: r.script, suite: r.suite, test: r.test, flipped: Number(r.flipped), current: !!r.current,
    verified: !!r.verified, tested: Number(r.tested), judged: r.judged, severity: Number(r.severity) };
}

function posix(p) { return String(p).split(path.sep).join('/'); }
function hashOf(rel) { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(RUN, rel))).digest('hex'); } catch (e) { return ''; } }
function there(rel) { try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; } }
// Never watched: the node's state (this database among it), .git, and vendored code, as testModule.js skips them.
function ignored(full) {
  const rel = posix(path.relative(RUN, path.resolve(full)));
  if (!rel || rel.indexOf('..') === 0) return false;
  return rel.split('/').some(function (part) { return part === 'state' || part === 'app-state' || part === '.git'; }) || VENDORED_FOLDERS.holds(path.join(RUN, rel));
}
// A suite is a .js in a test/ folder; any other .js is a product file.
function isSuite(rel) { return path.posix.basename(path.posix.dirname(rel)) === 'test'; }
// A product file's own test, ./test/<name>.js, and back.
function ownTestOf(file) { return path.posix.join(path.posix.dirname(file), 'test', path.posix.basename(file)); }
function fileOfOwnTest(suite) { return path.posix.join(path.posix.dirname(path.posix.dirname(suite)), path.posix.basename(suite)); }

// THE PAIRS testModule.js NAMES, run as its own process with no file: "<test> <file>" for a general test and the file it
// judges, "<test>" for a test that is no general one.
function pairs() {
  return new Promise(function (resolve, reject) {
    execFile(process.execPath, [TEST_MODULE], { cwd: RUN, encoding: 'utf8', maxBuffer: 1 << 26 }, function (err, out) {
      if (err) return reject(err);
      const byFile = Object.create(null);
      const bySuite = Object.create(null);
      const tests = Object.create(null);
      String(out).split('\n').filter(Boolean).forEach(function (l) {
        const p = l.split(' ');
        tests[p[0]] = true;
        if (!p[1]) return;
        (byFile[p[1]] = byFile[p[1]] || []).push(p[0]);
        (bySuite[p[0]] = bySuite[p[0]] || []).push(p[1]);
      });
      resolve({ byFile: byFile, bySuite: bySuite, tests: tests });
    });
  });
}

// ONE MOMENT'S CHANGES, WRITTEN TOGETHER.
function apply(changed, P) {
  const now = Date.now();
  const hashes = Object.create(null);
  const hash = function (rel) { if (!(rel in hashes)) hashes[rel] = hashOf(rel); return hashes[rel]; };
  // A file's row made or brought up to date, as it stands on disc.
  // What it wrote, published once the transaction stands (goal/G47.1, the UI cycle: "the server, of course, publishes
  // changes"): every file row and every suite row it touched, as they then stand.
  const files = new Set();
  const written = new Map();
  const touched = function (file, suite) { written.set(file + '|' + suite, [file, suite]); };
  const fileUp = function (file) { Q.putScript.run(file, hash(file), now); files.add(file); };
  const suiteUp = function (file, suite) { Q.putSuite.run(file, suite, hash(suite), now); touched(file, suite); };
  db.exec('BEGIN');
  try {
    changed.forEach(function (rel) {
      if (isSuite(rel)) {
        if (!there(rel)) { Q.rowsOfSuite.all(rel).forEach(function (r) { touched(r.script, r.suite); }); Q.goneRowsOfSuite.run(now, rel); return; }
        // The files it concerns: the one it is the own test of, and every file a general test judges.
        const files = (P.bySuite[rel] || []).slice();
        const own = fileOfOwnTest(rel);
        if (there(own) && files.indexOf(own) === -1) files.push(own);
        files.forEach(function (file) { if (!Q.script.get(file)) fileUp(file); suiteUp(file, rel); });
        return;
      }
      if (!there(rel)) { Q.goneScript.run(rel, now); files.add(rel); Q.suitesOfScript.all(rel).forEach(function (r) { touched(r.script, r.suite); }); Q.goneSuitesOfScript.run(now, rel); return; }
      const row = Q.script.get(rel);
      if (row && !row.deleted && row.hash === hash(rel)) return; // the same bytes: nothing changed
      fileUp(rel);
      const suites = (P.byFile[rel] || []).slice();
      const own = ownTestOf(rel);
      if (there(own) && suites.indexOf(own) === -1) suites.push(own);
      suites.forEach(function (suite) { suiteUp(rel, suite); });
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  files.forEach(function (file) { const r = Q.script.get(file); if (r) appServer.publish({ testicle: { table: 'script', row: served(r) } }); });
  written.forEach(function (p) { const r = Q.suiteRow.get(p[0], p[1]); if (r) appServer.publish({ testicle: { table: 'suite', row: suiteServed(r) } }); });
}

// THE QUEUE: what changed since the last write, and whether a write is under way. busy is either, or a script.get making
// rows.
const pending = new Set();
let working = false;
let timer = null;
let getting = 0;
function kick() {
  if (working || timer || !pending.size) return;
  // The changes of one moment taken together: a save is often several events.
  timer = setTimeout(function () {
    timer = null;
    working = true;
    const changed = Array.from(pending);
    pending.clear();
    pairs().then(function (P) { apply(changed, P); }).then(null, function (e) {
      console.error('testicle: ' + (e && e.message || e));
    }).then(function () { working = false; kick(); });
  }, 50);
}

const watcher = spirit.require('spirit/job/chokidar/index.js').watch(RUN, { ignored: ignored, ignoreInitial: true, persistent: true });
watcher.on('all', function (event, full) {
  if (['add', 'change', 'unlink'].indexOf(event) === -1 || !full) return;
  const rel = posix(path.relative(RUN, full));
  if (!rel || rel.indexOf('..') === 0 || !/\.js$/.test(rel)) return;
  pending.add(rel);
  kick();
});
watcher.on('error', function (e) { console.error('testicle: the watcher: ' + (e && e.message || e)); });

// A script row as a verb answers it: its deleted a boolean.
function served(row) { return { name: row.name, hash: row.hash, deleted: !!row.deleted, changed: Number(row.changed) }; }
// A suite row as a search and the stream carry it: its key script|suite, its status "needs running" while it is flagged.
function suiteServed(r) { return { key: r.script + '|' + r.suite, script: r.script, suite: r.suite, test: !!r.test, status: r.test ? 'needs running' : '', deleted: !!r.deleted, outcome: r.outcome, changed: Number(r.changed) }; }
// Test rows, already in the order they are answered in, as one search answer: the bucket keeps that order (a row's seat
// falls with its place), cut to what one answer holds, more saying it was cut.
function mostSevereFirst(rows) {
  const bucket = createProbabilityBucket(Infinity);
  rows.forEach(function (row, i) { bucket.seatFor(1 - i / (rows.length + 1), { key: row.key, label: JSON.stringify(row) }); });
  const out = bucket.serialize(null, SEARCH_ROOM);
  return { items: out.items, more: !!out.more };
}
function refused(code) { return Object.assign(new Error(code), { refusal: code }); }

appServer.serve({
  // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle.
  busy: {
    request: {}, reply: false,
    handler: function () { return working || !!timer || pending.size > 0 || getting > 0; },
  },
  // goal/G47.1, the verbs cycle, the box: "If the argument (a filename, scoped to run://) is not a production script, it
  // returns the error \"not a production script\"", "If the file does not exist, it returns the error \"no such file\", so
  // the caller can tell the difference", "If the file does not have its file and suite rows, they are created
  // automatically", "It creates them with the same code the server uses when it discovers a file change and no record
  // exists: the suites are flagged \"needs testing\"", "The server then returns the file row." Named script.get since the
  // rename (the box: "the verb testicle.file.get becomes testicle.script.get, its argument still name").
  'script.get': {
    request: { name: '' }, reply: { name: '', hash: '', deleted: false, changed: 0 },
    handler: function (a) {
      const name = posix(String(a.name || '')).replace(/^\.?\//, '');
      if (!/\.js$/.test(name) || isSuite(name) || name.indexOf('..') !== -1 || ignored(path.join(RUN, name))) throw refused('not-a-production-script');
      if (!there(name)) throw refused('no-such-file');
      const row = Q.script.get(name);
      if (row) return served(row);
      getting += 1;
      return pairs().then(function (P) { apply([name], P); return served(Q.script.get(name)); })
        .finally(function () { getting -= 1; });
    },
  },
  // goal/G47.1, the verbs cycle, the box: "A standard table search response", "The file row owns its suite rows: the suite
  // table's key is file and suite. So suite.search takes the production file and answers that file's suite rows only, each
  // suite once, with its filename and its status; the words narrow among them", "The suite search returns both: the
  // filename AND its status \"needs running\"", "suite.search takes {script, text}". Ranked over the whole row as it is served (goal/G41.28), as the agent's
  // tables search; with no words, all of them, by name.
  'suite.search': {
    request: { script: '', text: '' }, reply: { items: [], more: false },
    handler: function (a) {
      const words = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      let n = 0;
      Q.suitesOfScript.all(String(a.script || '')).forEach(function (r) {
        const row = suiteServed(r);
        const score = words ? Number(probabilityStringObjectMatch(words, row)) || 0 : 1;
        n += 1;
        if (score > 0) bucket.seatFor(score * (1 - 1e-9) + 1e-9 / (1 + n), { key: row.key, label: JSON.stringify(row) });
      });
      const out = bucket.serialize(null, SEARCH_ROOM);
      return { items: out.items, more: !!out.more };
    },
  },
  // goal/G47.1, the test-table cycle, the box: "Every test.set happens by itself, no bundling", "test.set MUST carry
  // severity: {script, suite, test, verified, severity}", "When a test row is set, and a script row is missing, the server
  // needs to auto-create the script/suite rows for that test". A script whose row is missing, or whose bytes changed since
  // its row, gets its rows by the same write a change makes; then the test's row. "This cycle does not clear a suite's
  // needs-testing flag."
  'testicle.set': {
    request: { script: '', suite: '', test: '', verified: false, severity: 0 }, reply: {},
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      const name = String(a.test || '');
      if (!/\.js$/.test(script) || isSuite(script) || script.indexOf('..') !== -1 || ignored(path.join(RUN, script))) throw refused('not-a-production-script');
      if (!suite || !name) throw refused('bad-request');
      const severity = Math.max(0, Math.min(1, Number(a.severity) || 0));
      const row = Q.script.get(script);
      if (!row && !there(script)) throw refused('no-such-file');
      const stale = !row || (there(script) && row.hash !== hashOf(script));
      getting += 1;
      return Promise.resolve(stale && there(script) ? pairs().then(function (P) { apply([script], P); }) : null).then(function () {
        const now = Date.now();
        const judged = there(script) ? hashOf(script) : ((Q.script.get(script) || {}).hash || '');
        const was = T.current.get(script, suite, name);
        let flipped = now;
        db.exec('BEGIN');
        try {
          if (!was) T.add.run(script, suite, name, now, a.verified ? 1 : 0, now, judged, severity);
          else if (!!was.verified === !!a.verified) { flipped = Number(was.flipped); T.tested.run(now, judged, severity, script, suite, name, flipped); }
          else { T.retire.run(script, suite, name, Number(was.flipped)); T.add.run(script, suite, name, now, a.verified ? 1 : 0, now, judged, Math.max(severity, Number(was.severity) || 0)); }
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        // On a flip the replaced row, current false now, is published too, before the new current row (goal/G47.1, the
        // box: "on a flip, the replaced row turning current false is published too, beside the new current row").
        if (was && Number(was.flipped) !== flipped) appServer.publish({ testicle: { table: 'testicle', row: testServed(T.row.get(script, suite, name, Number(was.flipped))) } });
        const out = testServed(T.row.get(script, suite, name, flipped));
        appServer.publish({ testicle: { table: 'testicle', row: out } });
        return out;
      }).finally(function () { getting -= 1; });
    },
  },
  // goal/G47.1, the test-table cycle, the box: "test.search will only return \"current\" test rows for the script/suite
  // combination supplied to the search. The other cases are handled accordingly: no script in the search query searches
  // tests for any script; the same for suite", "Most severe first applies to all test searches." script and suite may each
  // be left out; the words narrow among the rows, matched over the whole row as it is served.
  // THE ONE EXCEPTION, A TEST'S HISTORY (goal/G47.1, the search cycle; Andy, amending the ruling above: "test.search will
  // return only current test rows by default, unless a valid test-Title is supplied, in which case all rows will be show
  // that match: \"script, suite AND title\""): given a test with its script and its suite, every row of that one test,
  // current or not, newest flip first. A test without its script and suite is no valid title, and refused.
  'testicle.search': {
    request: { text: '' }, reply: { items: [], more: false },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.text !== 'string') return false;
      if (a.test !== undefined && (typeof a.script !== 'string' || typeof a.suite !== 'string' || typeof a.test !== 'string' || !a.test)) return false;
      return Object.keys(a).every(function (k) { return (k === 'text') || ((k === 'script' || k === 'suite' || k === 'test') && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const words = String(a.text || '').trim();
      if (a.test !== undefined) {
        return mostSevereFirst(T.history.all(a.script, a.suite, a.test).map(testServed)
          .filter(function (row) { return !words || (Number(probabilityStringObjectMatch(words, row)) || 0) > 0; }));
      }
      const rows = T.currents.all().filter(function (r) { return (a.script === undefined || r.script === a.script) && (a.suite === undefined || r.suite === a.suite); })
        .map(testServed).filter(function (row) { return !words || (Number(probabilityStringObjectMatch(words, row)) || 0) > 0; });
      return mostSevereFirst(rows);
    },
  },
  // goal/G47.1, the box: "The new verb \"red\" is shorthand for: search all failed, current tests, most severe first", "The
  // verb red is testicle.red, the one simple verb G45 named for any peer to get the latest reds." It takes nothing.
  red: {
    request: {}, reply: { items: [], more: false },
    handler: function () { return mostSevereFirst(T.reds.all().map(testServed)); },
  },
// No peer user: the owner's own test status (apiAuth/G1.10).
}, {
  // ITS ROWS ON THE NODE'S JOB STREAM (goal/G47.1, the UI cycle), as the agent's tables publish theirs: { testicle: { table,
  // row } }. A page starts with none and asks suite.search for what it shows.
  publisher: { family: 'testicle', bootstrap: function () { return []; } },
  codes: {
  'not-a-production-script': { status: 400, text: 'not a production script' },
  'no-such-file': { status: 404, text: 'no such file' },
} });
