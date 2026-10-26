'use strict';

// spirit/run/process/js/deskVerify/deskVerify.js
// THE VERIFIER'S DATASET — goal/G8.1.
//
//   Andy, 2026-10-06, opening goal/G8: "imagine this: an auto-agent, it is a server process, completely mechanical,
//   it does all the verifying on it's own?" This file is the first piece of it: what it KEEPS.
//
// DECIDED by Andy, and not this file's to undo:
//   - A row per test: suite, title, outcome, commit, dirty tree, UTC time. "it is when either no record exists for
//     that one test, OR when red/green changes, that a new record is written, capturing/writing the commit-level and
//     UTC timestamp for that change. all in-between runs or commit-levels are already implicit in that information."
//   - An outcome is red or green: "so we forget unhappy and worry just about red/green".
//   - "the called suite sends one test-record at the time, no fucking bundling or other complicated stuff, we don't
//     worry about the bit of extra time it takes." So `record` takes ONE record. Do not add a batch verb.
//   - verify.db lives in this folder and git ignores it (goal/G8.1's box), so a clone carries the code and not the
//     measurements; the `db` argument names another file, which every suite uses so no test touches the real one.
//   - The commit, the dirty tree and the time are stamped HERE, never sent: deskVerify launched the run, so it knows
//     them, and a suite cannot claim a commit it was not measured at.
//
// A RUNNER THAT KNOWS NOTHING OF THE DESK (goal/G33.3). DECIDED BY ANDY, in the item's box: "make sure in the box that
// deskVerify has no fucking clue about desk, desk goals or desk items.", and "the verifier only is busy or not." So it
// is handed a run (the suites, and the commit to run at) through `run`, answers taken or busy, runs the suites one at
// a time and keeps each suite's outcome in verify.db; it reports to no one, and whoever handed the run reads the
// outcome through `search` ("the desk can damn well read the fucking results from the fucking verifiers database,
// through the verifiers db-search interface."). It keeps no list of work, asks no desk anything, and old rows in
// verify.db are never read as work. Do not give it a desk verb, an item id or a goal again: the desk compiles the
// suites and drives every run.
// EVERY NODE KEEPS ITS OWN RECORDS (goal/G21.3, Andy's ruling): an agent's copy keeps test records in the same shape
// as the desk node's, private to that agent's work and never shared through git. An agent hands runs to its own
// verifier itself (goal/G33.3), to see its work green there before it claims.

