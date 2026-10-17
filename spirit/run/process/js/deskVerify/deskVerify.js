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
//   - "runs don't interest deskVerify at all": nothing stores a run, so there is no run table and no run id.
//   - An outcome is red or green: "so we forget unhappy and worry just about red/green".
//   - "the called suite sends one test-record at the time, no fucking bundling or other complicated stuff, we don't
//     worry about the bit of extra time it takes." So `record` takes ONE record. Do not add a batch verb.
//   - verify.db lives in this folder and git ignores it (goal/G8.1's box), so a clone carries the code and not the
//     measurements; the `db` argument names another file, which every suite uses so no test touches the real one.
//   - The commit, the dirty tree and the time are stamped HERE, never sent: deskVerify launched the run, so it knows
//     them, and a suite cannot claim a commit it was not measured at.
//
// WHERE IT RUNS (goal/G8.3, his rulings of 2026-10-09): "deskVerify belongs to my clone and is a companion to desk, it
// runs on your clone only as a personal check (is my work done?)", and on an agent's clone "it will never commit" —
// an agent's copy answers its own agent and never speaks for the desk. This file is the same code either way; what
// differs is whose node runs it.
// EVERY NODE KEEPS ITS OWN RECORDS (goal/G21.3, Andy's ruling): an agent's copy keeps test records in the same shape
// as the desk node's, private to that agent's work and never shared through git, so the agent's results can be
// compared with the official record through the search verb. The desk node's copy stays the authoritative record.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const appClient = require('../../../js/appClient.js');
const probabilityStringMatch = require('../../../js/probabilityStringMatch.js').probabilityStringMatch;
const createProbabilityBucket = require('../../../js/probabilityBucket.js').createProbabilityBucket;

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
// EVERY RUN IS VERIFIER HISTORY (goal/G19.3). Andy, 2026-10-12: "and we make sure it doesn't stop working until the
// queue is worked off.", then "so the runs must be stored verifier history, in verifier.db" (this file, verify.db). A
// run is a row from the moment it is queued: queued, running, ended, with what it came to. The queue in memory is only
// the order of the rows not ended, so a restart takes them up again in that order; a run that was running starts over
// from the beginning (Andy, of a stopped suite: "we will not support resume").
db.exec('CREATE TABLE IF NOT EXISTS runs (rowid INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,' +
  ' state TEXT NOT NULL, outcome TEXT NOT NULL, queuedAt TEXT NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT NOT NULL);' +
  'CREATE INDEX IF NOT EXISTS runs_state ON runs (state);');
// THE COMMIT A RUN WAITS FOR (goal/G19.13). A claim carries the commit it was made at, and a run whose commit the tree
// does not hold yet is kept as 'waiting' with it, so a restart takes up the wait and not only the queue. Added to a
// verify.db that predates it, guarded, so an existing db keeps its rows; '' for a run that names no commit.
if (!db.prepare('PRAGMA table_info(runs)').all().some(function (c) { return c.name === 'commit'; })) {
  db.exec('ALTER TABLE runs ADD COLUMN "commit" TEXT NOT NULL DEFAULT \'\'');
}
// WHEN EACH TEST WAS LAST REPORTED (goal/G27.14), on every record, a repeat too, where results keeps flips only: what
// a search for what is red NOW reads (current: yes). Andy, 2026-10-17: "is this really showing just reds? ... it's shows
// items that we just closed?". A table of its own, so the rows results holds are untouched.
db.exec('CREATE TABLE IF NOT EXISTS seen (suite TEXT NOT NULL, title TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (suite, title));');
const seenAt = db.prepare('INSERT INTO seen (suite, title, at) VALUES (?, ?, ?) ON CONFLICT (suite, title) DO UPDATE SET at = excluded.at');
const runQueued = db.prepare('INSERT INTO runs (kind, id, state, outcome, queuedAt, startedAt, endedAt, "commit") VALUES (?, ?, \'queued\', \'\', ?, \'\', \'\', ?)');
const runStarted = db.prepare('UPDATE runs SET state = \'running\', startedAt = ? WHERE rowid = ?');
const runEnded = db.prepare('UPDATE runs SET state = \'ended\', outcome = ?, endedAt = ? WHERE rowid = ?');
// A waiting run's startedAt is when its wait began, which is what the give-up hour counts from; a run taken up again is
// started afresh, and its startedAt then says when it ran.
const runWaiting = db.prepare('UPDATE runs SET state = \'waiting\', startedAt = ? WHERE rowid = ?');
const runRequeued = db.prepare('UPDATE runs SET state = \'queued\' WHERE rowid = ?');
const runCommit = db.prepare('UPDATE runs SET "commit" = ? WHERE rowid = ?');
const runsOpen = db.prepare('SELECT rowid, kind, id, state, "commit" AS commitAt, startedAt FROM runs WHERE state != \'ended\' ORDER BY rowid');
// THE WHY BESIDE THE RED, AND THE LINE BESIDE THE RUN (goal/G21.3). Andy's box: "deskVerify keeps, beside each failing
// test's outcome, its failure text (capped), so the why is in the record", and a run is searched with "its outcome and
// the line it posted". Added to a verify.db that predates them, guarded, as the commit column was; '' where none.
if (!db.prepare('PRAGMA table_info(results)').all().some(function (c) { return c.name === 'failure'; })) {
  db.exec('ALTER TABLE results ADD COLUMN failure TEXT NOT NULL DEFAULT \'\'');
}
if (!db.prepare('PRAGMA table_info(runs)').all().some(function (c) { return c.name === 'line'; })) {
  db.exec('ALTER TABLE runs ADD COLUMN line TEXT NOT NULL DEFAULT \'\'');
}
const runLine = db.prepare('UPDATE runs SET line = ? WHERE rowid = ?');
const runCommitAt = db.prepare('UPDATE runs SET "commit" = ? WHERE rowid = ? AND "commit" = \'\'');

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
    // `short` for what a person reads: the result line on an item names the commit it
    // checked (goal/G16.13), and the full hash is not what he compares against a log.
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
//   Andy, 2026-10-11: "my Verifier need to poll for verifications, and pull git when
//   a status change occurs in desk."; "The verifier MUST ALWAYS fucking listen to desk
//   and do that work FIRST."
//
// It checked whatever its clone happened to hold, so an item built and pushed a minute
// ago was measured against code that did not include it — which is how he came to ask
// "why does it not pick up this shit?" and had to be told his tree was behind.
//
// A DIRTY TREE IS NEVER PULLED. His clone is his, and uncommitted work there is his
// work: a pull over it could cost him it. So the tree is read first and a dirty one is
// checked exactly as it stands, with the line saying so, which is the honest answer
// rather than a silent measurement of something else (wsl-claude's point, 2026-10-11,
// recorded in this item's box).
const PULL = String(values.pull === undefined ? 'git pull --ff-only' : values.pull).trim();
async function pullFirst() {
  // READ NOW, NOT FROM THE CACHE (goal/G19.2): a run that starts within two seconds of the last one was judged on that
  // run's tree, so a file left uncommitted in between read as clean and was pulled over - and the undo trusts this word.
  if (treeReading) await treeReading.catch(function () {});
  forgetTree();
  const before = await tree();
  if (before.dirty) return 'dirty, not pulled';
  if (!PULL) return 'no pull command set';
  // Spawned and awaited (goal/G21.3): a pull that waits on the network no longer freezes now and stop.
  const r = await sh(PULL, null);
  // HEAD may have moved, so the commit this check reports is read again rather than
  // taken from the cache the pull just invalidated (and a read begun during the pull is not trusted either).
  if (treeReading) await treeReading.catch(function () {});
  forgetTree();
  return r.status === 0 ? 'pulled' : 'pull failed: ' + String(r.stderr || r.stdout || '').trim().split('\n')[0];
}

// WHERE IT RUNS, READ FROM ITS OWN NODE (goal/G8.2). Andy, 2026-10-09: "deskVerify knows where it runs. and only the
// desk node has the right to commit it's measurements". The node's port is the one appServer hands every app server,
// spirit.core.node.const.SPIRIT_PORT - Andy: "DO NOT RE-INVENT this mechanism!!!!" - and the node is asked which app
// servers it runs. A deskClient marks an agent's node even beside a desk (agent nodes run both since goal/G3.7); a desk
// without one is his clone; neither is out of scope by his word. Kept once read: a node's servers do not change while
// this one runs. A failed read is not kept, so it is asked again next time.
const spirit = appServer.spirit;
let MODE = null;
function mode() {
  if (MODE) return Promise.resolve(MODE);
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  if (!port) return Promise.resolve({ mode: 'none', apps: [] });
  return spirit.core.ask('jobs.api', { ask: 'api' }, 'http://127.0.0.1:' + port).then(function (r) {
    const body = r && r.status === 200 ? r.body : null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { mode: 'none', apps: [] };
    const apps = Object.keys(body);
    MODE = { mode: apps.indexOf('deskClient') !== -1 ? 'agent' : apps.indexOf('desk') !== -1 ? 'desk' : 'none', apps: apps };
    return MODE;
  }, function () { return { mode: 'none', apps: [] }; });
}

