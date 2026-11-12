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
const { execFile, spawn } = require('child_process');
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
  // EVERY SUITE, EACH ONCE (goal/G47.1, the box: "The testicle search can search by a suite alone"): flagged if any of its
  // rows is, deleted only when all of them are.
  everySuite: db.prepare("SELECT suite, MAX(test) AS test, MIN(deleted) AS deleted, MAX(changed) AS changed, CASE WHEN SUM(outcome = 'red') > 0 THEN 'red' WHEN SUM(outcome = 'green') = COUNT(*) THEN 'green' ELSE '' END AS outcome FROM suite GROUP BY suite ORDER BY suite"),
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
// BOTH HASHES ON A TEST ROW (goal/G47.1, the box: "A testicle row carries both hashes it ran against, the script's and the
// suite's"): judged is the script's, suiteHash the suite's. A table made before it gains the column, empty.
if (!db.prepare('PRAGMA table_info(testicle)').all().some(function (c) { return c.name === 'suiteHash'; })) db.exec("ALTER TABLE testicle ADD COLUMN suiteHash TEXT NOT NULL DEFAULT ''");
const T = {
  current: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? AND current = 1'),
  add: db.prepare('INSERT INTO testicle (script, suite, test, flipped, current, verified, tested, judged, severity, suiteHash) VALUES (?, ?, ? , ?, 1, ?, ?, ?, ?, ?)'),
  tested: db.prepare('UPDATE testicle SET tested = ?, judged = ?, severity = MAX(severity, ?), suiteHash = ? WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  retire: db.prepare('UPDATE testicle SET current = 0 WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  // The current rows, most severe first, the newest flip first among equals (the index's order).
  currents: db.prepare('SELECT * FROM testicle WHERE current = 1 ORDER BY severity DESC, flipped DESC'),
  reds: db.prepare('SELECT * FROM testicle WHERE current = 1 AND verified = 0 ORDER BY severity DESC, flipped DESC'),
  row: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? AND flipped = ?'),
  // A test's history: every row of it, the newest flip first.
  history: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND test = ? ORDER BY flipped DESC'),
  // The current rows of one script and suite: what its status is judged from.
  ofSuite: db.prepare('SELECT * FROM testicle WHERE script = ? AND suite = ? AND current = 1'),
};
// A SUITE ROW'S STATUS, THE SERVER'S ALONE (goal/G47.1, the box: "A suite row's status, for its script: \"needs running\"
// when it never ran; \"still red\" when it ran, but has failed tests in it for that script; \"green\" if all tests in the
// suite passed", "\"needs running\" clears when the server has a full, successful report from the suite in its database for
// that script", "The flag is the server's alone; no suite reports anything new and no suite touches the flag", "Full: every
// row of that script and suite in the testicle table was tested after the flag was set; then \"green\" if every one passed,
// \"still red\" if one failed"). Its outcome column holds 'green' or 'red' once judged; the flag, test, says needs running.
const judgeSuite = db.prepare('UPDATE suite SET test = 0, outcome = ?, changed = ? WHERE script = ? AND suite = ?');
function statusOf(test, outcome) { return test ? 'needs running' : outcome === 'red' ? 'still red' : outcome === 'green' ? 'green' : 'needs running'; }
// A test row as the verbs and the stream carry it: its key its full key, script|suite|test|flipped, its booleans booleans
// (goal/G47.1, the box: "the page keeps test rows by their full key, script|suite|test|flipped, and shows a test's current
// row"), so a flipped test's replaced row and its current row are two rows wherever they are kept.
function testServed(r) {
  return { key: r.script + '|' + r.suite + '|' + r.test + '|' + Number(r.flipped), script: r.script, suite: r.suite, test: r.test, flipped: Number(r.flipped), current: !!r.current,
    verified: !!r.verified, tested: Number(r.tested), judged: r.judged, suiteHash: String(r.suiteHash || ''), severity: Number(r.severity) };
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

// THE QUEUE AND ITS ONE RUNNER (goal/G47.1, the queue cycle, the box: "The flags are the queue: every suite row flagged
// \"needs running\" is owed one run, and there is no second list, so nothing is queued twice", "One runner: one suite
// process at a time, never two. It starts 1 second after the last file change event; a new event pushes the start back",
// "A job is one suite for one script, one process each", "General tests first", "A press of 🏃‍♂️ puts its suite and script
// at the head of the queue, never a second run beside the running one", "Nobody but testicle starts runs", "Rows already
// flagged when the server starts: the runner starts 1 second after the server starts"). A suite runs as its own process in
// this checkout, so its reporter reports to this node: a general test given the script, an own test nothing, --test <title>
// when a title was asked.
const QUIET_MS = 1000;
// THE ONE JOB LIMIT (Andy: "we say 2 minutes wait until failure"): past it the job is killed and its tests failed.
const JOB_LIMIT_MS = 120000;
const flaggedRows = db.prepare('SELECT script, suite FROM suite WHERE test = 1 AND deleted = 0');
let job = null;          // { script, suite, title, scriptHash, suiteHash, started, kid, timer, killed }
const front = [];        // [{ script, suite, title }], pressed: run first, the newest press first
let quiet = null;
function isGeneral(suite) { return /-(child|sibling)-/.test(path.posix.basename(suite)); }
// A file change, a press or the start: the runner waits for one quiet second, a new event pushing it back.
function soon() {
  if (quiet) clearTimeout(quiet);
  quiet = setTimeout(function () { quiet = null; nextJob(); }, QUIET_MS);
}
function chooseJob() {
  while (front.length) { const f = front.shift(); if (there(f.script) && there(f.suite)) return f; }
  const rows = flaggedRows.all().filter(function (r) { return there(r.script) && there(r.suite); });
  // General tests first, "because they tend to get most coverage fastest" (Andy); then by name, so the order is stable.
  rows.sort(function (a, b) { return (isGeneral(b.suite) - isGeneral(a.suite)) || (a.suite < b.suite ? -1 : a.suite > b.suite ? 1 : 0) || (a.script < b.script ? -1 : a.script > b.script ? 1 : 0); });
  return rows.length ? { script: rows[0].script, suite: rows[0].suite, title: '' } : null;
}
function nextJob() {
  if (job || quiet) return;
  const n = chooseJob();
  if (!n) { told(); return; }
  // THE TWO HASHES, TAKEN AT THE START (the box: "When a run starts, the server remembers the two hashes as they stand, and
  // until that run ends tags every result of it with them").
  const sr = Q.script.get(n.script);
  const ur = Q.suiteRow.get(n.script, n.suite);
  const j = { script: n.script, suite: n.suite, title: n.title || '', scriptHash: (sr && sr.hash) || hashOf(n.script),
    suiteHash: (ur && ur.hash) || hashOf(n.suite), started: Date.now(), kid: null, timer: null, killed: false };
  const args = [n.suite];
  if (n.suite !== ownTestOf(n.script)) args.push(n.script);
  if (j.title) args.push('--test', j.title);
  killed.delete(j.script + '|' + j.suite);
  job = j;
  told();
  let done = false;
  const end = function () {
    if (done) return;
    done = true;
    clearTimeout(j.timer);
    if (job === j) job = null;
    try { jobEnded(j); } catch (e) { console.error('testicle: ' + (e && e.message || e)); }
    // The next job at once, before busy is told: busy goes false only when nothing is left to run, never between two jobs
    // (the box: "whenever it goes back to listening for events it sets busy false").
    nextJob();
    told();
  };
  j.kid = spawn(process.execPath, args, { cwd: RUN, stdio: 'ignore', windowsHide: true });
  j.kid.on('error', end);
  j.kid.on('exit', end);
  j.timer = setTimeout(function () { killJob(j); }, JOB_LIMIT_MS);
}
// PAST THE LIMIT (the box: "A job that runs past 2 minutes is killed, and every test of that suite and script the server
// knows is failed, tagged with the run's two hashes, so it is not queued again until the script or the suite changes").
// A RESULT OF A KILLED RUN THAT COMES LATE (wsl's red, rho: its first result reached the server only after the kill) is a
// test of that run too, and failed with it: killed keeps the run's hashes per suite and script until a run of it starts
// again or a change moves them.
const killed = new Map();   // script|suite -> { scriptHash, suiteHash }
function killJob(j) {
  if (job !== j) return;
  j.killed = true;
  killed.set(j.script + '|' + j.suite, { scriptHash: j.scriptHash, suiteHash: j.suiteHash });
  T.ofSuite.all(j.script, j.suite).forEach(function (r) { setResult(j.script, j.suite, r.test, false, Number(r.severity) || 0, j.scriptHash, j.suiteHash); });
  try { j.kid.kill(); } catch (e) { /* gone already */ }
}
// A JOB ENDED: a whole run (no title asked) that left its suite row flagged is judged now, so the flag never queues the
// same run twice: green or still red by its rows when they are full, still red when it was killed or its report fell
// short ("a suite that hangs before any test reported fails too, with no test rows needed"). A row flagged again during
// the run (a change after it started) stays flagged and comes round again ("the running job is not killed, the suite comes
// round again behind it").
function jobEnded(j) {
  if (j.title) return;
  const row = Q.suiteRow.get(j.script, j.suite);
  const sr = Q.script.get(j.script);
  // Changed during the run: the script's or the suite's hash is no longer the one the run started with.
  if (!row || row.deleted || !sr || row.hash !== j.suiteHash || sr.hash !== j.scriptHash) return;
  if (!j.killed && suiteJudged(j.script, j.suite)) return;
  if (!row.test && row.outcome === 'red') return;
  judgeSuite.run('red', Date.now(), j.script, j.suite);
  tell('suite', suiteServed(Q.suiteRow.get(j.script, j.suite)), 'updated');
}
// ONE TEST'S RESULT WRITTEN (testicle.set's, and a killed job's failures): no flip, the current row tested again; a flip, the
// current row retired and a new one made (goal/G47.1, the test-table cycle), each tagged with the two hashes. On a flip the
// replaced row, current false now, is published too, before the new current row ("on a flip, the replaced row turning
// current false is published too, beside the new current row"). Answers the current row as served.
function setResult(script, suite, name, verified, severity, scriptHash, suiteHash) {
  const now = Date.now();
  const was = T.current.get(script, suite, name);
  let flipped = now;
  db.exec('BEGIN');
  try {
    if (!was) T.add.run(script, suite, name, now, verified ? 1 : 0, now, scriptHash, severity, suiteHash);
    else if (!!was.verified === !!verified) { flipped = Number(was.flipped); T.tested.run(now, scriptHash, severity, suiteHash, script, suite, name, flipped); }
    else { T.retire.run(script, suite, name, Number(was.flipped)); T.add.run(script, suite, name, now, verified ? 1 : 0, now, scriptHash, Math.max(severity, Number(was.severity) || 0), suiteHash); }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  if (was && Number(was.flipped) !== flipped) tell('testicle', testServed(T.row.get(script, suite, name, Number(was.flipped))), 'updated');
  const out = testServed(T.row.get(script, suite, name, flipped));
  tell('testicle', out, was && Number(was.flipped) === flipped ? 'updated' : 'added');
  return out;
}
// A press of 🏃‍♂️, or an agent's testicle.run: to the head of the queue, never twice.
function press(script, suite, title) {
  for (let i = front.length - 1; i >= 0; i--) if (front[i].script === script && front[i].suite === suite) front.splice(i, 1);
  front.unshift({ script: script, suite: suite, title: title || '' });
  if (!job && !quiet) nextJob();
}

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
  // Whether each row was there before this write, so its publish says added or updated (deleted, by its own flag).
  const had = Object.create(null);
  const before = function (k, get) { if (!(k in had)) had[k] = !!get(); };
  const touched = function (file, suite) { before('suite|' + file + '|' + suite, function () { return Q.suiteRow.get(file, suite); }); written.set(file + '|' + suite, [file, suite]); };
  const fileUp = function (file) { before('script|' + file, function () { return Q.script.get(file); }); Q.putScript.run(file, hash(file), now); files.add(file); };
  const suiteUp = function (file, suite) { touched(file, suite); Q.putSuite.run(file, suite, hash(suite), now); };
  // A SUITE'S OWN EVENT flags a row only when it is new, was deleted, or the suite's bytes changed: an event with the same
  // bytes (one a run's own reading can cause) never flags it again (wsl's verify: rho's row "flagged again DURING its run,
  // rho.js not touched then", so a killed suite was owed another run, forever). A script's change flags its suites always.
  const suiteChanged = function (file, suite) { const was = Q.suiteRow.get(file, suite); return !was || !!was.deleted || was.hash !== hash(suite); };
  db.exec('BEGIN');
  try {
    changed.forEach(function (rel) {
      if (isSuite(rel)) {
        if (!there(rel)) { Q.rowsOfSuite.all(rel).forEach(function (r) { touched(r.script, r.suite); }); Q.goneRowsOfSuite.run(now, rel); return; }
        // The files it concerns: the one it is the own test of, and every file a general test judges.
        const files = (P.bySuite[rel] || []).slice();
        const own = fileOfOwnTest(rel);
        if (there(own) && files.indexOf(own) === -1) files.push(own);
        files.forEach(function (file) { if (!Q.script.get(file)) fileUp(file); if (suiteChanged(file, rel)) suiteUp(file, rel); });
        return;
      }
      if (!there(rel)) { before('script|' + rel, function () { return Q.script.get(rel); }); Q.goneScript.run(rel, now); files.add(rel); Q.suitesOfScript.all(rel).forEach(function (r) { touched(r.script, r.suite); }); Q.goneSuitesOfScript.run(now, rel); return; }
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
  files.forEach(function (file) { const r = Q.script.get(file); if (r) tell('script', served(r), r.deleted ? 'deleted' : had['script|' + file] ? 'updated' : 'added'); });
  written.forEach(function (p) { const r = Q.suiteRow.get(p[0], p[1]); if (r) tell('suite', suiteServed(r), r.deleted ? 'deleted' : had['suite|' + p[0] + '|' + p[1]] ? 'updated' : 'added'); });
  // Whatever wrote it, a file change, a script.get or a testicle.set, a flag written wakes the runner (wsl's gap).
  if (written.size) soon();
}

// WHAT IT STREAMS (goal/G47.1, the box: "busy is streamed by the server: whenever it wakes it sets busy true and streams it;
// whenever it goes back to listening for events it sets busy false and streams it", "busy stays the one answer it is today
// ..., streamed each time it changes; the page never asks testicle.busy", and the monitor row's "last change: a row added,
// deleted or updated in any of its three tables"):
//   { testicle: { table, row, change, busy } }   a row written, change 'added', 'updated' or 'deleted', busy as it stands
//   { testicle: { busy } }                       busy turned, true on waking, false back to listening
// Every row carries busy too, so a page that opens late finds it in the last thing the job published.
function busyNow() { return working || !!timer || pending.size > 0 || getting > 0 || !!job; }
let busyTold = false;
function told() {
  const b = busyNow();
  if (b === busyTold) return;
  busyTold = b;
  appServer.publish({ testicle: { busy: b } });
}
// A test of a script and suite reported: the suite row judged again from the table. Flagged, it clears once every current row
// was tested since the flag was set (changed); judged before, its outcome follows the rows. Published when it changed.
// FULL BY THE HASHES (the box: "A suite row is then full when every current row of that script and suite carries both hashes
// as they are now"): flagged, it clears once every current row carries the script row's hash and the suite row's. Answers
// whether the row is judged full.
function suiteJudged(script, suite) {
  // Never while its own job runs: the rows it has so far are not the whole run; the job's end judges it (jobEnded).
  if (job && job.script === script && job.suite === suite) return false;
  const row = Q.suiteRow.get(script, suite);
  const sr = Q.script.get(script);
  if (!row || row.deleted || !sr) return false;
  const rows = T.ofSuite.all(script, suite);
  if (!rows.length) return false;
  if (!rows.every(function (r) { return r.judged === sr.hash && String(r.suiteHash || '') === row.hash; })) return false;
  const outcome = rows.every(function (r) { return !!r.verified; }) ? 'green' : 'red';
  if (!row.test && row.outcome === outcome) return true;
  judgeSuite.run(outcome, Date.now(), script, suite);
  tell('suite', suiteServed(Q.suiteRow.get(script, suite)), 'updated');
  return true;
}
function tell(table, row, change) { appServer.publish({ testicle: { table: table, row: row, change: change, busy: busyNow() } }); }

// THE QUEUE: what changed since the last write, and whether a write is under way. busy is either, or a script.get making
// rows.
const pending = new Set();
let working = false;
let timer = null;
let getting = 0;
function kick() {
  if (working || timer || !pending.size) { told(); return; }
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
  told();
}

const watcher = spirit.require('spirit/job/chokidar/index.js').watch(RUN, { ignored: ignored, ignoreInitial: true, persistent: true });
watcher.on('all', function (event, full) {
  if (['add', 'change', 'unlink'].indexOf(event) === -1 || !full) return;
  const rel = posix(path.relative(RUN, full));
  if (!rel || rel.indexOf('..') === 0 || !/\.js$/.test(rel)) return;
  pending.add(rel);
  kick();
  // The runner waits for a quiet second after the last change (the box: "a new event pushes the start back").
  soon();
});
watcher.on('error', function (e) { console.error('testicle: the watcher: ' + (e && e.message || e)); });
// Rows already flagged at the start: the runner starts 1 second after the server starts.
soon();

// A script row as a verb answers it: its deleted a boolean.
function served(row) { return { name: row.name, hash: row.hash, deleted: !!row.deleted, changed: Number(row.changed) }; }
// A suite row as a search and the stream carry it: its key script|suite, its status "needs running" while it is flagged.
function suiteServed(r) { return { key: r.script + '|' + r.suite, script: r.script, suite: r.suite, test: !!r.test, status: statusOf(r.test, r.outcome), deleted: !!r.deleted, outcome: r.outcome, changed: Number(r.changed) }; }
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
  // goal/G47.1, the run cycle, the box: "A new testicle verb, run {script, suite, testicle}"; the queue cycle: "A press of
  // 🏃‍♂️ puts its suite and script at the head of the queue", "an agent uses the same verb the UI uses". Answered at once. The script a production script, the suite a suite, both on disc; testicle, a test's title, optional.
  run: {
    request: { script: '', suite: '' }, reply: {},
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.script !== 'string' || typeof a.suite !== 'string') return false;
      return Object.keys(a).every(function (k) { return k === 'script' || k === 'suite' || (k === 'testicle' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const script = posix(String(a.script || '')).replace(/^\.?\//, '');
      const suite = posix(String(a.suite || '')).replace(/^\.?\//, '');
      if (!/\.js$/.test(script) || isSuite(script) || script.indexOf('..') !== -1 || ignored(path.join(RUN, script))) throw refused('not-a-production-script');
      if (!/\.js$/.test(suite) || !isSuite(suite) || suite.indexOf('..') !== -1) throw refused('not-a-suite');
      if (!there(script) || !there(suite)) throw refused('no-such-file');
      press(script, suite, String(a.testicle || ''));
      return { started: true };
    },
  },
  // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle.
  busy: {
    request: {}, reply: false,
    handler: function () { return busyNow(); },
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
      // ITS OWN SUITE'S ROW, MADE IF MISSING (the box: "If the file does not have its file and suite rows, they are created
      // automatically"; wsl's verify: after script.get of lambda.js its own suite row was not there): flagged, and the runner
      // told.
      const own = ownTestOf(name);
      if (row && there(own) && !Q.suiteRow.get(name, own)) {
        Q.putSuite.run(name, own, hashOf(own), Date.now());
        tell('suite', suiteServed(Q.suiteRow.get(name, own)), 'added');
        soon();
      }
      if (row) return served(row);
      getting += 1;
      told();
      return pairs().then(function (P) { apply([name], P); return served(Q.script.get(name)); })
        .finally(function () { getting -= 1; told(); });
    },
  },
  // goal/G47.1, the verbs cycle, the box: "A standard table search response", "The file row owns its suite rows: the suite
  // table's key is file and suite. So suite.search takes the production file and answers that file's suite rows only, each
  // suite once, with its filename and its status; the words narrow among them", "The suite search returns both: the
  // filename AND its status \"needs running\"", "suite.search takes {script, text}". Ranked over the whole row as it is served (goal/G41.28), as the agent's
  // tables search; with no words, all of them, by name.
  // NO SCRIPT, EVERY SUITE (goal/G47.1, the box: "with the script selector blank (all scripts), the suite selector lists every
  // suite, each once, and suite.search given no script answers that list"; Andy: "the testicle search must be able to search
  // for test with the fucking script filter blank AND a suite selected!!!"): each suite once, its script '', keyed |suite.
  'suite.search': {
    request: { script: '', text: '' }, reply: { items: [], more: false },
    // script may be left out: no script, every suite.
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.text !== 'string') return false;
      return Object.keys(a).every(function (k) { return k === 'text' || (k === 'script' && typeof a[k] === 'string'); });
    },
    handler: function (a) {
      const words = String(a.text || '').trim();
      const bucket = createProbabilityBucket(Infinity);
      const script = String(a.script || '');
      let n = 0;
      (script ? Q.suitesOfScript.all(script) : Q.everySuite.all().map(function (r) { return Object.assign({ script: '', outcome: '' }, r); })).forEach(function (r) {
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
      told();
      return Promise.resolve(stale && there(script) ? pairs().then(function (P) { apply([script], P); }) : null).then(function () {
        // ITS SUITE ROW, MADE IF MISSING (goal/G47.1, the box: "When a test row is set, and a script row is missing, the server
        // needs to auto-create the script/suite rows for that test"): a suite on disc whose row for this script is not there
        // gets it, flagged, so its status can be judged from the tests that follow.
        if (there(suite) && !Q.suiteRow.get(script, suite)) {
          Q.putSuite.run(script, suite, hashOf(suite), Date.now());
          tell('suite', suiteServed(Q.suiteRow.get(script, suite)), 'added');
          // A flag written here wakes the runner as a file change does (wsl's gap: "every flagged row is owed one run").
          soon();
        }
        // THE TWO HASHES IT IS TAGGED WITH (the box: "until that run ends tags every result of it with them"): the running job's
        // for its own script and suite; any other result, the script and suite rows' hashes as they stand.
        const own = job && job.script === script && job.suite === suite ? job : null;
        let scriptHash = own ? own.scriptHash : ((Q.script.get(script) || {}).hash || hashOf(script));
        let suiteHash = own ? own.suiteHash : ((Q.suiteRow.get(script, suite) || {}).hash || hashOf(suite));
        // Late from a killed run, its hashes still standing: failed, as every test of that run is.
        const late = own ? null : killed.get(script + '|' + suite);
        const isLate = !!late && late.scriptHash === scriptHash && late.suiteHash === suiteHash;
        if (late && !isLate) killed.delete(script + '|' + suite);
        const out = setResult(script, suite, name, isLate ? false : !!a.verified, severity, scriptHash, suiteHash);
        suiteJudged(script, suite);
        return out;
      }).finally(function () { getting -= 1; told(); });
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
  // row, change, busy } }, and busy alone when it turns (tell and told, above). A page starts with no rows and asks
  // suite.search for what it shows.
  publisher: { family: 'testicle', bootstrap: function () { return []; } },
  codes: {
  'not-a-production-script': { status: 400, text: 'not a production script' },
  'no-such-file': { status: 404, text: 'no such file' },
} });
