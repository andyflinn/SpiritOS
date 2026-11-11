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

// THE TWO TABLES OF testicle.db (goal/G45.1's box). A boolean is 0 or 1; changed is a numeric UTC timestamp.
const db = new DatabaseSync(path.join(STATE, 'testicle.db'));
db.exec('CREATE TABLE IF NOT EXISTS file (name TEXT PRIMARY KEY, hash TEXT NOT NULL DEFAULT \'\', deleted INTEGER NOT NULL DEFAULT 0, changed INTEGER NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS suite (file TEXT NOT NULL, suite TEXT NOT NULL, test INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, ' +
  'hash TEXT NOT NULL DEFAULT \'\', outcome TEXT NOT NULL DEFAULT \'\', changed INTEGER NOT NULL, PRIMARY KEY (file, suite))');
const Q = {
  file: db.prepare('SELECT * FROM file WHERE name = ?'),
  putFile: db.prepare('INSERT INTO file (name, hash, deleted, changed) VALUES (?, ?, 0, ?) ON CONFLICT(name) DO UPDATE SET hash = excluded.hash, deleted = 0, changed = excluded.changed'),
  goneFile: db.prepare('INSERT INTO file (name, hash, deleted, changed) VALUES (?, \'\', 1, ?) ON CONFLICT(name) DO UPDATE SET deleted = 1, changed = excluded.changed'),
  // A suite row flagged test: the suite needs running (goal/G45.1). Its outcome is kept: nothing runs a suite yet.
  putSuite: db.prepare('INSERT INTO suite (file, suite, test, deleted, hash, outcome, changed) VALUES (?, ?, 1, 0, ?, \'\', ?) ' +
    'ON CONFLICT(file, suite) DO UPDATE SET test = 1, deleted = 0, hash = excluded.hash, changed = excluded.changed'),
  goneSuitesOfFile: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE file = ? AND deleted = 0'),
  goneRowsOfSuite: db.prepare('UPDATE suite SET deleted = 1, changed = ? WHERE suite = ? AND deleted = 0'),
};

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
  const fileUp = function (file) { Q.putFile.run(file, hash(file), now); };
  const suiteUp = function (file, suite) { Q.putSuite.run(file, suite, hash(suite), now); };
  db.exec('BEGIN');
  try {
    changed.forEach(function (rel) {
      if (isSuite(rel)) {
        if (!there(rel)) { Q.goneRowsOfSuite.run(now, rel); return; }
        // The files it concerns: the one it is the own test of, and every file a general test judges.
        const files = (P.bySuite[rel] || []).slice();
        const own = fileOfOwnTest(rel);
        if (there(own) && files.indexOf(own) === -1) files.push(own);
        files.forEach(function (file) { if (!Q.file.get(file)) fileUp(file); suiteUp(file, rel); });
        return;
      }
      if (!there(rel)) { Q.goneFile.run(rel, now); Q.goneSuitesOfFile.run(now, rel); return; }
      const row = Q.file.get(rel);
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
}

// THE QUEUE: what changed since the last write, and whether a write is under way. busy is either.
const pending = new Set();
let working = false;
let timer = null;
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

appServer.serve({
  // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle.
  busy: {
    request: {}, reply: false,
    handler: function () { return working || !!timer || pending.size > 0; },
  },
// No peer user: the owner's own test status (apiAuth/G1.10).
});