// ONE SUITE, RUN WITHOUT STOPPING THE SERVER (goal/G8.6, found by claude-windows verifying 19488845): spawnSync froze
// deskVerify for the whole suite, and a suite posts its records to this very server through the node's door, which
// waits about twelve seconds - so a long suite's records were all lost. Spawned and awaited instead: still one suite
// at a time, and the event loop keeps turning, so every record that arrives mid-run is taken.
// THE TIME LIMIT (goal/G8.10). A suite still running after SUITE_MS is stopped, and being stopped is a red of its own:
// a hung suite prints no FAILURE line, so without this it read as all green and brought the Done button. Andy's gate
// has two guards and this is the second. The manifest's `suiteMs` names it; a suite hands a short one.
const SUITE_MS = Number(values.suiteMs) > 0 ? Number(values.suiteMs) : 600000;
// THE IDLE HOUR (goal/G8.4, brought back by goal/G21.3; the rule is below, at idleOnce). Declared here because every
// published object carries it.
const IDLE_MS = Number(values.idleMs) > 0 ? Number(values.idleMs) : 60 * 60 * 1000;
let idleState = { idle: false, since: '', holding: [], chores: '' };
// WHAT IT IS DOING, FOR THE VERIFIER TAB (goal/G8.11). Andy, 2026-10-09: "shouldn't i have, if the desk verifier is
// mounted and running, a verifier tab in desk, right after [musings], that allows me to monitor a) status and progress
// of the running verifier, and if/when necessary, allow intervention?" Nothing outside this server could see the run,
// so: the item and suite running now, since when, and what waits behind it. One run at a time, so one record of it.
let running = { id: '', suite: '', since: '' };
let runningKid = null;
let stopped = false;
// A STOPPED SUITE TAKES WHAT IT STARTED WITH IT (goal/G19.4). Andy, 2026-10-12: "yes, a stopped suite must clean up after
// itself like any cleanly ended suite. we will not support resume." Killing the suite process alone left the servers it
// had started running on Linux, and the next suite collided with them on the lab ports. So, as runAll does: on Windows
// taskkill /T ends the suite's own tree; elsewhere the suite runs in its own process group and the group is ended.
// Only that suite's tree, never anything found by name.
function killTree(kid) {
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(kid.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* below */ }
    try { kid.kill(); } catch (e) { /* already gone */ }
    return;
  }
  try { process.kill(-kid.pid, 'SIGKILL'); } catch (e) { try { kid.kill('SIGKILL'); } catch (x) { /* already gone */ } }
}
// A LISTED PATH STAYS IN spirit/test (goal/G19.4): spirit/test/../../x.js matched the pattern and was run. The path is
// normalised first; one that leaves the folder is not run, and the item's line says so.
function leavesTests(rel) {
  const norm = path.posix.normalize(String(rel || '').replace(/\\/g, '/'));
  return norm.indexOf('spirit/test/') !== 0 || norm.split('/').indexOf('..') !== -1;
}
// ── THE CONSOLE OF THE CURRENT RUN (goal/G22.3) ──────────────────────────
//
//   Andy, 2026-10-13, in goal/G22.3's box: "it be even better if the verify tab showed the detailed results in a
//   console like fashion, cleared before every new run. If it's solved there, every run even the ones from Stack,
//   already would have output."
//
// DECIDED BY ANDY, not this file's to narrow: every run this server makes keeps its output here, and only the CURRENT
// run's. What each suite prints, stdout and stderr, goes in as it arrives, in order, under a line naming the suite; a
// new run (each job drainQueue starts) clears it first. It is capped in BYTES ("bytes copied, bytes counted",
// 2026-10-10): past CONSOLE_MAX the front is dropped, and offsets stay absolute, so a reader tailing it never reads a
// byte twice. The `console {from}` verb answers one answer's room from an offset; every object `say` publishes carries
// consoleRun and consoleTo, re-said at most every CONSOLE_SAY_MS while output arrives, so the tab tails it live and
// never pulls on a clock.
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
    if (j === i || Buffer.byteLength(JSON.stringify(out), 'utf8') <= appClient.ANSWER_MAX - 512) return out;
    room = Math.floor(room / 2);
  }
}