// The spirit object first, as the global spirit (goal/G40.1).
require('../../../spirit.js');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../spirit/appServer.js');
const limits = require('../../../spirit/limits.js');
const probabilityStringMatch = require('../../../spirit/probabilityStringMatch.js').probabilityStringMatch;
const createProbabilityBucket = require('../../../spirit/probabilityBucket.js').createProbabilityBucket;

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
// THE MANIFEST'S VALUES, as the node hands them (jobs.js: one JSON object, name -> value, as the first argument).
let values = {};
try { values = JSON.parse(argv[2] || '{}') || {}; } catch (e) { values = {}; }
// verify.db beside this file unless `db` names another: a suite hands it a temp path, so the measurements of a real
// run are never touched by a test.
const DB_PATH = values.db ? path.resolve(String(values.db)) : path.join(__dirname, 'verify.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
// ONE ROW PER CHANGE, never per run: a test is its suite and its title, and only a first sighting or a flip is kept.
// The commit is this checkout's HEAD and dirty is its modified files, both read here.
db.exec('CREATE TABLE IF NOT EXISTS results (rowid INTEGER PRIMARY KEY AUTOINCREMENT, suite TEXT NOT NULL, title TEXT NOT NULL,' +
  ' outcome TEXT NOT NULL, "commit" TEXT NOT NULL, dirty TEXT NOT NULL, at TEXT NOT NULL);' +
  'CREATE INDEX IF NOT EXISTS results_commit ON results ("commit");' +
  'CREATE INDEX IF NOT EXISTS results_outcome ON results (outcome);' +
  'CREATE INDEX IF NOT EXISTS results_dirty ON results (dirty);' +
  'CREATE INDEX IF NOT EXISTS results_test ON results (suite, title);');
// THE WHY BESIDE THE RED (goal/G21.3): added to a verify.db that predates it, guarded; '' where none.
if (!db.prepare('PRAGMA table_info(results)').all().some(function (c) { return c.name === 'failure'; })) {
  db.exec('ALTER TABLE results ADD COLUMN failure TEXT NOT NULL DEFAULT \'\'');
}
// WHEN EACH TEST WAS LAST REPORTED (goal/G27.14), on every record, a repeat too, where results keeps flips only: what
// a search for what is red NOW reads (current: yes). A table of its own, so the rows results holds are untouched.
db.exec('CREATE TABLE IF NOT EXISTS seen (suite TEXT NOT NULL, title TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (suite, title));');
const seenAt = db.prepare('INSERT INTO seen (suite, title, at) VALUES (?, ?, ?) ON CONFLICT (suite, title) DO UPDATE SET at = excluded.at');

// EVERY RUN IS A ROW (goal/G19.3, reshaped by goal/G33.3): the suites it was handed, each one's outcome and the
// FAILURE lines a red printed, the commit it ran at and whether the tree was dirty; that is what `search` answers and
// the one way a result leaves this server. The rows of the earlier shape named an item and a kind and stood for work
// still to do; that shape is dropped when it is met, so nothing from before a start is ever read as work (the box:
// "old rows in verify.db are never read as work").
if (db.prepare('PRAGMA table_info(runs)').all().some(function (c) { return c.name === 'kind'; })) db.exec('DROP TABLE runs');
db.exec('CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT NOT NULL, outcome TEXT NOT NULL,' +
  ' startedAt TEXT NOT NULL, endedAt TEXT NOT NULL, "commit" TEXT NOT NULL, dirty INTEGER NOT NULL, suites TEXT NOT NULL,' +
  ' line TEXT NOT NULL);');
const runStarted = db.prepare('INSERT INTO runs (state, outcome, startedAt, endedAt, "commit", dirty, suites, line) VALUES (\'running\', \'\', ?, \'\', \'\', 0, ?, \'\')');
const runEnded = db.prepare('UPDATE runs SET state = \'ended\', outcome = ?, endedAt = ?, "commit" = ?, dirty = ?, suites = ?, line = ? WHERE rowid = ?');
// A run a stopped server left running is over: it is said so, and never taken up again.
db.prepare('UPDATE runs SET state = \'ended\', outcome = \'stopped\', line = \'the server stopped while it ran\' WHERE state = \'running\'').run();

// THE TREE IT MEASURED. Read once per call and cached for a moment: a run posts thousands of records and the commit
// does not move inside one. The repo is the checkout holding this file, which is the clone deskVerify runs in; the
// `repo` argument names another (goal/G21.3), so a suite measures a scratch repo and never a real checkout.
const REPO = values.repo ? path.resolve(String(values.repo)) : (function () {
  for (let d = __dirname; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return '';
  }
}());
// ── GIT NEVER FREEZES IT (goal/G21.3) ────────────────────────────────────
//
//   Andy's box: "deskVerify answers at once even mid-run: the git work that blocks it now (pull, ancestry checks —
//   spawnSync) no longer freezes it."
//
// Every git call and the pull are spawned and awaited, so `now` and `stop` are answered while they run. Do not put a
// spawnSync back on any path a run takes: the tab then shows a verifier that does not answer.
function sh(cmd, args, opts) {
  return new Promise(function (resolve) {
    const out = [];
    const err = [];
    let kid = null;
    try {
      kid = args ? spawn(cmd, args, Object.assign({ cwd: REPO, windowsHide: true }, opts || {}))
        : spawn(cmd, Object.assign({ cwd: REPO, shell: true, windowsHide: true }, opts || {}));
    } catch (e) { resolve({ status: 1, stdout: '', stderr: String((e && e.message) || e) }); return; }
    if (kid.stdout) kid.stdout.on('data', function (d) { out.push(String(d)); });
    if (kid.stderr) kid.stderr.on('data', function (d) { err.push(String(d)); });
    kid.on('error', function (e) { resolve({ status: 1, stdout: out.join(''), stderr: String((e && e.message) || e) }); });
    kid.on('close', function (code) { resolve({ status: code, stdout: out.join(''), stderr: err.join('') }); });
  });
}
function gitOut(args) { return sh('git', args).then(function (r) { return r.status === 0 ? String(r.stdout || '').trim() : ''; }); }
let seen = { at: 0, commit: '', short: '', dirty: '' };
let treeReading = null;
function tree() {
  if (Date.now() - seen.at < 2000) return Promise.resolve(seen);
  // One read at a time: the records of a run arrive by the hundred, and each would otherwise start its own git.
  if (treeReading) return treeReading;
  treeReading = (async function () {
    // The dirty tree is the modified files against the commit, sorted, and empty exactly when the tree is clean
    // (goal/G8.1's box), so a result measured on a dirty tree is never taken for one measured at a commit.
    const porcelain = await gitOut(['status', '--porcelain']);
    const dirty = porcelain ? porcelain.split('\n').map(function (l) { return l.slice(3).trim(); }).filter(Boolean).sort().join(' ') : '';
    const commit = await gitOut(['rev-parse', 'HEAD']);
    const short = await gitOut(['rev-parse', '--short', 'HEAD']);
    seen = { at: Date.now(), commit: commit, short: short, dirty: dirty };
    return seen;
  }()).finally(function () { treeReading = null; });
  return treeReading;
}
function forgetTree() { seen = { at: 0, commit: '', short: '', dirty: '' }; }

// ── THE PULL, AND IT GOES FIRST (goal/G16.13) ────────────────────────────
//
// Every run pulls first, so what it measures is what was pushed. A DIRTY TREE IS PULLED ALL THE SAME (goal/G33.4;
// Andy: "it's a very bad reason for the verifier to reject a fucking run, these files are nowhere in the way of the
// current item's work"): a fast-forward pull never overwrites an uncommitted file - git refuses the pull instead, and
// the run's row says why - so the owner's work is safe without the verifier refusing on his behalf.
const PULL = String(values.pull === undefined ? 'git pull --ff-only' : values.pull).trim();
async function pullFirst() {
  // READ NOW, NOT FROM THE CACHE (goal/G19.2): a file left uncommitted a moment ago must read as dirty.
  if (treeReading) await treeReading.catch(function () {});
  forgetTree();
  if (!PULL) return 'no pull command set';
  // Spawned and awaited (goal/G21.3): a pull that waits on the network no longer freezes now and stop.
  const r = await sh(PULL, null);
  if (treeReading) await treeReading.catch(function () {});
  forgetTree();
  return r.status === 0 ? 'pulled' : 'pull failed: ' + String(r.stderr || r.stdout || '').trim().split('\n')[0];
}
// A COMMIT THE RUN WAS HANDED (goal/G19.13): the checkout must hold it, an ancestor of HEAD, or nothing is measured.
// Only a hash is handed to git.
function holds(commit) {
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) return Promise.resolve(false);
  return sh('git', ['merge-base', '--is-ancestor', String(commit), 'HEAD']).then(function (r) { return r.status === 0; });
}

// The node, through the spirit object (goal/G32.3), for the job marks and the published run objects.

// ONE SUITE, RUN WITHOUT STOPPING THE SERVER (goal/G8.6): spawned and awaited, so the records a suite posts to this very
// server through the node's door are taken while it runs.
// THE TIME LIMIT (goal/G8.10). A suite still running after SUITE_MS is stopped, and being stopped is a red of its own:
// a hung suite prints no FAILURE line, so without this it read as all green.
const SUITE_MS = Number(values.suiteMs) > 0 ? Number(values.suiteMs) : 600000;
// THE IDLE HOUR (goal/G8.4, its own clock since goal/G33.3; the rule is at idleOnce). Declared here because every
// published object carries it.
const IDLE_MS = Number(values.idleMs) > 0 ? Number(values.idleMs) : 60 * 60 * 1000;
let idleState = { since: new Date().toISOString(), chores: '' };
// WHAT RUNS NOW, FOR THE VERIFIER TAB (goal/G8.11): the suite running, since when. Busy is a run under way.
let busy = false;
let running = { suite: '', since: '' };
let runningKid = null;
let stopped = false;
// A STOPPED SUITE TAKES WHAT IT STARTED WITH IT (goal/G19.4). Andy, 2026-10-12: "yes, a stopped suite must clean up after
// itself like any cleanly ended suite. we will not support resume." On Windows taskkill /T ends the suite's own tree;
// elsewhere the suite runs in its own process group and the group is ended. Only that suite's tree, never anything
// found by name.
function killTree(kid) {
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(kid.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* below */ }
    try { kid.kill(); } catch (e) { /* already gone */ }
    return;
  }
  try { process.kill(-kid.pid, 'SIGKILL'); } catch (e) { try { kid.kill('SIGKILL'); } catch (x) { /* already gone */ } }
}
// A LISTED PATH STAYS IN spirit/test (goal/G19.4): spirit/test/../../x.js matched the pattern and was run. The path is
// normalised first; one that leaves the folder is not run, and the run's row says so.
// A suite it runs: under spirit/test/, or a product test (goal/G40.13, box v22, point 8): a file in a test/ folder of
// the product tree, spirit/run/. A module, or a path that leaves the tree, is not run.
function leavesTests(rel) {
  const raw = String(rel || '').replace(/\\/g, '/');
  if (raw.split('/').indexOf('..') !== -1) return true;
  const norm = path.posix.normalize(raw);
  if (norm.indexOf('spirit/test/') === 0) return false;
  return !(norm.indexOf('spirit/run/') === 0 && path.posix.basename(path.posix.dirname(norm)) === 'test');
}
// THE FULL PRODUCT TEST TREE (goal/G40.13, box v22, point 9): the suite 'spirit/run' in a run is every test the product
// tree holds, as testModule.js names them (spirit/run/test/testModule.js, testsFor with no file); a general test is
// run once per module it judges, that module its argument ("<test> <module>").
function productSuites() {
  const tm = require(path.join(REPO, 'spirit', 'run', 'test', 'testModule.js'));
  return tm.testsFor('').map(function (t) { return 'spirit/run/' + t.test + (t.file ? ' spirit/run/' + t.file : ''); });
}
// ── THE CONSOLE OF THE CURRENT RUN (goal/G22.3) ──────────────────────────
//
//   Andy, 2026-10-13, in goal/G22.3's box: "it be even better if the verify tab showed the detailed results in a
//   console like fashion, cleared before every new run. If it's solved there, every run even the ones from Stack,
//   already would have output."
//
// DECIDED BY ANDY, not this file's to narrow: every run this server makes keeps its output here, and only the CURRENT
// run's. What each suite prints, stdout and stderr, goes in as it arrives, in order, under a line naming the suite; a
// new run clears it first. It is capped in BYTES ("bytes copied, bytes counted", 2026-10-10): past CONSOLE_MAX the
// front is dropped, and offsets stay absolute, so a reader tailing it never reads a byte twice. The `console {from}`
// verb answers one answer's room from an offset; every object `say` publishes carries consoleRun and consoleTo, re-said
// at most every CONSOLE_SAY_MS while output arrives, so the tab tails it live and never pulls on a clock.
const CONSOLE_MAX = 256 * 1024;
const CONSOLE_SAY_MS = 300;
let consoleRun = '';
let consoleChunks = [];
let consoleStart = 0;
let consoleEnd = 0;
let consoleEnded = true;
let consoleTimer = null;
function consoleSay() {
  if (consoleTimer) return;
  consoleTimer = setTimeout(function () { consoleTimer = null; if (lastSaid) say(Object.assign({}, lastSaid)); }, CONSOLE_SAY_MS);
}
function consoleClear(run) {
  consoleRun = String(run || '');
  consoleChunks = [];
  consoleStart = 0;
  consoleEnd = 0;
  consoleEnded = false;
  consoleSay();
}
function consoleAdd(d) {
  const b = Buffer.isBuffer(d) ? d : Buffer.from(String(d), 'utf8');
  if (!b.length) return;
  consoleChunks.push(b);
  consoleEnd += b.length;
  let held = consoleEnd - consoleStart;
  while (held > CONSOLE_MAX && consoleChunks.length) {
    const first = consoleChunks[0];
    const over = held - CONSOLE_MAX;
    if (first.length <= over) { consoleChunks.shift(); consoleStart += first.length; held -= first.length; }
    else { consoleChunks[0] = first.subarray(over); consoleStart += over; held -= over; }
  }
  consoleSay();
}
function consoleDone() { consoleEnded = true; consoleSay(); }
// From an offset, as much as one answer holds, never starting or ending inside a character; an offset already
// dropped reads from the first byte still held, and `start` says where that is.
function consoleRead(from) {
  const all = Buffer.concat(consoleChunks);
  const at = Math.min(Math.max(Number(from) || 0, consoleStart), consoleEnd);
  let i = at - consoleStart;
  while (i < all.length && (all[i] & 0xC0) === 0x80) i++;
  const answer = function (j) {
    return { run: consoleRun, start: consoleStart, from: consoleStart + i, to: consoleStart + j, more: consoleStart + j < consoleEnd,
      ended: consoleEnded, text: all.subarray(i, j).toString('utf8') };
  };
  let room = 6000;
  for (;;) {
    let j = Math.min(all.length, i + room);
    if (j < all.length) while (j > i && (all[j] & 0xC0) === 0x80) j--;
    const out = answer(j);
    // Escaped control characters grow in JSON: what goes back must fit one answer.
    if (j === i || Buffer.byteLength(JSON.stringify(out), 'utf8') <= limits.ANSWER_MAX - 512) return out;
    room = Math.floor(room / 2);
  }
}