function runSuite(file, port, onTests, env) {
  return new Promise(function (resolve) {
    const out = [];
    let timedOut = false;
    let tests = 0;
    // THE CONSOLE (goal/G22.3): each suite under a line naming it, then everything it prints.
    consoleAdd('\n=== ' + path.relative(REPO, file).split(path.sep).join('/') + ' ===\n');
    const kid = spawn(process.execPath, [file, '--verify-port', String(port)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
      env: env ? Object.assign({}, process.env, env) : process.env });
    runningKid = kid;
    // EACH ASSERTION AS IT IS PRINTED (goal/G8.12), so the tab's bar moves while a suite runs rather than once it
    // ends. The printed lines are what every reader of a suite uses (runAll, the claim check), not the exit code.
    const count = function (text) {
      const n = String(text).split('\n').filter(function (l) { return /SUCCESS #|FAILURE #/.test(l); }).length;
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
// (appServer.publish, which the page hears with onPublished(fn, 'deskVerify')) - never a log: the tab keeps the newest
// and replaces it. The page asks nothing, as his no-pulling rule requires.
//   doing     'item' one item's suites, 'goal' an emptied goal's suites, 'full' the whole folder (his button) or the
//             short loop, 'idle' nothing running
//   index/of  which suite of how many; tests/expected: assertions printed so far, and how many that suite reported
//             the last time it was measured (0 when it was never seen)
//   since     idle: the newest desk write this server knows, which is what the tab counts the idle hour from
const testsSeen = db.prepare('SELECT COUNT(DISTINCT title) AS n FROM results WHERE suite = ?');
function expectedOf(rel) {
  try { return Number((testsSeen.get(path.basename(String(rel))) || {}).n) || 0; } catch (e) { return 0; }
}
//   stopAsked a Stop was taken and the run has not ended yet (goal/G21.3), so the tab says "stop asked"
//   idleMs    idle: the hour the countdown counts to, this server's own (goal/G21.3), so the tab never guesses it
//   holding   idle: the items its agent holds a phase on, which keep the node busy however long the quiet
//   chores    idle: what the idle chores did, one line, '' until they have run
let lastWriteAt = '';
let lastSaid = null;
function say(o) {
  const one = {
    doing: String(o.doing || 'idle'), id: String(o.id || ''), suite: String(o.suite || ''),
    index: Number(o.index) || 0, of: Number(o.of) || 0, tests: Number(o.tests) || 0,
    expected: Number(o.expected) || 0, line: String(o.line || ''), since: String(o.since || ''),
    stopAsked: stopped === true,
    idleMs: IDLE_MS, holding: idleState.holding.slice(), chores: String(idleState.chores || ''),
    // THE CONSOLE'S RUN AND HOW FAR IT HAS COME (goal/G22.3), so the tab tails it with `console`.
    consoleRun: consoleRun, consoleTo: consoleEnd, consoleEnded: consoleEnded,
  };
  lastSaid = one;
  appServer.publish(one);
}
function sayIdle(line) {
  say({ doing: 'idle', line: line || (idleState.chores ? 'idle; ' + idleState.chores : 'idle, nothing running'),
    since: idleState.since || lastWriteAt || new Date().toISOString() });
}
// The newest object said again with the stop marked, so the tab shows "stop asked" at once and not at the next suite.
function sayAgain() { if (lastSaid) say(Object.assign({}, lastSaid)); }

// ── A STOP IS KEPT FOR THE WHOLE RUN (goal/G21.3) ────────────────────────
//
//   Andy's box: "A Stop is kept for the whole run, whenever it is pressed (a suite running, pulling, between suites,
//   waiting for a commit), and deskVerify checks it before each suite; the tab shows "stop asked" until the run ends."
//
// It was taken only while a suite process ran, so a Stop pressed during the pull or between two suites answered
// stopped: false and the run went on. Now: while a run is on (`checking`), the Stop is kept in `stopped` until that run
// ends - drainQueue clears it after each run, never at a run's start - and every run checks it before each suite; the
// suite running now, if any, is ended at once. With no run on, the claims waiting for their commit are the run: each is
// ended, with one line saying so. Nothing at all to stop answers stopped: false.
// HIS INTERVENTION (goal/G8.11): the claim it belonged to is rejected saying so. A stopped run is never a pass - the
// same rule as the time limit, for the same reason: nothing was measured.
function stopRun() {
  if (checking) {
    stopped = true;
    if (runningKid) killTree(runningKid);
    sayAgain();
    return { stopped: true };
  }
  if (waitingFor.length) {
    const jobs = waitingFor.splice(0);
    jobs.forEach(function (job) {
      const text = 'deskVerify: stopped by hand from the verifier tab while waiting for ' + shortOf(job.commit) + '; nothing was checked. Claim again to have it checked.';
      if (job.row) { runEnded.run('stopped by hand', new Date().toISOString(), job.row); runLine.run(text, job.row); }
      desk('chat.add', { id: job.id, text: text });
    });
    return { stopped: true };
  }
  return { stopped: false };
}

// THE VERBS ONLY SUITES CALLED WENT UNDER goal/G19.11: mode, suites, loop.once, idle, chore.once, goal.check,
// records.search and claim.check. The work they named runs from the watcher and the queue (claimCheck, goalRun, fullRun,
// redCheck below); mode() and claimCheck() stay as functions. The short loop (goal/G8.6), the idle chores (goal/G8.4) and
// the tolerated-reds grant (goal/G8.7) had nothing but those verbs to start them, so they went with them.

// ONE ITEM'S SUITES, from the item itself: its file list (goal/G8.8), the test files among them.
function suitesOf(id) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  if (!port) return Promise.resolve([]);
  return spirit.core.ask('jobs.api', { ask: { desk: { 'item.get': { id: String(id) } } } }, 'http://127.0.0.1:' + port).then(function (r) {
    let it = null;
    try { it = JSON.parse((r && r.body && r.body.item) || 'null'); } catch (e) { it = null; }
    const files = it && Array.isArray(it.files) ? it.files : [];
    const out = Object.create(null);
    files.forEach(function (f) {
      const p = String((f && f.path) || '');
      if (/^spirit\/test\/.+\.js$/.test(p)) out[p] = true;
    });
    return Object.keys(out).sort();
  }, function () { return []; });
}

// THE ONE THING IT MAY DO (goal/G8.3). Andy, 2026-10-09: "deskVerify only reject a done claim. this should prompt an
// agent to pick the item up, raise red-questions if neccessary.", and "deskVerify will NOT press done or closed on my
// behalf". So: run the item's own suites, and if any assertion was red, ask the desk to take the verify back, naming
// the reds. All green and it says nothing to the desk. It presses nothing, ever.
// Each suite is spawned and awaited, as the loop does, so this server keeps answering while it runs - its own records
// arrive through the node's door while a suite is still going (goal/G8.6).
// The tab reads `running` while this runs, so it is cleared however the check ends (goal/G8.11).
function claimCheck(id) {
  // The tab reads the run from what this publishes, so the end of a check says idle however it ended (goal/G8.12).
  // The stop is not cleared here: drainQueue clears it once the whole run has ended (goal/G21.3).
  const idle = function () { running = { id: '', suite: '', since: '' }; sayIdle(); };
  // AND A CHECK THAT BREAKS STILL SAYS SO (goal/G16.13, found by claude-windows: "your
  // verifier now shows nothing running and the item still says waiting, with no result
  // line, so the run that ended or was stopped wrote nothing"). The line is the whole
  // point of this item — he must never have to guess whether a check happened — so the
  // one path that wrote nothing is the one that most needed to.
  return claimCheckRun(id).then(function (r) { idle(); return r; }, function (e) {
    idle();
    const port = Number(spirit.core.node.const.SPIRIT_PORT);
    const text = 'deskVerify: the check of ' + String(id) + ' broke before it finished: ' + ((e && e.message) || e)
      + '. Nothing was measured, so this is not a pass.';
    noteLine(text);
    return spirit.core.ask('jobs.api', { ask: { desk: { 'chat.add': { id: String(id), text: text } } } },
      'http://127.0.0.1:' + port).catch(function () { /* said on stderr below */ })
      .then(function () { throw e; });
  });
}
// The commits written under the item that this tree does not hold (goal/G18.10). A hash git cannot name is lacking;
// so is one it names that is not an ancestor of HEAD. An item with no commit line lacks nothing.
function commitsLacking(id, port) {
  return spirit.core.ask('jobs.api', { ask: { desk: { 'item.chat': { id: String(id) } } } }, 'http://127.0.0.1:' + port).then(function (r) {
    const body = r && r.body && r.body.body ? r.body.body : (r && r.body) || {};
    const chat = Array.isArray(body.chat) ? body.chat : [];
    const hashes = [];
    chat.forEach(function (l) {
      const m = /^commit ([0-9a-f]{7,40})\b/.exec(String(l && l.text || ''));
      if (m && hashes.indexOf(m[1]) === -1) hashes.push(m[1]);
    });
    // Awaited one by one, never spawnSync (goal/G21.3): the ancestry check no longer freezes now and stop.
    return (async function () {
      const lacking = [];
      for (const h of hashes) if (!(await holds(h))) lacking.push(h);
      return lacking;
    }());
  }, function () { return []; });
}
// THE LINE A RUN POSTED, kept on its row (goal/G21.3), so a search over runs answers what it said.
function noteLine(text) { if (runningJob && runningJob.row) runLine.run(String(text), runningJob.row); }
async function claimCheckRun(id) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  running = { id: String(id), suite: '', since: new Date().toISOString() };
  say({ doing: 'item', id: id, line: 'pulling before checking ' + id, since: running.since });
  // FIRST, BEFORE ANYTHING IS ASKED OR RUN (goal/G16.13): the tree this check will
  // measure is brought up to date, or said to be dirty, before the item's own facts
  // are read — so the suites that run are the suites the item now lists.
  const pulled = await pullFirst();
  // ONE LINE ON THE ITEM, WHATEVER HAPPENS (goal/G16.13). Andy, 2026-10-11: "How do i
  // FUCKING know the result of verifier? it said it ran 16.5, but i don't see where the
  // result is, or if 16.5 passed." Called directly it answered only its caller and
  // wrote nothing, so a verdict existed and he could not see it. Said once per check.
  const report = function (text) {
    noteLine(text);
    return spirit.core.ask('jobs.api', { ask: { desk: { 'chat.add': { id: String(id), text: text } } } },
      'http://127.0.0.1:' + port).catch(function () { /* the verdict below still stands */ });
  };
  // THE PASS IS BOUND TO THE ITEM'S COMMIT (goal/G18.10). Found live on 2026-10-12: it passed goal/G18.7 "at 24533a26
  // (dirty, not pulled)" while the item's commit was 227b0ad4, so the suites it ran were older than the item's and the
  // pass named code that was not the item's. Andy: "yes." to "no pass without the item's commit". The item's commits
  // are the lines commitCheck writes under it ("commit <hash>: ..."); with one missing from this tree nothing is
  // measured, so it is neither a pass nor a reject, and the line says which commit it waits for.
  const lacking = await commitsLacking(id, port);
  if (lacking.length) {
    const at0 = await tree();
    await report('deskVerify: not checked, at ' + (at0.short || at0.commit || 'an unknown commit') + ' (' + pulled + '): the tree lacks the item\'s commit '
      + lacking.map(function (h) { return h.slice(0, 8); }).join(', ') + '. Nothing was measured, so this is not a pass.');
    return { rejected: false, unchecked: true, lacking: lacking };
  }
  return suitesOf(id).then(async function (list) {
    const reds = [];
    const failed = [];
    // NOTHING TO RUN IS NOT A PASS (goal/G8.10, grown from rule/11 point 2): an item with no test file on its list had
    // no reds, and no reds asked verify.pass - so it took the Done button without one assertion having run.
    // AND NOT A REFUSAL EITHER (goal/G27.2, D10). Andy, 2026-10-17: "i don't want deskVerify to refuse runs required by
    // my agents. deskVerify is dumb, and cannot decide if a new run is neccessary or not." A listed file that is missing
    // from the checkout, or leaves spirit/test, is said in the report and the rest is run; with nothing run at all the
    // check is "not checked", neither a pass nor a reject, as a check whose commit is not here yet.
    const unrun = [];
    let ran = 0;
    if (!list.length) unrun.push('the item lists no test file');
    let byHand = false;
    for (const rel of list) {
      const file = path.join(REPO, rel);
      // THE STOP IS CHECKED BEFORE EACH SUITE (goal/G21.3): one pressed during the pull or between suites ends the
      // check here, before the next suite starts.
      if (stopped) { byHand = true; reds.push({ suite: rel, failures: ['stopped by hand from the verifier tab before it ran, so nothing was measured'] }); break; }
      if (leavesTests(rel)) { unrun.push(rel + ' leaves spirit/test, so it was not run'); continue; }
      if (!fs.existsSync(file)) { unrun.push(rel + ' is missing from this checkout'); continue; }
      ran++;
      running = { id: String(id), suite: rel, since: new Date().toISOString() };
      const index = list.indexOf(rel) + 1;
      const expected = expectedOf(rel);
      const where = path.basename(rel) + ', suite ' + index + ' of ' + list.length;
      const told = function (tests) {
        say({ doing: 'item', id: id, suite: rel, index: index, of: list.length, tests: tests, expected: expected,
          line: 'running ' + where + (expected ? ', ' + tests + ' of about ' + expected + ' tests' : ', ' + tests + ' tests'),
          since: running.since });
      };
      told(0);
      const run = await runSuite(file, port, told);
      const said = run.said;
      // STOPPED BY HAND (goal/G8.11): the rest of the list is not run either - he stopped the check, not one suite.
      if (run.stopped) { byHand = true; reds.push({ suite: rel, failures: ['stopped by hand from the verifier tab, so nothing was measured'] }); break; }
      // Stopped at the time limit: red, whatever it printed. Its own lines still come, so a suite that failed and then
      // hung names both.
      if (run.timedOut) reds.push({ suite: rel, failures: ['stopped at the time limit of ' + SUITE_MS + 'ms, so it counts as red'] });
      // The failures as the suite printed them, so the why names what went red rather than only which file did.
      // THE PRINTED LINES ARE THE VERDICT, not the exit code: testSupport sets exitCode 1 on a failure, but a suite
      // that ends with process.exit(0) - most of them do - overrides it, and runAll reads the printed report for the
      // same reason. Found while building this: a red probe exited 0 and would have passed as green.
      const lines = said.split('\n').filter(function (l) { return /FAILURE #/.test(l); })
        .map(function (l) { return l.replace(/^\**\s*/, '').replace(/\s*[❌✅]\s*$/, '').trim(); });
      if (lines.length) { reds.push({ suite: rel, failures: lines }); failed.push(rel); }
    }
    // A RED HERE TAKES BACK THE DONE OF EVERY SETTLED ITEM LISTING THE SUITE (goal/G19.2), as a goal run's does; the
    // item checked now is open, so it is never among them.
    const undo = await regress(failed, pulled, 'item check');
    const at = await tree();
    const where = 'at ' + (at.short || at.commit || 'an unknown commit') + ' (' + pulled + ')' + regressSaid(undo);
    const besides = unrun.length ? ' Not run: ' + unrun.join('; ') + '.' : '';
    if (!ran && !reds.length) {
      await report('deskVerify: not checked, at ' + (at.short || at.commit || 'an unknown commit') + ' (' + pulled + '): nothing ran, so this is not a pass.' + besides);
      return { rejected: false, unchecked: true, unrun: unrun };
    }
    if (!reds.length) {
      // ALL GREEN IS ITS WORD TOO (goal/G8.3, found by claude-windows verifying b93a54d1): Andy, "only deskVerify brings
      // the button", so saying nothing would leave Done forever absent on his node. verify.pass is that word.
      await report('deskVerify: passed, ' + where + '. ' + (ran === 1 ? '1 suite' : ran + ' suites') + ' ran green.' + besides);
      return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.pass': { id: String(id) } } } }, 'http://127.0.0.1:' + port)
        .then(function () { return { rejected: false, reds: [] }; }, function () { return { rejected: false, reds: [] }; });
    }
    const why = reds.map(function (x) { return x.suite + (x.failures.length ? ': ' + x.failures.join('; ') : ''); }).join(' | ');
    // The red suites by name, so the line says WHAT to go and look at and not only that
    // something failed.
    await report('deskVerify: rejected, ' + where + '. Red: ' + why + besides);
    return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.reject': { id: String(id), why: why } } } }, 'http://127.0.0.1:' + port)
      .then(function () { return { rejected: true, stopped: byHand, reds: reds.map(function (x) { return x.suite; }) }; },
        function () { return { rejected: true, stopped: byHand, reds: reds.map(function (x) { return x.suite; }) }; });
  });
}

// THE WATCHER (goal/G8.10). Andy, 2026-10-09, on what starts the check: "deskVerify watching changes.", and "an agent
// should be able to trigger a re-verify". Until now claim.check was a verb nobody called, so no code item on his node
// ever got its Done button. This reads the desk's own `changes` from a cursor of its own - the idle cursor is another
// reader and the two must not eat each other's pages - and runs the check on two words and no others:
//   a verifier's pass   phase.done, phase verify, pass true (NO LONGER since goal/G19.13: the claim that follows it,
//                       carrying its commit, is the trigger; see watched())
//   an agent's re-verify  verify.again
// What is already on the record when it starts triggers nothing (a restart would re-run the whole history), each record
// triggers once, and one check runs at a time: two suite runs on one host fight over the lab ports (goal/G8.9).
// A failed verify is not watched: it went back to build by itself, and there is nothing to pass.
// ON HIS NODE ONLY: an agent's deskVerify is a personal check (goal/G8.3, "it will never commit"), so it watches
// nothing and speaks to no desk; mode() says which node this is.
const WATCH_MS = Number(values.watchMs) > 0 ? Number(values.watchMs) : 5000;
let watchAt = -1;
let checking = false;
// ONE READ AT A TIME, AND ONE WORD IS ONE CHECK (goal/G8.12, found by claude-windows on his node: one verify.again
// gave four passes). The interval started a read every watchMs without waiting for the last, so while the desk was
// slow - which it is while a suite runs - two reads saw the same record and queued it twice. `reading` holds the tick,
// and an id already waiting or already being checked is not queued again: the repeat cost whole suite runs.
let reading = false;
const watchQueue = [];
// THE CLAIMS WAITING FOR THEIR COMMIT (goal/G19.13), apart from the queue: a job here is not run until the tree holds
// its commit, and the queue behind it is not held up by it.
const waitingFor = [];
// The job drainQueue is running now, so a word about it is told apart by its kind and its commit (goal/G19.13).
let runningJob = null;
// A job joins the queue as a row, and the row is the record (goal/G19.3).
function enqueue(job) {
  const row = runQueued.run(String(job.kind), String(job.id), new Date().toISOString(), String(job.commit || ''));
  watchQueue.push({ kind: String(job.kind), id: String(job.id), commit: String(job.commit || ''), row: Number(row.lastInsertRowid) });
}
// What the last restart left unended, taken up in order before anything new. A run that was waiting for its commit
// waits on, its line already said and its hour counted from when the wait began (goal/G19.13), so the restart posts
// nothing new for it.
runsOpen.all().forEach(function (r) {
  const job = { kind: String(r.kind), id: String(r.id), commit: String(r.commitAt || ''), row: Number(r.rowid) };
  if (r.state === 'waiting') { job.said = true; job.since = Date.parse(String(r.startedAt || '')) || Date.now(); waitingFor.push(job); } else watchQueue.push(job);
});
// A NEWER CLAIM OF THE SAME KIND ON THE SAME ITEM (goal/G19.13) is not a second run: the one already queued or waiting
// takes the newer commit, which is the one the claim now stands at.
function queuedAlready(job) {
  const same = watchQueue.concat(waitingFor).filter(function (q) { return q.kind === job.kind && q.id === job.id; })[0];
  if (same) {
    if (job.commit && same.commit !== job.commit) { same.commit = String(job.commit); same.said = false; same.since = Date.now(); if (same.row) runCommit.run(same.commit, same.row); }
    return true;
  }
  // The check running now is the same word only when it is the same kind (a red check is not the item's check) and,
  // for a claim with a commit, at the same commit: a newer claim waits behind it rather than being swallowed.
  if (job.kind !== 'item' && job.kind !== 'red') return false;
  const busy = runningJob || (running.id ? { kind: 'item', id: running.id, commit: '' } : null);
  return !!busy && busy.kind === job.kind && busy.id === job.id && (!job.commit || busy.commit === job.commit);
}
function watched(r) {
  let b = null;
  try { b = JSON.parse(r && r.body || 'null'); } catch (e) { b = null; }
  if (!b || !b.id) return null;
  // A RE-VERIFY OF A GOAL IS ITS GOAL RUN (goal/G19.2): the desk marks the record goal: true. It is the way back for a
  // goal whose goal.emptied this server never saw (written while it was down, and read as history on its first walk).
  if (r.verb === 'verify.again' && b.goal === true) return { kind: 'goal', id: String(b.id), again: true };
  if (r.verb === 'verify.again') return { kind: 'item', id: String(b.id) };
  // A CLAIM CARRIES ITS COMMIT (goal/G19.13). Andy, 2026-10-12: "these push things, when you report a claim on code, it
  // should be accompanied by the commit id, that way desk verify won't check something that hasn't arrived yet... ?",
  // and of the red: "they should be red. at the time". A build claim is the item's check, run once the tree holds its
  // commit; a red claim is a RED check at its commit. Found before it: a claim that ran ahead of its push was checked on
  // the old tree (goal/G19.12).
  if (r.verb === 'claim' && String(b.phase) === 'build') return { kind: 'item', id: String(b.id), commit: String(b.commit || '') };
  if (r.verb === 'claim' && String(b.phase) === 'red') return { kind: 'red', id: String(b.id), commit: String(b.commit || '') };
  // THE VERIFY-PHASE PASS STARTS NOTHING WITHOUT A COMMIT (goal/G19.13, decided in the item). It came without a commit,
  // a moment before the claim, so it checked the old tree; the claim that follows it is the trigger. Do not put that back.
  // WITH THE CLAIMED COMMIT IT QUEUES THE CHECK (goal/G27.2, D11). Andy, 2026-10-17: "make that press queue it.": the pass
  // sets the item back to waiting for deskVerify, and since D11 the desk writes the item's claimed commit on it, so the
  // check waits for that commit as a claim's does and never measures an older tree.
  if (r.verb === 'phase.done' && String(b.phase) === 'verify' && b.pass === true && /^[0-9a-f]{7,40}$/.test(String(b.commit || ''))) {
    return { kind: 'item', id: String(b.id), commit: String(b.commit) };
  }
  // A CLAIM IS A TRIGGER (goal/G16.13). It was not, so a plain item — which has no
  // verify phase to pass — was never checked at all, and the Done it offered had been
  // through nothing. Andy, 2026-10-11: "only the verifier should give me a done button,
  // that's one way of knowing that the 'Done' offered went through the verifier."
  // (Since goal/G19.13 the press is the claim of a caller with no commit: it is checked at once, on what the tree holds.)
  if (r.verb === 'press' && String(b.what) === 'claim-done') return { kind: 'item', id: String(b.id) };
  // THE GOAL HAS EMPTIED (goal/G8.12): the desk writes this when its last item goes, and it starts the goal run
  // (goal/G14.3: the goal's own suites; the full harness is his button's alone).
  if (r.verb === 'goal.emptied') return { kind: 'goal', id: String(b.id) };
  return null;
}
// ── A CLAIM WAITS FOR ITS COMMIT (goal/G19.13) ───────────────────────────
//
//   Andy, 2026-10-12: "these push things, when you report a claim on code, it should be accompanied by the commit id,
//   that way desk verify won't check something that hasn't arrived yet... ?"
//
// A job that names a commit is checked only once this tree holds it: pulled first, then git asked whether the commit
// is an ancestor of HEAD (a commit git cannot name is not held either). Until then it is neither passed nor rejected:
// one line on the item says what it waits for, and it waits apart from the queue, quietly, each later attempt pulling
// first (every WAIT_MS, never while a run is measuring, which a pull would move under it). Past GIVE_UP_MS of waiting
// it is dropped with one line saying so. The wait is a row in verify.db ('waiting', with the commit), so a restart takes
// it up and posts nothing new. A newer claim of the same kind on the same item moves the wait to its commit.
const WAIT_MS = Number(values.waitMs) > 0 ? Number(values.waitMs) : 60000;
const GIVE_UP_MS = Number(values.waitGiveUpMs) > 0 ? Number(values.waitGiveUpMs) : 60 * 60 * 1000;
function holds(commit) {
  // Only a hash is handed to git: the desk refuses anything else at the claim, and this never trusts that alone.
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) return Promise.resolve(false);
  // Awaited, never spawnSync (goal/G21.3).
  return sh('git', ['merge-base', '--is-ancestor', String(commit), 'HEAD']).then(function (r) { return r.status === 0; });
}
function shortOf(commit) { return String(commit || '').slice(0, 8); }
async function startWaiting(job, pulled) {
  job.since = job.since || Date.now();
  if (job.row) runWaiting.run(new Date(job.since).toISOString(), job.row);
  waitingFor.push(job);
  if (job.said) return;
  job.said = true;
  const t = await tree();
  const text = 'deskVerify: not checked, waiting for ' + shortOf(job.commit) + ': the tree, at ' +
    (t.short || t.commit || 'an unknown commit') + ' (' + pulled + '), does not hold the commit the ' + (job.kind === 'red' ? 'red ' : '') + 'claim was made at. Nothing was measured, so this is neither a pass nor a reject; it is checked once the commit arrives.';
  if (job.row) runLine.run(text, job.row);
  await desk('chat.add', { id: job.id, text: text });
}
let waitTicking = false;
async function waitOnce() {
  if (!waitingFor.length || checking || waitTicking) return;
  waitTicking = true;
  try {
    const m = await mode();
    if (m.mode !== 'desk' || checking) return;
    await pullFirst();
    // Read after the pull: a Stop pressed while it ran has ended the waiting runs, and they are not taken up again.
    for (const job of waitingFor.slice()) {
      if (waitingFor.indexOf(job) === -1) continue;
      if (await holds(job.commit)) {
        if (waitingFor.indexOf(job) === -1) continue;
        waitingFor.splice(waitingFor.indexOf(job), 1);
        if (job.row) runRequeued.run(job.row);
        watchQueue.push(job);
      } else if (Date.now() - job.since >= GIVE_UP_MS) {
        if (waitingFor.indexOf(job) === -1) continue;
        waitingFor.splice(waitingFor.indexOf(job), 1);
        const text = 'deskVerify: gave up waiting for ' + shortOf(job.commit) + ': the tree still lacks it after ' +
          Math.round((Date.now() - job.since) / 60000) + ' minutes, so nothing was checked. Push it and claim again.';
        if (job.row) { runEnded.run('gave up waiting', new Date().toISOString(), job.row); runLine.run(text, job.row); }
        await desk('chat.add', { id: job.id, text: text });
      }
    }
  } finally { waitTicking = false; }
  if (watchQueue.length) drainQueue();
}

// ── THE RED CHECK (goal/G19.13) ──────────────────────────────────────────
//
//   Andy, 2026-10-12: "and why are the reds not claimed as complete that way, so the verifier can check them, they
//   should be red. at the time", and "yes" to the red phase ending with its own commit, checked red by deskVerify.
//
// At the claimed commit, every test file the item lists is run (the same list and the same leavesTests guard as an
// item's check) and a red is at least one FAILURE line. One line on the item says which: confirmed when at least one
// suite is red (goal/G27.2, D10), naming them and, beside them, every one already green and any that could not be run;
// not confirmed only when none is red. A red is what is
// expected here, so it presses neither verify.pass nor verify.reject, and it never runs the undo (verify.regress).
async function redCheck(id, commit) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  running = { id: String(id), suite: '', since: new Date().toISOString() };
  try {
    const list = await suitesOf(id);
    const reds = [];
    const greens = [];
    const unrun = [];
    if (!list.length) unrun.push('the item lists no test file');
    for (const rel of list) {
      const file = path.join(REPO, rel);
      // The stop is checked before each suite (goal/G21.3).
      if (stopped) { unrun.push(rel + ' was not run: stopped by hand'); break; }
      if (leavesTests(rel)) { unrun.push(rel + ' leaves spirit/test, so it was not run'); continue; }
      if (!fs.existsSync(file)) { unrun.push(rel + ' is missing from this checkout'); continue; }
      running = { id: String(id), suite: rel, since: new Date().toISOString() };
      const index = list.indexOf(rel) + 1;
      const expected = expectedOf(rel);
      const told = function (tests) {
        say({ doing: 'item', id: id, suite: rel, index: index, of: list.length, tests: tests, expected: expected,
          line: 'red check: ' + path.basename(rel) + ', suite ' + index + ' of ' + list.length + ', ' + tests + ' tests',
          since: running.since });
      };
      told(0);
      const run = await runSuite(file, port, told);
      if (run.stopped) { unrun.push(rel + ' was stopped by hand'); break; }
      if (/FAILURE #/.test(run.said)) reds.push(rel);
      else if (run.timedOut) unrun.push(rel + ' was stopped at the time limit of ' + SUITE_MS + 'ms, printing no red');
      else greens.push(rel);
    }
    const t = await tree();
    const at = shortOf(commit) || t.short || t.commit || 'an unknown commit';
    // ONE RED SUITE CONFIRMS THE RED (goal/G27.2, D10): an item's list also holds suites the work only touched, which
    // may well be green at the red; they and any that could not be run are said beside it, never held against it.
    const others = greens.map(function (g) { return g + ' is already green'; }).concat(unrun);
    const confirmed = reds.length > 0;
    const text = confirmed
      ? 'deskVerify: red confirmed at ' + at + ': ' + reds.join(', ') + (others.length ? '. Beside it: ' + others.join('; ') : '')
      : 'deskVerify: red not confirmed at ' + at + ': ' + others.join('; ');
    noteLine(text);
    await desk('chat.add', { id: String(id), text: text });
    return { red: true, confirmed: confirmed };
  } finally {
    running = { id: '', suite: '', since: '' };
    sayIdle();
  }
}

// ── THE STACKS PLUGIN'S DOOR VERDICTS, RECORDED HERE (goal/G27.2) ─────
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.2's box, not this file's to take back: the Stacks subsystem stands alone (D9).
// The plugin drives the stack checks exclusively and this server runs none of them: goal/G22.3's door.run and door.state,
// which queued a door here and read its verdict back, are gone with their suite, and oneDoorStacks.js is on
// spirit/test/notASuite.js, so neither a full run nor runAll takes it. What stays is door.record: the plugin hands each
// verdict here as a record only (D5), kept under this server's --state, doors/<id>.json, and said in the console.
const DOORS_DIR = path.join(STATE || path.dirname(DB_PATH), 'doors');
const DOOR_ID = /^[A-Za-z0-9_-]{1,32}$/;
const DOOR_PATHS_KEPT = 500;
function doorIdOf(id) {
  const s = String(id || '');
  if (!DOOR_ID.test(s)) throw refusedWhy('a door is named by the plugin\'s own id (d<n>): letters, digits, _ and -, at most 32; not ' + JSON.stringify(s.slice(0, 40)));
  return s;
}

async function drainQueue() {
  // NOT WHILE THE IDLE CHORES RUN (goal/G21.3): publishData runs the harness, and two runs on one host fight over the
  // lab ports (goal/G8.9). The chores drain the queue themselves when they end.
  if (checking || choring) return;
  checking = true;
  try {
    while (watchQueue.length) {
      const job = watchQueue.shift();
      // ON FROM HERE, SO A STOP DURING ITS PULL IS ITS STOP (goal/G21.3).
      runningJob = job;
      let outcome = 'ended';
      try {
        // A JOB THAT NAMES A COMMIT WAITS FOR IT (goal/G19.13): pulled first, and not run until the tree holds it.
        if (job.commit) {
          running = { id: String(job.id), suite: '', since: new Date().toISOString() };
          say({ doing: 'item', id: job.id, line: 'pulling, to see whether the tree holds ' + shortOf(job.commit), since: running.since });
          const pulled = await pullFirst();
          running = { id: '', suite: '', since: '' };
          if (stopped) {
            const text = 'deskVerify: stopped by hand from the verifier tab while pulling for ' + shortOf(job.commit) + '; nothing was checked. Claim again to have it checked.';
            noteLine(text);
            await desk('chat.add', { id: job.id, text: text });
            if (job.row) runEnded.run('stopped by hand', new Date().toISOString(), job.row);
            continue;
          }
          if (!(await holds(job.commit))) { runningJob = null; await startWaiting(job, pulled); continue; }
        }
        if (job.row) runStarted.run(new Date().toISOString(), job.row);
        // A NEW RUN CLEARS THE CONSOLE (goal/G22.3, Andy: "cleared before every new run"); its row names it.
        consoleClear(job.row ? String(job.row) : String(Date.now()));
        let r = null;
        if (job.kind === 'goal') r = await goalRun(job.id);
        else if (job.kind === 'full') r = await fullRun(job.id);
        else if (job.kind === 'red') r = await redCheck(job.id, job.commit);
        else r = await claimCheck(job.id);
        if (r && r.stopped) outcome = 'stopped by hand';
        else if (r && r.red) outcome = r.confirmed ? 'red confirmed' : 'red not confirmed';
        else if (r && r.unchecked) outcome = 'not checked';
        else if (r && typeof r.rejected === 'boolean') outcome = r.rejected ? 'rejected' : 'passed';
      } catch (e) {
        /* the desk is the record; a failed check is asked again by its next word */
        outcome = 'broke: ' + String((e && e.message) || e).slice(0, 200);
      } finally {
        // THE STOP ENDS WITH ITS RUN (goal/G21.3): kept from the press to here, and never carried into the next run.
        runningJob = null;
        stopped = false;
        // The console keeps this run's output, ended, until the next run clears it (goal/G22.3).
        consoleDone();
      }
      // Reached only by a run that ran (a wait or a stop while pulling continued above, its row already said). The
      // commit it measured at is kept for a run that named none, so a search over runs answers it.
      if (job.row) {
        const t = await tree();
        runCommitAt.run(String(t.commit || ''), job.row);
        runEnded.run(outcome, new Date().toISOString(), job.row);
      }
    }
  } finally { checking = false; runningJob = null; stopped = false; }
}
async function watchOnce() {
  // One read at a time: a tick that arrives while the last is still reading does nothing.
  if (reading) return { read: 0, queued: [] };
  const m = await mode();
  if (m.mode !== 'desk') return { read: 0, queued: [] };
  reading = true;
  const queued = [];
  let read = 0;
  try {
    // THE WHOLE FIRST WALK IS HISTORY (goal/G8.10, found on his node at b5ea0779): the flag is read once, before the
    // walk, not per page. Judged inside the loop it was true for page one only, so every later page of his record -
    // years of verify passes - triggered a check, and items of goal/G6 were rejected for having no suites. A restart
    // must trigger nothing at all.
    const history = watchAt < 0;
    for (let i = 0; i < 10000; i++) {
      const page = await desk('changes', { n: Math.max(watchAt, 0), line: 0 });
      const recs = Array.isArray(page.records) ? page.records : [];
      const n = Number(page.n);
      read += recs.length;
      // The newest write is kept either way, so an idle publish can say what the idle hour counts from.
      if (recs.length && recs[recs.length - 1].at) lastWriteAt = String(recs[recs.length - 1].at);
      if (!history) {
        recs.forEach(function (r) {
          const job = watched(r);
          if (!job) return;
          // EVERY goal.emptied IS RUN (goal/G27.2, D10). Andy, 2026-10-17: "i don't want deskVerify to refuse runs
          // required by my agents. deskVerify is dumb, and cannot decide if a new run is neccessary or not." goal/G8.12's
          // one pass per goal is gone: the desk writes goal.emptied once per emptying, so each one is a run asked for.
          // Only an identical run already waiting is not queued twice.
          if (queued.some(function (q) { return q.kind === job.kind && q.id === job.id; })) return;
          if (queuedAlready(job)) return;
          queued.push(job);
        });
      }
      if (n > watchAt) watchAt = n;
      if (!page.more || !recs.length) break;
    }
  } finally { reading = false; }
  queued.forEach(enqueue);
  if (queued.length) drainQueue();
  return { read: read, queued: queued };
}
const watcher = setInterval(function () { watchOnce().catch(function () { /* next tick */ }); }, WATCH_MS);
// The runs a restart found unended are worked off at once (goal/G19.3), on this node only, as the watcher's are.
if (watchQueue.length) setTimeout(function () { mode().then(function (m) { if (m.mode === 'desk') drainQueue(); }, function () {}); }, 500);
if (watcher.unref) watcher.unref();
// The claims waiting for their commit are tried again on a clock of their own (goal/G19.13), on this node only.
const waiter = setInterval(function () { waitOnce().catch(function () { /* next tick */ }); }, WAIT_MS);
if (waiter.unref) waiter.unref();

// THE SUITES FOLDER, which only his full run walks (goal/G14.3); the goal run takes its suites from the items.
const SUITES_DIR = path.resolve(REPO, String(values.suites || 'spirit/test'));
// A SUITE IS WHAT THE HARNESS CALLS ONE (goal/G8.12, found by claude-windows verifying 4c7fcb76): a file that calls
// startTest( and is not on the harness's own list of helpers. Taking every .js ran testSupport.js, deskFake.js and
// runAll.js itself - a second harness nested inside this run. The list is spirit/test/notASuite.js, which runAll reads
// too, so the two cannot drift; where it cannot be read, the few names that would do real damage still stand.
const NOT_A_SUITE = (function () {
  try { return require(path.join(REPO, 'spirit', 'test', 'notASuite.js')); } catch (e) {
    return ['runAll.js', 'testSupport.js', 'verifyPost.js', 'notASuite.js'];
  }
}());
function suiteFiles() {
  let names = [];
  try { names = fs.readdirSync(SUITES_DIR); } catch (e) { return []; }
  return names.filter(function (f) {
    if (!/\.js$/.test(f)) return false;
    if (f === 'notASuite.js' || NOT_A_SUITE.indexOf(f) !== -1) return false;
    try { return /startTest\s*\(/.test(fs.readFileSync(path.join(SUITES_DIR, f), 'utf8')); } catch (e) { return false; }
  }).sort();
}
// A LIST OF SUITES, ONE AT A TIME (goal/G14.3): what the goal run and his full run share. `doing` is what the tab
// shows, 'goal' or 'full'. A Stop ends this run and never the next one: since goal/G21.3 drainQueue clears the flag
// when the run has ended, and it is not cleared here at the start, where it lost a Stop pressed during the pull.
async function runList(doing, goalId, list) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  const reds = [];
  // The suites that printed a red, apart from the missing and the stopped ones: what the undo reads (goal/G19.2).
  const failed = [];
  let byHand = false;
  for (const where of list) {
    const index = list.indexOf(where) + 1;
    const expected = expectedOf(where);
    const file = path.join(REPO, where);
    // The stop is checked before each suite (goal/G21.3).
    if (stopped) { byHand = true; reds.push(where + ': not run, stopped by hand'); break; }
    if (leavesTests(where)) { reds.push(where + ': the path leaves spirit/test, so it was not run'); continue; }
    if (!fs.existsSync(file)) { reds.push(where + ': missing from this checkout'); continue; }
    running = { id: '', suite: where, since: new Date().toISOString() };
    const told = function (tests) {
      say({ doing: doing, id: String(goalId), suite: where, index: index, of: list.length, tests: tests,
        expected: expected,
        line: doing + ' run: ' + path.basename(where) + ', suite ' + index + ' of ' + list.length +
          (expected ? ', ' + tests + ' of about ' + expected + ' tests' : ', ' + tests + ' tests'),
        since: running.since });
    };
    told(0);
    const run = await runSuite(file, port, told);
    if (run.stopped) { byHand = true; reds.push(where + ': stopped by hand'); break; }
    if (run.timedOut) reds.push(where + ': stopped at the time limit of ' + SUITE_MS + 'ms');
    else if (/FAILURE #/.test(run.said)) { reds.push(where); failed.push(where); }
  }
  running = { id: '', suite: '', since: '' };
  // THE REPORT IS ONE LINE (goal/G8.7, Andy: "both"): what went red, in the goal's own chat, where he reads it. Since
  // goal/G19.2 the caller writes it, after the undo below, so the one line also says what the red took back.
  const text = reds.length
    ? doing + ' run on ' + list.length + ' suites: red in ' + reds.join(', ')
    : doing + ' run on ' + list.length + ' suites: all green';
  return { ran: list, reds: reds, failed: failed, text: text, stopped: byHand };
}

// ── A RED TAKES A DONE BACK (goal/G19.2) ─────────────────────────────────
//
//   Andy, 2026-10-12: "i said the verifier can not press done, i never said that the verifier cannot undo a
//   done/close...", "a done becomes unsettles when an associated suite shows regression.", and "yes." to the reading:
//   any run showing a suite red unsettles every done or closed item listing it, and its goal, counted only from a
//   clean, pulled tree holding the item's commit. "a regression must come back as a red. If we find it is due to an
//   eliminated product feature (device), we rectify the test, if its in production code, we fix the code."
//
// So after any run of this server (an item's check, a goal run, his full run): each suite that PRINTED a red - not one
// missing, stopped by hand or stopped at the time limit, which measured nothing about the code - is looked up, and every
// done or closed item listing it is unsettled with verify.regress, then its goal. Never when the tree was not pulled
// clean (pullFirst said anything but 'pulled'): a red on his uncommitted work, or on code behind the remote, is not the
// items' regression. Never an item whose commits the tree lacks (commitsLacking, goal/G18.10): the red was measured on
// code that is not yet the item's. Done is still never pressed here; this only takes one back.
//
// WHERE THE ITEMS COME FROM: the desk's own items.search with includeClosed, the suite's path as the text. The desk
// ranks items by their lines, and commitCheck's line under an item lists the files of its commit, so the items listing
// the suite come first; the file list in each label is what decides. One answer per suite, so on a desk past one answer
// room an item ranked below the bucket can be missed: the line then says the search was partial, rather than nothing.
async function regress(failed, pulled, doing) {
  const out = { items: [], goals: [], partial: false, skipped: '' };
  if (!failed.length) return out;
  if (pulled !== 'pulled') { out.skipped = 'nothing taken back: the tree was ' + pulled; return out; }
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  const byId = Object.create(null);
  for (const suite of failed) {
    const found = await desk('items.search', { text: suite, currentGoalOnly: false, goalsOnly: false, includeClosed: true });
    if (found && found.more) out.partial = true;
    ((found && found.items) || []).forEach(function (i) {
      let one = null;
      try { one = JSON.parse(i.label); } catch (e) { one = null; }
      if (!one || !one.id || one.goal === '' || (one.status !== 'done' && one.status !== 'closed')) return;
      const lists = (Array.isArray(one.files) ? one.files : []).some(function (f) { return String((f && f.path) || '') === suite; });
      if (!lists) return;
      const at = byId[one.id] || (byId[one.id] = { id: String(one.id), goal: String(one.goal), suites: [] });
      if (at.suites.indexOf(suite) === -1) at.suites.push(suite);
    });
  }
  const t = await tree();
  const where = 'at ' + (t.short || t.commit || 'an unknown commit') + ' (' + pulled + ')';
  const goals = Object.create(null);
  for (const id of Object.keys(byId).sort()) {
    const one = byId[id];
    if ((await commitsLacking(id, port)).length) continue;
    const why = one.suites.join(', ');
    const r = await desk('verify.regress', { id: id, why: why });
    if (typeof r.change !== 'number') continue;
    out.items.push(id);
    await desk('chat.add', { id: id, text: 'deskVerify: regressed, ' + where + ': ' + why + ' went red in a ' + doing + ' run, so ' + id + ' is unsettled and waits for its work again.' });
    const g = goals[one.goal] || (goals[one.goal] = []);
    one.suites.forEach(function (s) { if (g.indexOf(s) === -1) g.push(s); });
  }
  for (const gid of Object.keys(goals).sort()) {
    const why = goals[gid].join(', ');
    const r = await desk('verify.regress', { id: gid, why: why });
    if (typeof r.change !== 'number') continue;
    out.goals.push(gid);
    await desk('chat.add', { id: gid, text: 'deskVerify: regressed, ' + where + ': ' + why + ' went red in a ' + doing + ' run, so the goal waits for its items again.' });
  }
  return out;
}
// What the undo did, as the tail of a run's one line.
function regressSaid(u) {
  const parts = [];
  if (u.items.length) parts.push('taken back: ' + u.items.concat(u.goals).join(', '));
  if (u.skipped) parts.push(u.skipped);
  if (u.partial) parts.push('the search for items listing the red was partial, so an item may have been missed');
  return parts.length ? '; ' + parts.join('; ') : '';
}

// THE GOAL'S OWN SUITES (goal/G14.3): the test files on the lists of the goal's items, done and closed ones too -
// they are the goal's work. Andy, 2026-10-12, asked "When a goal empties, does the verifier run only the suites of its
// items, the full harness being your button alone?": "yes."
async function goalSuites(goalId) {
  const found = await desk('items.search', { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: true });
  const out = Object.create(null);
  ((found && found.items) || []).forEach(function (i) {
    let one = null;
    try { one = JSON.parse(i.label); } catch (e) { one = null; }
    if (!one || one.goal !== String(goalId)) return;
    (Array.isArray(one.files) ? one.files : []).forEach(function (f) {
      const p = String((f && f.path) || '');
      if (/^spirit\/test\/.+\.js$/.test(p)) out[p] = true;
    });
  });
  return Object.keys(out).sort();
}

// THE GOAL RUN, WHEN THE GOAL EMPTIES (goal/G8.12, narrowed by goal/G14.3). It ran every suite in the folder - the hour
// - until Andy, 2026-10-12, in G14.3's box: "the verifier must run only automatically for items and for a goal." So:
// the goal's own suites, the report line, and verify.pass on the goal, which is what brings the goal its Done. No
// tolerated-reds grant (goal/G8.7) here any more: every suite this runs is the goal's own, so none is outside it.
// ONLY A CLEAN RUN PASSES THE GOAL (goal/G19.2). It asked verify.pass whatever the run came to, so a red, a Stop by hand
// or a listed file gone still brought the goal its Done. Andy, 2026-10-12, to the four fixes that hold back an unearned
// Done: "yes. with my addendum." Now the pass is asked only when nothing was red, nothing missing and nothing stopped;
// otherwise the line on the goal names what was, and says the goal is not passed. The tree is pulled first, as an
// item's check pulls it (goal/G16.13), so the undo below knows whether the red was measured on a clean, pulled tree.
async function goalRun(goalId) {
  say({ doing: 'goal', id: goalId, line: 'pulling before the goal run of ' + goalId, since: new Date().toISOString() });
  const pulled = await pullFirst();
  const r = await runList('goal', goalId, await goalSuites(goalId));
  const undo = await regress(r.failed, pulled, 'goal');
  const t = await tree();
  const where = ' (at ' + (t.short || t.commit || 'an unknown commit') + ', ' + pulled + ')';
  const text = r.text + where + (r.reds.length ? ', so the goal is not passed' : '') + regressSaid(undo);
  noteLine(text);
  await desk('chat.add', { id: String(goalId), text: text });
  if (!r.reds.length) await desk('verify.pass', { id: String(goalId) });
  sayIdle();
  return Object.assign(r, { rejected: r.reds.length > 0 });
}

// THE FULL HARNESS, BY HIS BUTTON ALONE (goal/G14.3). Andy, 2026-10-12: "only the desk user can run the full harness
// using a [run the full harness button] (armable) in the verifier tab." Every suite in the folder, the report line in
// the goal chat the button named, and nothing else: it brings no Done and asks no grant.
async function fullRun(goalId) {
  const rel = function (f) { return path.relative(REPO, path.join(SUITES_DIR, f)).split(path.sep).join('/'); };
  // Pulled first, and a red here takes a Done back like any run's (goal/G19.2); it still passes nothing.
  say({ doing: 'full', id: goalId, line: 'pulling before the full run', since: new Date().toISOString() });
  const pulled = await pullFirst();
  const r = await runList('full', goalId, suiteFiles().map(rel));
  const undo = await regress(r.failed, pulled, 'full');
  const t = await tree();
  const text = r.text + ' (at ' + (t.short || t.commit || 'an unknown commit') + ', ' + pulled + ')' + regressSaid(undo);
  noteLine(text);
  await desk('chat.add', { id: String(goalId), text: text });
  sayIdle();
  return r;
}

// ONE VERB OF THE DESK, through this server's own node.
function desk(verb, args) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  const one = {}; one[verb] = args;
  return spirit.core.ask('jobs.api', { ask: { desk: one } }, 'http://127.0.0.1:' + port)
    .then(function (r) { return r && r.status === 200 && r.body ? r.body : {}; }, function () { return {}; });
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

// ── THE DESK, WHEREVER THIS NODE READS IT (goal/G21.3) ───────────────────
// On his node the desk is a server of this node; on an agent's node the desk is his, reached through the agent's
// deskClient (which answers the desk's own body), and the node's own desk server is not his desk.
function deskVia(m, verb, args) {
  if (m && m.mode === 'agent') {
    const port = Number(spirit.core.node.const.SPIRIT_PORT);
    return spirit.core.ask('jobs.api', { ask: { deskClient: { desk: { verb: verb, json: JSON.stringify(args || {}) } } } }, 'http://127.0.0.1:' + port)
      .then(function (r) { return r && r.status === 200 && r.body && r.body.ok !== false ? r.body : {}; }, function () { return {}; });
  }
  return desk(verb, args);
}

// ── ONE SEARCH VERB, OVER TESTS AND RUNS (goal/G21.3) ────────────────────
//
//   Andy's box: "deskVerify answers one search verb, bucket-bounded with the partial flag, over: tests and suites (the
//   official latest state of a single test, or every test in a suite: outcome, commit, time, failure text; filters:
//   suite, test words, outcome, commit, item, since) and runs (each check it made, item or full run: commit, queued,
//   started, ended, its outcome and the line it posted; filters: item, commit, kind, since). The same verb runs on
//   every node's deskVerify; agents may call it (give it a verb description file so it's an agent tool), nothing is
//   written through it."
//
// A list is a search (Andy's rule): newest first, each matching row offered to one probability bucket, the test words
// grading the title (a title they do not touch is left out), the other filters exact. Past SEARCH_SCANNED matching
// rows, or past one answer's room, `more` says the answer is partial. It reads verify.db and, for `item`, the item's
// file list; it writes nothing. A filter that does not belong to `over` is ignored, as the verb file says.
const SEARCH_ROOM = appClient.ANSWER_MAX - 512;
const SEARCH_SCANNED = 1000;
const SEARCH_KEYS = ['over', 'suite', 'test', 'outcome', 'commit', 'item', 'kind', 'since', 'current', 'heading', 'history'];
function searchBytes(key, label) { return Buffer.byteLength(JSON.stringify({ items: [{ key: String(key), label: String(label) }], more: false }), 'utf8'); }
function searchBucket(walk) {
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
async function search(a) {
  const over = String(a.over || '');
  if (over !== 'tests' && over !== 'runs') throw refusedWhy('search needs over: "tests" or "runs"');
  const commit = String(a.commit || '').trim().toLowerCase();
  if (commit && !/^[0-9a-f]{1,40}$/.test(commit)) return { items: [], more: false };
  const since = String(a.since || '').trim();
  const where = [];
  const params = [];
  if (over === 'runs') {
    if (a.item) { where.push('id = ?'); params.push(String(a.item)); }
    if (a.kind) { where.push('kind = ?'); params.push(String(a.kind)); }
    if (commit) { where.push('"commit" LIKE ?'); params.push(commit + '%'); }
    if (since) { where.push('queuedAt >= ?'); params.push(since); }
    const sql = 'SELECT rowid, kind, id, state, outcome, queuedAt, startedAt, endedAt, "commit" AS commitAt, line FROM runs' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY rowid DESC';
    const runRows = [];
    for (const r of rowsOf(sql, params)) {
      runRows.push({ probability: 0, pair: { key: String(r.rowid), label: JSON.stringify({ kind: r.kind, id: r.id, state: r.state, commit: r.commitAt || '',
        queued: r.queuedAt, started: r.startedAt, ended: r.endedAt, outcome: r.outcome, line: r.line || '' }) } });
    }
    // HOW MANY (goal/G27.14): every match counted, beside the bucket.
    const outRuns = searchBucket(runRows[Symbol.iterator]());
    outRuns.total = runRows.length;
    return outRuns;
  }
  // TESTS: the newest row of each test is its official latest state.
  if (a.suite) { where.push('suite = ?'); params.push(path.basename(String(a.suite))); }
  if (a.outcome) { where.push('outcome = ?'); params.push(String(a.outcome)); }
  if (commit) { where.push('"commit" LIKE ?'); params.push(commit + '%'); }
  if (since) { where.push('at >= ?'); params.push(since); }
  if (a.item) {
    const m = await mode();
    const got = await deskVia(m, 'item.get', { id: String(a.item) });
    let it = null;
    try { it = JSON.parse((got && got.item) || 'null'); } catch (e) { it = null; }
    const suites = (it && Array.isArray(it.files) ? it.files : []).map(function (f) { return String((f && f.path) || ''); })
      .filter(function (p) { return /^spirit\/test\/.+\.js$/.test(p); }).map(function (p) { return path.basename(p); });
    if (!suites.length) return { items: [], more: false };
    where.push('suite IN (' + suites.map(function () { return '?'; }).join(', ') + ')');
    suites.forEach(function (s) { params.push(s); });
  }
  // A TESTED THING'S CHECKS (goal/G27.14, F6): heading is a sub-heading, and keeps the keys "<heading> #<n>" only.
  const heading = String(a.heading || '');
  if (heading) { where.push('title LIKE ? ESCAPE \'\\\''); params.push(heading.replace(/[\\%_]/g, '\\$&') + ' #%'); }
  // ITS HISTORY (Andy, 2026-10-17: "so we'll add a dialog for test-history, that shows us the flips."): history: yes
  // answers every row, each a flip, not only each test's newest.
  const history = String(a.history || '') === 'yes';
  const sql = 'SELECT rowid, suite, title, outcome, "commit" AS commitAt, at, failure FROM results WHERE ' +
    (history ? '1 = 1' : 'rowid IN (SELECT MAX(rowid) FROM results GROUP BY suite, title)') + (where.length ? ' AND ' + where.join(' AND ') : '') + ' ORDER BY rowid DESC';
  const words = String(a.test || '').trim();
  // WHAT IS RED NOW (goal/G27.14, current: yes): only tests reported in their suite's latest run, that is within one
  // suite's time limit of the suite's newest report. A test no run reports any more (an old key, a removed assertion)
  // is history, kept and found without it, never counted as standing now.
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
  // The words match a test's key and its failure text, where a red's words are since goal/G27.14.
  const found = [];
  for (const r of rowsOf(sql, params)) {
    if (inLatest && !inLatest(r)) continue;
    const p = words ? Math.max(probabilityStringMatch(words, String(r.title)), probabilityStringMatch(words, String(r.failure || ''))) : 0;
    if (words && !(p > 0)) continue;
    found.push({ probability: p, pair: { key: String(r.rowid), label: JSON.stringify({ suite: r.suite, title: r.title, outcome: r.outcome,
      commit: r.commitAt, at: r.at, failure: r.failure || '' }) } });
  }
  // HOW MANY (goal/G27.14, Andy: "how many red?"): every match counted, beside the bucket that carries the best of them.
  const out = searchBucket(found[Symbol.iterator]());
  out.total = found.length;
  return out;
}

// ── THE IDLE HOUR AND ITS CHORES (goal/G8.4, built at last by goal/G21.3) ─
//
//   Andy's box: "The idle hour comes back and its chores are done (goal/G8.4, never built): a node is idle after an
//   hour with no desk write and no phase held by its agent; then its deskVerify runs publishData for its agent
//   (measure, write agents/<agent-name>/, commit under the standing grant) and writes the test-state report from its
//   own dataset, never by re-running suites. All code, no model. The tab's countdown counts to that hour and shows what
//   the chores did."
//
// THE RULE IS goal/G8.4's, as it stood until goal/G19.11 removed it with its verbs: an hour since the newest write the
// desk holds AND no open item held by this node's agent (`with` naming it, by its profile name or the node's name).
// The newest write is read from the desk's own `changes`, from a cursor of its own (the watcher's is another reader);
// the first read walks the record once, page by page - its cost, stated. On an agent's node the desk is read through
// its deskClient. Checked every idleCheckMs; the chores run ONCE per quiet stretch: a newer write starts a new one.
//
// THE CHORES, in this order, so the commit publishData makes carries the report:
//   1. the test-state report, agents/<agent>/testState.json and testState.md, from verify.db's newest row per test -
//      inside agents/<agent>/ because the commit check's standing grant (goal/G4.33) takes only a commit whose files
//      all lie in the agent's own folder, and publishData commits that folder whole;
//   2. publishData for the agent (its harness and capacity in a worktree, its packets, the commit, the push).
// A node with no agent (his desk node runs no deskClient) has nobody to publish for: the chores say so and do nothing.
// No chore runs while a check runs, and no check starts while the chores run (two runs fight over the lab ports).
const IDLE_CHECK_MS = Number(values.idleCheckMs) > 0 ? Number(values.idleCheckMs) : 60000;
const PUBLISH = String(values.publish || '').trim();
const CHORES_REPO = values.choresRepo ? path.resolve(String(values.choresRepo)) : REPO;
const CHORE_MS = 30 * 60 * 1000;
const PUBLISH_DATA = path.join(__dirname, '..', 'deskClient', 'publishData.js');
let idleCursor = { n: 0, at: '' };
let choresFor = '';
let choring = false;
let idleTicking = false;
let agentKnown = '';
let idleSaid = '';
async function newestWrite(m) {
  for (let i = 0; i < 10000; i++) {
    const page = await deskVia(m, 'changes', { n: idleCursor.n, line: 0 });
    const recs = Array.isArray(page.records) ? page.records : [];
    // Records come in the order they were written, so the last one is the newest; a page with nothing new keeps it.
    if (recs.length) idleCursor.at = String(recs[recs.length - 1].at || idleCursor.at);
    if (Number(page.n) > idleCursor.n) idleCursor.n = Number(page.n);
    if (!page.more || !recs.length) break;
  }
  return idleCursor.at;
}
async function agentOf(m) {
  if (agentKnown) return agentKnown;
  if (m.mode !== 'agent') return '';
  const p = await deskVia(m, 'profile.get', { agent: '' });
  const name = String((p && p.name) || '');
  // A folder name and nothing else: the report is written under agents/<name>/.
  if (/^[A-Za-z0-9._-]{1,64}$/.test(name) && name !== '.' && name !== '..') agentKnown = name;
  return agentKnown;
}
async function heldBy(m, names) {
  const found = await deskVia(m, 'items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false });
  return ((found && found.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } })
    .filter(function (it) { return it && it.with && names.indexOf(String(it.with)) !== -1; })
    .map(function (it) { return String(it.id); });
}
async function idleOnce() {
  if (idleTicking || choring) return;
  idleTicking = true;
  try {
    const m = await mode();
    if (m.mode === 'none') return;
    const since = await newestWrite(m);
    const agent = await agentOf(m);
    const names = [agent, String(spirit.core.node.const.NODE_NAME || '')].filter(Boolean);
    const holding = names.length ? await heldBy(m, names) : [];
    const quiet = !!since && Date.now() - Date.parse(since) >= IDLE_MS;
    idleState.since = since;
    idleState.holding = holding;
    idleState.idle = quiet && !holding.length;
    // Said only when it changed, so a quiet node does not publish every idleCheckMs.
    const now = JSON.stringify([since, holding, idleState.idle, idleState.chores]);
    if (!checking && !running.id && now !== idleSaid) { idleSaid = now; sayIdle(); }
    if (idleState.idle && !checking && choresFor !== since) {
      choresFor = since;
      await chores(m, agent);
    }
  } finally { idleTicking = false; }
}
const newestEach = db.prepare('SELECT suite, title, outcome, "commit" AS commitAt, at, failure FROM results WHERE rowid IN (SELECT MAX(rowid) FROM results GROUP BY suite, title) ORDER BY suite, title');
async function writeTestState(dir, agent, m) {
  const rows = newestEach.all();
  const t = await tree();
  const bySuite = Object.create(null);
  rows.forEach(function (r) {
    const s = bySuite[r.suite] || (bySuite[r.suite] = { suite: r.suite, tests: 0, green: 0, red: 0, newestAt: '' });
    s.tests += 1;
    if (r.outcome === 'red') s.red += 1; else s.green += 1;
    if (String(r.at) > s.newestAt) s.newestAt = String(r.at);
  });
  const reds = rows.filter(function (r) { return r.outcome === 'red'; })
    .map(function (r) { return { suite: r.suite, title: r.title, commit: r.commitAt, at: r.at, failure: r.failure || '' }; });
  const report = {
    agent: agent, node: String(spirit.core.node.const.NODE_NAME || ''), measuredAt: new Date().toISOString(), commit: t.short || t.commit || '',
    from: 'verify.db: the newest row of each test this node\'s deskVerify keeps; no suite was run for this report',
    note: rows.length ? '' : 'no records yet',
    tests: rows.length, green: rows.length - reds.length, red: reds.length,
    suites: Object.keys(bySuite).sort().map(function (k) { return bySuite[k]; }),
    reds: reds,
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'testState.json'), JSON.stringify(report, null, 2) + '\n');
  const md = ['# Test state: ' + agent, '',
    '**Written ' + report.measuredAt.slice(0, 10) + ' by deskVerify at `' + report.commit + '`, from its own dataset; no suite was re-run.**', '',
    report.tests + ' tests, ' + report.green + ' green, ' + report.red + ' red.' + (report.note ? ' ' + report.note + '.' : ''), '',
    '| suite | tests | green | red | newest |', '|---|---|---|---|---|']
    .concat(report.suites.map(function (s) { return '| ' + s.suite + ' | ' + s.tests + ' | ' + s.green + ' | ' + s.red + ' | ' + s.newestAt + ' |'; }))
    .concat(['', '## Red', ''])
    .concat(reds.length ? reds.map(function (r) { return '- `' + r.suite + '` ' + r.title + ' (`' + String(r.commit).slice(0, 8) + '`, ' + r.at + ')' + (r.failure ? ': ' + r.failure.replace(/\s+/g, ' ') : ''); }) : ['none'])
    .concat(['']);
  fs.writeFileSync(path.join(dir, 'testState.md'), md.join('\n'));
  return report;
}
function runPublish() {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  return new Promise(function (resolve) {
    let kid = null;
    const out = [];
    try {
      kid = PUBLISH ? spawn(PUBLISH + ' ' + port, { cwd: CHORES_REPO, shell: true, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' })
        : spawn(process.execPath, [PUBLISH_DATA, String(port)], { cwd: CHORES_REPO, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    } catch (e) { resolve('publishData did not start: ' + ((e && e.message) || e)); return; }
    const timer = setTimeout(function () { killTree(kid); }, CHORE_MS);
    kid.stdout.on('data', function (d) { out.push(String(d)); });
    kid.stderr.on('data', function (d) { out.push(String(d)); });
    kid.on('error', function (e) { clearTimeout(timer); resolve('publishData did not start: ' + ((e && e.message) || e)); });
    kid.on('close', function (code) {
      clearTimeout(timer);
      const last = out.join('').trim().split('\n').filter(Boolean).pop() || '';
      resolve(code === 0 ? 'publishData: published' + (last ? ' (' + last.trim().slice(0, 200) + ')' : '')
        : 'publishData failed, exit ' + code + (last ? ': ' + last.trim().slice(0, 200) : ''));
    });
  });
}
async function chores(m, agent) {
  choring = true;
  const did = [];
  try {
    if (!agent) did.push('no agent on this node, so nothing is published');
    else {
      try {
        const rep = await writeTestState(path.join(CHORES_REPO, 'agents', agent), agent, m);
        did.push('testState written: agents/' + agent + '/testState.json (' + rep.tests + ' tests, ' + rep.red + ' red)');
      } catch (e) { did.push('testState not written: ' + ((e && e.message) || e)); }
      did.push(await runPublish());
    }
  } finally { choring = false; }
  idleState.chores = did.join('; ') + ' (' + new Date().toISOString() + ')';
  idleSaid = '';
  if (!checking && !running.id) sayIdle();
  if (watchQueue.length) drainQueue();
}
const idler = setInterval(function () { idleOnce().catch(function () { /* next tick */ }); }, IDLE_CHECK_MS);
if (idler.unref) idler.unref();
setTimeout(function () { idleOnce().catch(function () { /* next tick */ }); }, 1000).unref();

// ITS VERBS: what the desk face and the suites post to, and nothing else (goal/G19.11 removed the eight only suites
// called; see the note where suites() stood).
appServer.serve({
  // THE VERIFIER TAB'S VERBS (goal/G8.11), deskVerify's own; Andy, 2026-10-09, on an app's verbs: they need no
  // grant of his until he rules the app intrinsic. Desk draws its tab from `now` and shows nothing where no deskVerify
  // answers.
  //   now            what runs, for which item, since when, and what waits
  //   stop           his intervention: the run ends and its claim is rejected saying so, never passed
  // (records.search stood between them; the tab stopped asking it in goal/G8.12, and it went in goal/G19.11. The one
  // search of goal/G21.3, below, is a read for agents and for him, not for the tab.)
  now: {
    // THE QUEUE AS {kind, id} (goal/G19.3): declared as [''] it was refused whenever work waited, and the tab vanished.
    // stopAsked (goal/G21.3): a Stop was taken and the run it stops has not ended, so the tab says "stop asked".
    request: {}, reply: { running: { id: '', suite: '', since: '' }, queued: [{ kind: '', id: '' }], stopAsked: false },
    handler: function () {
      return { running: { id: running.id, suite: running.suite, since: running.since }, queued: watchQueue.map(function (q) { return { kind: q.kind, id: q.id }; }),
        stopAsked: stopped === true && checking };
    },
  },
  stop: {
    request: {}, reply: { stopped: false },
    handler: function () { return stopRun(); },
  },
  // HIS BUTTON (goal/G14.3): the full harness, queued behind whatever runs now, one at a time as every run is. `id` is
  // the goal whose chat takes the report line. deskVerify's own verb, as the tab's three are (goal/G8.11).
  'full.run': {
    request: { id: '' }, reply: { queued: true },
    handler: function (a) {
      const job = { kind: 'full', id: String(a.id || '') };
      if (!queuedAlready(job)) enqueue(job);
      drainQueue();
      return { queued: true };
    },
  },
  // A DOOR RUN BY THE PLUGIN ITSELF, RECORDED (goal/G27.2, D5). Andy, 2026-10-17: "i don't want verifier to block the
  // design-a-door process", and "i don't mind if our test sends the verifier a result". The plugin runs a door being
  // designed at once, outside this queue, and hands the verdict here as a record only: kept under doors/<id>.json as a
  // run of this server's own would be, and its line said in the console. Nothing is run or queued.
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
  // not, and that is the whole of the de-duplication - the history is the flips. His clone and an agent's both keep
  // their own (goal/G21.3); a node that is neither answers and stores nothing.
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
      return mode().then(function (m) { return m.mode === 'desk' || m.mode === 'agent' ? keep(suite, title, outcome, a.failure) : { written: false }; });
    },
  },
  // ONE SEARCH, OVER TESTS OR RUNS (goal/G21.3). A read: nothing is written through it. Every key is optional; `over`
  // is required. The verb file beside this server (search.json) makes it an agent tool.
  search: {
    request: { over: '', suite: '', test: '', outcome: '', commit: '', item: '', kind: '', since: '' },
    reply: { items: [{ key: '', label: '' }], more: false, total: 0 },
    accepts: function (a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return false;
      return Object.keys(a).every(function (k) { return SEARCH_KEYS.indexOf(k) !== -1 && typeof a[k] === 'string'; });
    },
    handler: function (a) { return search(a); },
  },
});