function runSuite(file, port, onTests, env, args) {
  return new Promise(function (resolve) {
    const out = [];
    let timedOut = false;
    let tests = 0;
    // THE CONSOLE (goal/G22.3): each suite under a line naming it, then everything it prints.
    consoleAdd('\n=== ' + path.relative(REPO, file).split(path.sep).join('/') + ' ===\n');
    const kid = spawn(process.execPath, [file].concat(args || []).concat(['--verify-port', String(port)]), { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
      env: env ? Object.assign({}, process.env, env) : process.env });
    runningKid = kid;
    // EACH ASSERTION AS IT IS PRINTED (goal/G8.12), so the tab's bar moves while a suite runs rather than once it
    // ends. The printed lines are what every reader of a suite uses (runAll, a run here), not the exit code.
    const count = function (text) {
      const n = String(text).split('\n').filter(function (l) { return /^\**\s*(SUCCESS|FAILURE) #/.test(l); }).length;
      if (!n || typeof onTests !== 'function') return;
      tests += n;
      onTests(tests);
    };
    const stop = setTimeout(function () { timedOut = true; killTree(kid); }, SUITE_MS);
    const over = function (code) {
      clearTimeout(stop);
      if (runningKid === kid) runningKid = null;
      resolve({ code: code, said: out.join(''), timedOut: timedOut, stopped: stopped });
    };
    kid.stdout.on('data', function (d) { out.push(String(d)); consoleAdd(d); count(d); });
    kid.stderr.on('data', function (d) { out.push(String(d)); consoleAdd(d); });
    kid.on('exit', over);
    kid.on('error', function () { over(1); });
  });
}
// WHAT IT IS DOING, PUBLISHED AS IT HAPPENS (goal/G8.12). Andy, 2026-10-09: "the new tab in desk should listen to real
// events from verifier, and what now is displayed as a log.. should be an updated status message underneath a progress
// bar", and "it should refresh by itself". So every change of the run is one object down the stream
// (spirit.events.publish, which the page hears with onPublished(fn, 'deskVerify')) - never a log: the tab keeps the
// newest and replaces it. The page asks nothing, as his no-pulling rule requires.
//   doing     'run' a run of suites, 'idle' nothing running
//   index/of  which suite of how many; tests/expected: assertions printed so far, and how many that suite reported
//             the last time it was measured (0 when it was never seen)
//   since     idle: when the last run was handed over, which is what the tab counts the idle hour from
const testsSeen = db.prepare('SELECT COUNT(DISTINCT title) AS n FROM results WHERE suite = ?');
function expectedOf(rel) {
  try { return Number((testsSeen.get(path.basename(String(rel))) || {}).n) || 0; } catch (e) { return 0; }
}
//   stopAsked a Stop was taken and the run has not ended yet (goal/G21.3), so the tab says "stop asked"
//   idleMs    idle: the hour the countdown counts to, this server's own (goal/G21.3), so the tab never guesses it
//   chores    idle: what the idle chores did, one line, '' until they have run
//   hasChores whether its manifest names any chore (goal/G33.6)
let lastSaid = null;
function say(o) {
  const one = {
    doing: String(o.doing || 'idle'), suite: String(o.suite || ''),
    index: Number(o.index) || 0, of: Number(o.of) || 0, tests: Number(o.tests) || 0,
    expected: Number(o.expected) || 0, line: String(o.line || ''), since: String(o.since || ''),
    stopAsked: stopped === true,
    idleMs: IDLE_MS, chores: String(idleState.chores || ''),
    // hasChores (goal/G33.6): whether its manifest names chores, so the tab counts down the idle hour only where it
    // leads somewhere.
    hasChores: CHORES.length > 0,
    // THE CONSOLE'S RUN AND HOW FAR IT HAS COME (goal/G22.3), so the tab tails it with `console`.
    consoleRun: consoleRun, consoleTo: consoleEnd, consoleEnded: consoleEnded,
  };
  lastSaid = one;
  spirit.events.publish(one);
  // THE SUITE COUNT AS THE JOB'S PROGRESS (goal/G29.15): the one bar every page draws, beside the tab's own object.
  if (one.doing !== 'idle' && one.of > 0) {
    spirit.jobs.progress(one.index, one.of, one.suite).catch(function () { /* not started by a node */ });
  }
}
function sayIdle(line) {
  say({ doing: 'idle', line: line || (idleState.chores ? 'idle; ' + idleState.chores : 'idle, nothing running'), since: idleState.since });
}
// The newest object said again with the stop marked, so the tab shows "stop asked" at once and not at the next suite.
function sayAgain() { if (lastSaid) say(Object.assign({}, lastSaid)); }

// ── A STOP IS KEPT FOR THE WHOLE RUN (goal/G21.3) ────────────────────────
//
//   Andy's box: "A Stop is kept for the whole run, whenever it is pressed (a suite running, pulling, between suites),
//   and deskVerify checks it before each suite; the tab shows "stop asked" until the run ends."
//
// While a run is under way the Stop is kept in `stopped` until that run ends, and the run checks it before each suite;
// the suite running now, if any, is ended at once. A stopped suite is never green: nothing was measured. Nothing under
// way answers stopped: false.
function stopRun() {
  if (!busy) return { stopped: false };
  stopped = true;
  if (runningKid) killTree(runningKid);
  sayAgain();
  return { stopped: true };
}

// ── ONE RUN (goal/G33.3) ─────────────────────────────────────────────────
//
// The suites it was handed, one at a time, after the pull; with a commit, only once the checkout holds it. Each suite's
// outcome is green, red (a FAILURE line, or stopped at the time limit), stopped (by hand) or not run (missing, outside
// spirit/test, or the commit not held), with the FAILURE lines a red printed; the run's own outcome is green when every
// suite is, else stopped, red or not run, in that order. All of it goes into the run's row, which `search` answers.
const FAILURES_KEPT = 20;
async function runSuites(suites, commit, row) {
  const port = Number(spirit.node.port);
  const out = suites.map(function (p) { return { path: p, outcome: 'not run', failures: [] }; });
  const since = new Date().toISOString();
  say({ doing: 'run', line: 'pulling before the run of ' + suites.length + (suites.length === 1 ? ' suite' : ' suites'), since: since });
  const pulled = await pullFirst();
  let lacking = '';
  if (commit && !(await holds(commit))) lacking = 'the tree lacks the commit ' + commit.slice(0, 8) + ' the run was handed';
  for (let i = 0; i < suites.length && !lacking; i++) {
    // A general product test carries the module it judges after a space (productSuites).
    const parts = String(suites[i]).split(' ');
    const rel = parts[0];
    const one = out[i];
    const file = path.join(REPO, rel);
    // THE STOP IS CHECKED BEFORE EACH SUITE (goal/G21.3).
    if (stopped) { one.outcome = 'stopped'; one.failures = ['stopped by hand before it ran']; continue; }
    if (leavesTests(rel)) { one.failures = ['the path is neither under spirit/test nor a product test, so it was not run']; continue; }
    if (!fs.existsSync(file)) { one.failures = ['missing from this checkout']; continue; }
    running = { suite: rel, since: new Date().toISOString() };
    const expected = expectedOf(rel);
    const where = path.basename(rel) + ', suite ' + (i + 1) + ' of ' + suites.length;
    const told = function (tests) {
      say({ doing: 'run', suite: rel, index: i + 1, of: suites.length, tests: tests, expected: expected,
        line: 'running ' + where + (expected ? ', ' + tests + ' of about ' + expected + ' tests' : ', ' + tests + ' tests'), since: running.since });
    };
    told(0);
    const r = await runSuite(file, port, told, undefined, parts.slice(1).map(function (p) { return path.join(REPO, p); }));
    // THE PRINTED LINES ARE THE VERDICT, not the exit code: a suite that ends with process.exit(0) after a failure
    // would otherwise read green. Only a line that STARTS with the mark counts (goal/G33.4): a success that quotes a
    // FAILURE line in its text is still a success.
    const lines = r.said.split('\n').filter(function (l) { return /^\**\s*FAILURE #/.test(l); })
      .map(function (l) { return l.replace(/^\**\s*/, '').replace(/\s*[❌✅]\s*$/, '').trim(); });
    if (r.stopped) { one.outcome = 'stopped'; one.failures = ['stopped by hand, so nothing was measured'].concat(lines).slice(0, FAILURES_KEPT); continue; }
    if (r.timedOut) { one.outcome = 'red'; one.failures = ['stopped at the time limit of ' + SUITE_MS + 'ms, so it counts as red'].concat(lines).slice(0, FAILURES_KEPT); continue; }
    one.outcome = lines.length ? 'red' : 'green';
    one.failures = lines.slice(0, FAILURES_KEPT);
  }
  if (lacking) out.forEach(function (one) { one.failures = [lacking]; });
  const t = await tree();
  const has = function (o) { return out.some(function (x) { return x.outcome === o; }); };
  const outcome = out.length && out.every(function (x) { return x.outcome === 'green'; }) ? 'green' : has('stopped') ? 'stopped' : has('red') ? 'red' : 'not run';
  const line = outcome + ', ' + out.length + (out.length === 1 ? ' suite' : ' suites') + ' at ' + (t.short || t.commit || 'an unknown commit') + ' (' + pulled + ')' + (lacking ? ': ' + lacking : '');
  runEnded.run(outcome, new Date().toISOString(), String(t.commit || ''), t.dirty ? 1 : 0, JSON.stringify(out), line, row);
  return outcome;
}
// TAKEN OR BUSY (goal/G33.3): "the verifier only is busy or not." Free, the run starts now and the answer says taken;
// busy, nothing is started or kept. The run is a job of the node (goal/G29.15) and clears the console (goal/G22.3).
function startRun(suites, commit) {
  if (busy || choring) return { busy: true };
  busy = true;
  stopped = false;
  idleState.since = new Date().toISOString();
  const row = Number(runStarted.run(idleState.since, JSON.stringify(suites.map(function (p) { return { path: p, outcome: '', failures: [] }; }))).lastInsertRowid);
  consoleClear(String(row));
  running = { suite: '', since: idleState.since };
  (async function () {
    let outcome = 'broke';
    await spirit.jobs.start('run of ' + suites.length + (suites.length === 1 ? ' suite' : ' suites')).catch(function () { /* not started by a node */ });
    try { outcome = await runSuites(suites, commit, row); } catch (e) {
      runEnded.run('broke', new Date().toISOString(), '', 0, '[]', 'the run broke: ' + String((e && e.message) || e).slice(0, 300), row);
    } finally {
      busy = false;
      stopped = false;
      running = { suite: '', since: '' };
      consoleDone();
      sayIdle();
      await spirit.jobs.end({ outcome: outcome }).catch(function () { /* not started by a node */ });
    }
  }());
  return { taken: true };
}

// ── THE WHY, KEPT AND CAPPED (goal/G21.3) ────────────────────────────────
//
//   Andy's box: "deskVerify keeps, beside each failing test's outcome, its failure text (capped), so the why is in the
//   record."
//
// The failure text is what the suite printed for the red: its title and the detail after it (testSupport.fail sends
// it with the record). Capped HERE, the one gate, in bytes ("bytes copied, bytes counted", 2026-10-10), cut on a
// character boundary. A green keeps none. A red that stays red writes no new row, as goal/G8.1 rules, but its newest
// row takes the newest why: the record answers why it is red now, not why it went red first.
const FAILURE_MAX = 1024;
function capBytes(text, max) {
  const s = String(text || '');
  if (Buffer.byteLength(s, 'utf8') <= max) return s;
  let out = Buffer.from(s, 'utf8').subarray(0, max).toString('utf8');
  // A character cut in half decodes as U+FFFD: drop it, so what is kept is only what was sent.
  while (out.length && out.charCodeAt(out.length - 1) === 0xFFFD) out = out.slice(0, -1);
  return out;
}
const newestRow = db.prepare('SELECT rowid, outcome, failure FROM results WHERE suite = ? AND title = ? ORDER BY rowid DESC LIMIT 1');
const setFailure = db.prepare('UPDATE results SET failure = ? WHERE rowid = ?');
const addRowWhy = db.prepare('INSERT INTO results (suite, title, outcome, "commit", dirty, at, failure) VALUES (?, ?, ?, ?, ?, ?, ?)');
// A ROW IS WRITTEN for a test's first record or a change of outcome, and nothing else.
async function keep(suite, title, outcome, failure) {
  const why = outcome === 'red' ? capBytes(failure, FAILURE_MAX) : '';
  // The tree first, then the read and the write with no wait between them, so a record sent twice at once (verifyPost
  // resends what had not come back) still writes one row.
  const t = await tree();
  seenAt.run(suite, title, new Date().toISOString());
  const last = newestRow.get(suite, title);
  if (last && last.outcome === outcome) {
    if (outcome === 'red' && why && why !== last.failure) setFailure.run(why, last.rowid);
    return { written: false };
  }
  addRowWhy.run(suite, title, outcome, t.commit, t.dirty, new Date().toISOString(), why);
  return { written: true };
}

// ── ONE SEARCH VERB, OVER TESTS AND RUNS (goal/G21.3) ────────────────────
//
//   Andy's box: "deskVerify answers one search verb, bucket-bounded with the partial flag, over: tests and suites (the
//   official latest state of a single test, or every test in a suite: outcome, commit, time, failure text) and runs".
//   Since goal/G33.3 it is also how a run's result leaves this server: whoever handed the run reads it here.
//
// A list is a search (Andy's rule): newest first, each matching row offered to one probability bucket, the test words
// grading the title (a title they do not touch is left out), the other filters exact. Past SEARCH_SCANNED matching
// rows, or past one answer's room, `more` says the answer is partial. It reads verify.db; it writes nothing. A filter
// that does not belong to `over` is ignored, as the verb file says.
const SEARCH_ROOM = limits.ANSWER_MAX - 512;
const SEARCH_SCANNED = 1000;
const SEARCH_KEYS = ['over', 'suite', 'test', 'outcome', 'commit', 'since', 'current', 'heading', 'history', 'slim'];
function searchBytes(key, label) { return Buffer.byteLength(JSON.stringify({ items: [{ key: String(key), label: String(label) }], more: false }), 'utf8'); }
function rankedRows(walk) {
  const bucket = createProbabilityBucket(SEARCH_SCANNED);
  let more = false;
  let scanned = 0;
  for (const one of walk) {
    if (scanned >= SEARCH_SCANNED) { more = true; break; }
    scanned += 1;
    if (searchBytes(one.pair.key, one.pair.label) > SEARCH_ROOM) { more = true; continue; }
    bucket.seatFor(one.probability, one.pair);
  }
  const r = bucket.serialize(null, SEARCH_ROOM);
  return { items: r.items, more: r.more || more };
}
function refusedWhy(why) { const e = new Error(why); e.refusal = 'bad-request'; e.extra = { why: why }; return e; }
function rowsOf(sql, params) {
  const st = db.prepare(sql);
  return typeof st.iterate === 'function' ? st.iterate.apply(st, params) : st.all.apply(st, params);
}
function likeEscaped(s) { return String(s).replace(/[\\%_]/g, '\\$&'); }
// A run's suite matches the suite asked for by its path, or by its file name when no folder is given (as the LIKE above).
function suiteMatches(p, suite) { return suite.indexOf('/') === -1 ? path.basename(p) === suite : p === suite; }
// One run's row when no suite is named: a third of an answer, so a listing of runs holds several.
const RUN_LABEL_ROOM = Math.floor(SEARCH_ROOM / 3);
// A suite's entry cut to fit: its failure lines while ok(entry) holds, each line cut to fit when even one is too long,
// and failuresMore when any was left out.
function fitted(x, ok) {
  const all = Array.isArray(x && x.failures) ? x.failures.map(String) : [];
  const out = Object.assign({}, x, { failures: [], failuresMore: all.length > 0 });
  for (const l of all) {
    let line = l;
    while (line.length > 1 && !ok(Object.assign({}, out, { failures: out.failures.concat([line]) }))) line = line.slice(0, Math.floor(line.length / 2));
    if (!ok(Object.assign({}, out, { failures: out.failures.concat([line]) }))) break;
    out.failures.push(line);
    if (line !== l) break;
  }
  out.failuresMore = out.failures.length < all.length || (out.failures.length > 0 && out.failures[out.failures.length - 1] !== all[out.failures.length - 1]);
  return out;
}
async function search(a) {
  const over = String(a.over || '');
  if (over !== 'tests' && over !== 'runs') throw refusedWhy('search needs over: "tests" or "runs"');
  const commit = String(a.commit || '').trim().toLowerCase();
  if (commit && !/^[0-9a-f]{1,40}$/.test(commit)) return { items: [], more: false };
  const since = String(a.since || '').trim();
  const where = [];
  const params = [];
  if (over === 'runs') {
    // RUNS (goal/G33.3): suite keeps the runs that ran it, by its path, or by its file name when no folder is given.
    const suite = String(a.suite || '');
    if (suite) {
      where.push('suites LIKE ? ESCAPE \'\\\'');
      params.push('%"path":"' + (suite.indexOf('/') === -1 ? '%/' : '') + likeEscaped(suite) + '"%');
    }
    if (a.outcome) { where.push('outcome = ?'); params.push(String(a.outcome)); }
    if (commit) { where.push('"commit" LIKE ?'); params.push(commit + '%'); }
    if (since) { where.push('startedAt >= ?'); params.push(since); }
    const sql = 'SELECT rowid, state, outcome, startedAt, endedAt, "commit" AS commitAt, dirty, suites, line FROM runs' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY rowid DESC';
    // ONE SUITE'S PART PER RUN (goal/G33.7, box v9: "The desk's interface itself prevents oversized answers"). Found
    // live: a run of 111 suites held 8,229 characters of them, its row could not come back, and the desk read an older
    // run. A search naming a suite answers, per run, the run's own facts and that suite's entry alone. One naming none
    // answers each run with as many suites as fit RUN_LABEL_ROOM (a third of an answer, so several runs come), then
    // suitesTotal and suitesMore. Either way an entry whose
    // failure lines alone pass the room keeps the lines that fit and says failuresMore (fitted), so a row always comes.
    const runRows = [];
    for (const r of rowsOf(sql, params)) {
      let suites = [];
      try { suites = JSON.parse(String(r.suites || '[]')); } catch (e) { suites = []; }
      if (!Array.isArray(suites)) suites = [];
      const head = { state: r.state, outcome: r.outcome, started: r.startedAt, ended: r.endedAt, commit: r.commitAt || '', dirty: Number(r.dirty) === 1, line: r.line || '' };
      let label = '';
      if (suite) {
        const mine = suites.filter(function (x) { return x && suiteMatches(String(x.path || ''), suite); });
        const fits = function (list) { return searchBytes(r.rowid, JSON.stringify(Object.assign({}, head, { suites: list }))) <= SEARCH_ROOM; };
        label = JSON.stringify(Object.assign({}, head, { suites: fits(mine) ? mine : mine.slice(0, 1).map(function (x) { return fitted(x, function (e) { return fits([e]); }); }) }));
      } else {
        const kept = [];
        const fits = function (list) { return searchBytes(r.rowid, JSON.stringify(Object.assign({}, head, { suites: list, suitesTotal: suites.length, suitesMore: true }))) <= RUN_LABEL_ROOM; };
        for (const x of suites) {
          if (fits(kept.concat([x]))) { kept.push(x); continue; }
          if (!kept.length) kept.push(fitted(x, function (e) { return fits([e]); }));
          break;
        }
        label = JSON.stringify(Object.assign({}, head, { suites: kept, suitesTotal: suites.length, suitesMore: kept.length < suites.length }));
      }
      runRows.push({ probability: 0, pair: { key: String(r.rowid), label: label } });
    }
    // HOW MANY (goal/G27.14): every match counted, beside the bucket.
    const outRuns = rankedRows(runRows[Symbol.iterator]());
    outRuns.total = runRows.length;
    return outRuns;
  }
  // TESTS: the newest row of each test is its official latest state.
  if (a.suite) { where.push('suite = ?'); params.push(path.basename(String(a.suite))); }
  if (a.outcome) { where.push('outcome = ?'); params.push(String(a.outcome)); }
  if (commit) { where.push('"commit" LIKE ?'); params.push(commit + '%'); }
  if (since) { where.push('at >= ?'); params.push(since); }
  // A TESTED THING'S CHECKS (goal/G27.14, F6): heading is a sub-heading, and keeps the keys "<heading> #<n>"; a test's
  // full key keeps that one test (one line per test, Andy, 2026-10-17: "i WANT TO SEE ONE FUCKING LINE PER FUCKING
  // TEST.").
  const heading = String(a.heading || '');
  if (heading) { where.push('(title = ? OR title LIKE ? ESCAPE \'\\\')'); params.push(heading, likeEscaped(heading) + ' #%'); }
  // ITS HISTORY (Andy, 2026-10-17: "so we'll add a dialog for test-history, that shows us the flips."): history: yes
  // answers every row, each a flip, not only each test's newest.
  const history = String(a.history || '') === 'yes';
  const sql = 'SELECT rowid, suite, title, outcome, "commit" AS commitAt, at, failure FROM results WHERE ' +
    (history ? '1 = 1' : 'rowid IN (SELECT MAX(rowid) FROM results GROUP BY suite, title)') + (where.length ? ' AND ' + where.join(' AND ') : '') + ' ORDER BY rowid DESC';
  const words = String(a.test || '').trim();
  // WHAT IS RED NOW (goal/G27.14, current: yes): only tests reported in their suite's latest run, that is within one
  // suite's time limit of the suite's newest report.
  let inLatest = null;
  if (String(a.current || '') === 'yes') {
    const newest = Object.create(null);
    const at = Object.create(null);
    for (const s of rowsOf('SELECT suite, title, at FROM seen', [])) {
      at[s.suite + '\n' + s.title] = String(s.at);
      if (!newest[s.suite] || String(s.at) > newest[s.suite]) newest[s.suite] = String(s.at);
    }
    inLatest = function (r) {
      const t = at[r.suite + '\n' + r.title];
      return !!t && Date.parse(newest[r.suite]) - Date.parse(t) <= SUITE_MS;
    };
  }
  // NOTHING SENT THAT IS NOT SHOWN (goal/G27.14). Andy, 2026-10-17: "don't return shit in the search that i don't want
  // to see! WASTE OF SPACE." So slim: yes leaves each row's commit and failure text out.
  const slim = String(a.slim || '') === 'yes';
  const found = [];
  for (const r of rowsOf(sql, params)) {
    if (inLatest && !inLatest(r)) continue;
    const p = words ? Math.max(probabilityStringMatch(words, String(r.title)), probabilityStringMatch(words, String(r.failure || ''))) : 0;
    if (words && !(p > 0)) continue;
    const row = slim ? { suite: r.suite, title: r.title, outcome: r.outcome, at: r.at }
      : { suite: r.suite, title: r.title, outcome: r.outcome, commit: r.commitAt, at: r.at, failure: r.failure || '' };
    // A TEST'S IDENTITY AS ITS KEY (goal/G29.5).
    found.push({ probability: p, pair: { key: history ? String(r.rowid) : r.suite + '\n' + r.title, label: JSON.stringify(row) } });
  }
  const out = rankedRows(found[Symbol.iterator]());
  out.total = found.length;
  return out;
}

// ── THE IDLE HOUR AND ITS CHORES (goal/G8.4, its own clock since goal/G33.3) ─
//
//   Andy: "it knows it's idle for an hour because no verify-requests arrived for an hour". The box: "On its idle hour it
//   runs the chores its own manifest names (each agent configures its own verifier's), handing each its node's port,
//   and nothing more; each chore names the folders it updates and finds its own agent, so the verifier knows neither."
//
// So the hour counts from the last run handed to it (or its start), never from a desk. Once the hour is up and nothing
// runs, each command in `chores` (one per line, or separated by ';') is run in the checkout with the node's port
// appended, one after the other, ONCE per quiet stretch: a new run starts a new one. No chore runs while a run is under
// way, and no run is taken while the chores run (two runs on one host fight over the lab ports, goal/G8.9). A node
// whose manifest names no chore does nothing.
const IDLE_CHECK_MS = Number(values.idleCheckMs) > 0 ? Number(values.idleCheckMs) : 60000;
const CHORES = String(values.chores || '').split(/[\n;]/).map(function (c) { return c.trim(); }).filter(Boolean);
const CHORE_MS = 30 * 60 * 1000;
let choring = false;
let choresFor = '';
function runChore(cmd) {
  const port = Number(spirit.node.port);
  return new Promise(function (resolve) {
    let kid = null;
    const out = [];
    try { kid = spawn(cmd + ' ' + port, { cwd: REPO, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' }); }
    catch (e) { resolve(cmd + ' did not start: ' + ((e && e.message) || e)); return; }
    const timer = setTimeout(function () { killTree(kid); }, CHORE_MS);
    kid.stdout.on('data', function (d) { out.push(String(d)); });
    kid.stderr.on('data', function (d) { out.push(String(d)); });
    kid.on('error', function (e) { clearTimeout(timer); resolve(cmd + ' did not start: ' + ((e && e.message) || e)); });
    kid.on('close', function (code) {
      clearTimeout(timer);
      const last = out.join('').trim().split('\n').filter(Boolean).pop() || '';
      resolve(cmd + (code === 0 ? ': done' : ': exit ' + code) + (last ? ' (' + last.trim().slice(0, 200) + ')' : ''));
    });
  });
}
async function runChores() {
  choresFor = idleState.since;
  choring = true;
  const did = [];
  try { for (const c of CHORES) did.push(await runChore(c)); } finally { choring = false; }
  idleState.chores = did.join('; ') + ' (' + new Date().toISOString() + ')';
  if (!busy) sayIdle();
}
async function idleOnce() {
  if (busy || choring || !CHORES.length) return;
  if (Date.now() - Date.parse(idleState.since) < IDLE_MS || choresFor === idleState.since) return;
  await runChores();
}
const idler = setInterval(function () { idleOnce().catch(function () { /* next tick */ }); }, IDLE_CHECK_MS);
if (idler.unref) idler.unref();

// ── THE STACKS PLUGIN'S DOOR VERDICTS, RECORDED HERE (goal/G27.2) ─────
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.2's box, not this file's to take back: the Stacks subsystem stands alone (D9).
// The plugin drives the stack checks exclusively and this server runs none of them. What stays is door.record: the
// plugin hands each verdict here as a record only (D5), kept under this server's --state, doors/<id>.json, and said in
// the console.
const DOORS_DIR = path.join(STATE || path.dirname(DB_PATH), 'doors');
const DOOR_ID = /^[A-Za-z0-9_-]{1,32}$/;
const DOOR_PATHS_KEPT = 500;
function doorIdOf(id) {
  const s = String(id || '');
  if (!DOOR_ID.test(s)) throw refusedWhy('a door is named by the plugin\'s own id (d<n>): letters, digits, _ and -, at most 32; not ' + JSON.stringify(s.slice(0, 40)));
  return s;
}

// ITS VERBS.
appServer.serve({
  // A RUN, HANDED OVER (goal/G33.3): the suites (spirit/test paths) and the commit the checkout must hold first ('' for
  // what it holds). Taken or busy, and nothing else: it reports to no one; the outcome is read through search.
  run: {
    request: { suites: [''], commit: '' }, reply: {},
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      return Object.keys(a).every(function (k) { return k === 'suites' || k === 'commit'; }) && Array.isArray(a.suites) &&
        a.suites.every(function (p) { return typeof p === 'string' && p; }) && (a.commit === undefined || typeof a.commit === 'string');
    },
    handler: function (a) {
      const commit = String(a.commit || '');
      if (commit && !/^[0-9a-f]{7,40}$/.test(commit)) throw refusedWhy('a commit is 7 to 40 hex characters (lower case), not ' + JSON.stringify(commit.slice(0, 50)));
      if (!a.suites.length) throw refusedWhy('a run needs at least one suite');
      const asked = [];
      a.suites.map(String).forEach(function (p) { if (p === 'spirit/run') productSuites().forEach(function (q) { asked.push(q); }); else asked.push(p); });
      if (!asked.length) throw refusedWhy('the product tree holds no test yet');
      return startRun(asked, commit);
    },
  },
  // THE VERIFIER TAB'S VERBS (goal/G8.11), deskVerify's own:
  //   now    busy or not, the suite running and since when, and whether a Stop was asked (goal/G21.3)
  //   stop   his intervention: the run ends, and a stopped suite is never green
  now: {
    request: {}, reply: { busy: false, running: { suite: '', since: '' }, stopAsked: false },
    handler: function () {
      return { busy: busy, running: { suite: running.suite, since: running.since }, stopAsked: stopped === true && busy };
    },
  },
  stop: {
    request: {}, reply: { stopped: false },
    handler: function () { return stopRun(); },
  },
  // CHORES NOW (goal/G33.11; Andy, 2026-10-24: "the deskVerifier get a new verb: chores.run"): the idle chores at once,
  // as the idle hour runs them, and the hour's own run is then spent. Answered when they start, not when they end; the
  // tab's idle line says what they did. Refused while a run or the chores are under way, or where none is named.
  'chores.run': {
    request: {}, reply: { started: true },
    handler: function () {
      if (!CHORES.length) throw refusedWhy('this verifier\'s manifest names no chore');
      if (busy) throw refusedWhy('a run is under way; the chores wait for it to end');
      if (choring) throw refusedWhy('the chores are running already');
      runChores().catch(function () { /* the idle line says what they did */ });
      return { started: true };
    },
  },
  // A DOOR RUN BY THE PLUGIN ITSELF, RECORDED (goal/G27.2, D5). Andy, 2026-10-17: "i don't want verifier to block the
  // design-a-door process", and "i don't mind if our test sends the verifier a result". The plugin runs a door being
  // designed at once and hands the verdict here as a record only: kept under doors/<id>.json, and its line said in the
  // console. Nothing is run.
  'door.record': {
    request: { id: '', verdict: {} }, reply: { recorded: true },
    handler: function (a) {
      const id = doorIdOf(a.id);
      const v = a.verdict && typeof a.verdict === 'object' ? a.verdict : {};
      const kept = { door: id, ran: v.ran === true, green: v.green === true, around: Number(v.around) || 0, of: Number(v.of) || 0,
        paths: (Array.isArray(v.paths) ? v.paths : []).slice(0, DOOR_PATHS_KEPT).map(String), why: String(v.why || ''),
        startedAt: String(v.startedAt || ''), endedAt: String(v.endedAt || ''), stopped: v.stopped === true, commit: String(v.commit || ''), by: 'plugin' };
      fs.mkdirSync(DOORS_DIR, { recursive: true });
      const out = path.join(DOORS_DIR, id + '.json');
      fs.writeFileSync(out + '.tmp', JSON.stringify(kept));
      fs.renameSync(out + '.tmp', out);
      consoleAdd('\n=== door ' + id + ', run by the plugin: ' + (kept.ran ? (kept.green ? 'green, ' + kept.of + ' production call(s), every one through the gate'
        : 'red, ' + kept.around + ' path(s) around the gate, of ' + kept.of + ' production call(s)') : 'no verdict, ' + kept.why) + ' ===\n');
      return { recorded: true };
    },
  },
  // THE CONSOLE OF THE CURRENT RUN (goal/G22.3): its output from `from`, one answer's room at a time. `to` is where the
  // next read starts, `more` whether output past it is held, `start` the first byte still held (the cap drops the
  // front), `ended` whether the run is over; `run` changes when a new run clears it.
  console: {
    request: { from: 0 }, reply: { run: '', start: 0, from: 0, to: 0, more: false, ended: true, text: '' },
    handler: function (a) { return consoleRead(a.from); },
  },
  // ONE RECORD, AS IT HAPPENS (his words above). The answer says whether it was kept: a repeat of the same outcome is
  // not, and that is the whole of the de-duplication - the history is the flips. Every node keeps its own (goal/G21.3).
  // THE WHY TRAVELS WITH THE RED (goal/G21.3): `failure`, optional, is the text the suite printed for it; capped by keep.
  record: {
    request: { suite: '', title: '', outcome: '', failure: '' }, reply: { written: true },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      const known = ['suite', 'title', 'outcome', 'failure'];
      return Object.keys(a).every(function (k) { return known.indexOf(k) !== -1; }) &&
        typeof a.suite === 'string' && typeof a.title === 'string' && typeof a.outcome === 'string' &&
        (a.failure === undefined || typeof a.failure === 'string');
    },
    handler: function (a) {
      const suite = String(a.suite || '');
      const title = String(a.title || '');
      const outcome = String(a.outcome || '');
      if (!suite || !title) throw new Error('a record needs its suite and its title');
      if (outcome !== 'red' && outcome !== 'green') throw new Error('an outcome is red or green');
      return keep(suite, title, outcome, a.failure);
    },
  },
  // ONE SEARCH, OVER TESTS OR RUNS (goal/G21.3). A read: nothing is written through it. Every key is optional; `over`
  // is required. The verb file beside this server (search.json) makes it an agent tool.
  search: {
    request: { over: '', suite: '', test: '', outcome: '', commit: '', since: '' },
    reply: { items: [{ key: '', label: '' }], more: false, total: 0 },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      return Object.keys(a).every(function (k) { return SEARCH_KEYS.indexOf(k) !== -1 && typeof a[k] === 'string'; });
    },
    handler: function (a) { return search(a); },
  },
});
