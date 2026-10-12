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
// an agent's copy answers its own agent and keeps no record. This file is the same code either way; what differs is
// whose node runs it.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');
const appClient = require('../../../js/appClient.js');
const searchBucket = require('../../../js/searchBucket.js');

// ONE ANSWER, ONE PACKET (slim/G1.2), as the desk measures it: a search answers what fits in one answer and says
// `more`. A row too large to travel alone is skipped rather than stalling the read with nothing in it.
const ANSWER_ROOM = appClient.ANSWER_MAX - 512;
function walked(rows, pairOf) {
  const bucket = searchBucket.createSearch({
    query: '**', maxBytes: ANSWER_ROOM,
    getLabelStringFromIncomingObject: function (pair) { return pair.label; },
    extractKeyAndLabelFromRow: function (pair) { return pair; },
  });
  let skipped = false;
  for (const row of rows) {
    const pair = pairOf(row);
    if (Buffer.byteLength(JSON.stringify({ items: [pair], more: false }), 'utf8') > ANSWER_ROOM) { skipped = true; continue; }
    if (!bucket.offer(pair)) break;
  }
  const r = bucket.getResult();
  return { items: r.items, more: r.more || skipped };
}

const argv = process.argv;
const at = argv.indexOf('--state');
const STATE = at !== -1 ? argv[at + 1] : '';
// THE MANIFEST'S VALUES, as the node hands them (jobs.js: one JSON object, name -> value, as the first argument).
let values = {};
try { values = JSON.parse(argv[2] || '{}') || {}; } catch (e) { values = {}; }
// WHOSE NODE THIS IS: the --node {name, publicKey} every node already hands the servers it starts (jobs.js), never a
// value of deskVerify's own. On an agent's node the name is that agent's.
const NODE_NAME = (function () {
  const i = argv.indexOf('--node');
  try { return i !== -1 ? String((JSON.parse(argv[i + 1]) || {}).name || '') : ''; } catch (e) { return ''; }
}());
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
const newest = db.prepare('SELECT outcome FROM results WHERE suite = ? AND title = ? ORDER BY rowid DESC LIMIT 1');
// EVERY ROW, NEWEST FIRST (goal/G8.11), for the verifier tab's records.search: the rowid is the order they were kept.
const newestRows = db.prepare('SELECT rowid, suite, title, outcome, "commit", dirty, at FROM results ORDER BY rowid DESC');
const addRow = db.prepare('INSERT INTO results (suite, title, outcome, "commit", dirty, at) VALUES (?, ?, ?, ?, ?, ?)');
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
const runQueued = db.prepare('INSERT INTO runs (kind, id, state, outcome, queuedAt, startedAt, endedAt, "commit") VALUES (?, ?, \'queued\', \'\', ?, \'\', \'\', ?)');
const runStarted = db.prepare('UPDATE runs SET state = \'running\', startedAt = ? WHERE rowid = ?');
const runEnded = db.prepare('UPDATE runs SET state = \'ended\', outcome = ?, endedAt = ? WHERE rowid = ?');
// A waiting run's startedAt is when its wait began, which is what the give-up hour counts from; a run taken up again is
// started afresh, and its startedAt then says when it ran.
const runWaiting = db.prepare('UPDATE runs SET state = \'waiting\', startedAt = ? WHERE rowid = ?');
const runRequeued = db.prepare('UPDATE runs SET state = \'queued\' WHERE rowid = ?');
const runCommit = db.prepare('UPDATE runs SET "commit" = ? WHERE rowid = ?');
const runsOpen = db.prepare('SELECT rowid, kind, id, state, "commit" AS commitAt, startedAt FROM runs WHERE state != \'ended\' ORDER BY rowid');

// THE TREE IT MEASURED. Read once per call and cached for a moment: a run posts thousands of records and the commit
// does not move inside one. The repo is the checkout holding this file, which is the clone deskVerify runs in.
const REPO = (function () {
  for (let d = __dirname; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return '';
  }
}());
let seen = { at: 0, commit: '', dirty: '' };
function tree() {
  const now = Date.now();
  if (now - seen.at < 2000) return seen;
  const git = function (args) { const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' }); return r.status === 0 ? String(r.stdout || '').trim() : ''; };
  // The dirty tree is the modified files against the commit, sorted, and empty exactly when the tree is clean
  // (goal/G8.1's box), so a result measured on a dirty tree is never taken for one measured at a commit.
  const porcelain = git(['status', '--porcelain']);
  const dirty = porcelain ? porcelain.split('\n').map(function (l) { return l.slice(3).trim(); }).filter(Boolean).sort().join(' ') : '';
  // `short` for what a person reads: the result line on an item names the commit it
  // checked (goal/G16.13), and the full hash is not what he compares against a log.
  seen = { at: now, commit: git(['rev-parse', 'HEAD']), short: git(['rev-parse', '--short', 'HEAD']), dirty: dirty };
  return seen;
}

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
function pullFirst() {
  // READ NOW, NOT FROM THE CACHE (goal/G19.2): a run that starts within two seconds of the last one was judged on that
  // run's tree, so a file left uncommitted in between read as clean and was pulled over - and the undo trusts this word.
  seen = { at: 0, commit: '', short: '', dirty: '' };
  const before = tree();
  if (before.dirty) return 'dirty, not pulled';
  if (!PULL) return 'no pull command set';
  const r = spawnSync(PULL, { cwd: REPO, shell: true, encoding: 'utf8' });
  // HEAD may have moved, so the commit this check reports is read again rather than
  // taken from the cache the pull just invalidated.
  seen = { at: 0, commit: '', short: '', dirty: '' };
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
function runSuite(file, port, onTests) {
  return new Promise(function (resolve) {
    const out = [];
    let timedOut = false;
    let tests = 0;
    const kid = spawn(process.execPath, [file, '--verify-port', String(port)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    runningKid = kid;
    // EACH ASSERTION AS IT IS PRINTED (goal/G8.12), so the tab's bar moves while a suite runs rather than once it
    // ends. The printed lines are what every reader of a suite uses (runAll, claim.check), not the exit code.
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
    kid.stdout.on('data', function (d) { out.push(String(d)); count(d); });
    kid.stderr.on('data', function (d) { out.push(String(d)); });
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
let lastWriteAt = '';
function say(o) {
  const one = {
    doing: String(o.doing || 'idle'), id: String(o.id || ''), suite: String(o.suite || ''),
    index: Number(o.index) || 0, of: Number(o.of) || 0, tests: Number(o.tests) || 0,
    expected: Number(o.expected) || 0, line: String(o.line || ''), since: String(o.since || ''),
  };
  appServer.publish(one);
}
function sayIdle(line) {
  say({ doing: 'idle', line: line || 'idle, nothing running', since: lastWriteAt || new Date().toISOString() });
}

// HIS INTERVENTION (goal/G8.11): the suite running now is ended, and the claim it belonged to is rejected saying so.
// A stopped run is never a pass - the same rule as the time limit, for the same reason: nothing was measured.
function stopRun() {
  if (!runningKid) return { stopped: false };
  stopped = true;
  killTree(runningKid);
  return { stopped: true };
}

// THE SHORT LOOP'S SUITES (goal/G8.6). Andy, 2026-10-06: "the short loop is: all the suites of the current goal,
// between 'Go' pressed and 'Done' pressed", and "which suites belong to a goal: all the suites associated with items in
// the goal", known "the way a coding agent knows which suite it writes the code against" - which is the item's own file
// list (goal/G8.8). So: one items.search of the current goal through its own node, the items with his Go and not done,
// and the test files on their lists, each once, sorted. Nothing is configured: the goal is whichever the desk says.
function suites() {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  if (!port) return Promise.resolve([]);
  const ask = { desk: { 'items.search': { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: false } } };
  return spirit.core.ask('jobs.api', { ask: ask }, 'http://127.0.0.1:' + port).then(function (r) {
    const body = r && r.status === 200 ? r.body : null;
    const items = (body && Array.isArray(body.items) ? body.items : []).map(function (i) {
      try { return JSON.parse(i.label); } catch (e) { return null; }
    }).filter(Boolean);
    const out = Object.create(null);
    items.forEach(function (it) {
      // Between his Go and his Done, and never the goal row itself: a goal has no suites of its own.
      if (it.goal === '' || it.go !== true || it.status === 'done' || it.status === 'closed') return;
      (Array.isArray(it.files) ? it.files : []).forEach(function (f) {
        const p = String((f && f.path) || '');
        if (/^spirit\/test\/.+\.js$/.test(p)) out[p] = true;
      });
    });
    return Object.keys(out).sort();
  }, function () { return []; });
}

// ONE PASS (goal/G8.6): each suite run from this checkout with the port of its own node, so every assertion comes back
// as a record (goal/G8.1). One at a time, never in parallel: two runs on one host fight over the fixed ports that
// goal/G8.9 moved to a base, and a verifier that collides with itself measures nothing. The answer says what ran.
function loopOnce() {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  // THE SHORT LOOP PUBLISHES TOO (goal/G8.12): the tab shows a full pass the same way it shows one item, as doing
  // 'full', or his bar would stay empty through the longest run there is. Only what THIS server runs can be shown; a
  // harness started in a terminal is not its run and publishes nothing.
  return suites().then(async function (list) {
    const ran = [];
    running = { id: '', suite: '', since: new Date().toISOString() };
    for (const rel of list) {
      const file = path.join(REPO, rel);
      if (!fs.existsSync(file)) continue;
      const index = list.indexOf(rel) + 1;
      const expected = expectedOf(rel);
      running = { id: '', suite: rel, since: new Date().toISOString() };
      const told = function (tests) {
        say({ doing: 'full', id: '', suite: rel, index: index, of: list.length, tests: tests, expected: expected,
          line: 'full run: ' + path.basename(rel) + ', suite ' + index + ' of ' + list.length +
            (expected ? ', ' + tests + ' of about ' + expected + ' tests' : ', ' + tests + ' tests'),
          since: running.since });
      };
      told(0);
      await runSuite(file, port, told);
      ran.push(rel);
    }
    running = { id: '', suite: '', since: '' };
    sayIdle();
    return { ran: ran };
  });
}

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
  const idle = function () { running = { id: '', suite: '', since: '' }; stopped = false; sayIdle(); };
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
    return hashes.filter(function (h) {
      return spawnSync('git', ['merge-base', '--is-ancestor', h, 'HEAD'], { cwd: REPO, encoding: 'utf8' }).status !== 0;
    });
  }, function () { return []; });
}
async function claimCheckRun(id) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  stopped = false;
  running = { id: String(id), suite: '', since: new Date().toISOString() };
  // FIRST, BEFORE ANYTHING IS ASKED OR RUN (goal/G16.13): the tree this check will
  // measure is brought up to date, or said to be dirty, before the item's own facts
  // are read — so the suites that run are the suites the item now lists.
  const pulled = pullFirst();
  // ONE LINE ON THE ITEM, WHATEVER HAPPENS (goal/G16.13). Andy, 2026-10-11: "How do i
  // FUCKING know the result of verifier? it said it ran 16.5, but i don't see where the
  // result is, or if 16.5 passed." Called directly it answered only its caller and
  // wrote nothing, so a verdict existed and he could not see it. Said once per check.
  const report = function (text) {
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
    const at0 = tree();
    await report('deskVerify: not checked, at ' + (at0.short || at0.commit || 'an unknown commit') + ' (' + pulled + '): the tree lacks the item\'s commit '
      + lacking.map(function (h) { return h.slice(0, 8); }).join(', ') + '. Nothing was measured, so this is not a pass.');
    return { rejected: false, unchecked: true, lacking: lacking };
  }
  return suitesOf(id).then(async function (list) {
    const reds = [];
    const failed = [];
    // NOTHING TO RUN IS NOT A PASS (goal/G8.10, grown from rule/11 point 2): an item with no test file on its list had
    // no reds, and no reds asked verify.pass - so it took the Done button without one assertion having run. A list with
    // nothing on it, and a listed file that is gone, are both rejections now, and the missing file is named.
    if (!list.length) reds.push({ suite: '(no test file on the item\'s list)', failures: ['nothing to run, so nothing passed'] });
    for (const rel of list) {
      const file = path.join(REPO, rel);
      if (leavesTests(rel)) { reds.push({ suite: rel, failures: ['the path leaves spirit/test, so it was not run'] }); continue; }
      if (!fs.existsSync(file)) { reds.push({ suite: rel, failures: ['the listed test file is missing from this checkout'] }); continue; }
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
      if (run.stopped) { reds.push({ suite: rel, failures: ['stopped by hand from the verifier tab, so nothing was measured'] }); break; }
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
    const at = tree();
    const where = 'at ' + (at.short || at.commit || 'an unknown commit') + ' (' + pulled + ')' + regressSaid(undo);
    if (!reds.length) {
      // ALL GREEN IS ITS WORD TOO (goal/G8.3, found by claude-windows verifying b93a54d1): Andy, "only deskVerify brings
      // the button", so saying nothing would leave Done forever absent on his node. verify.pass is that word.
      await report('deskVerify: passed, ' + where + '. ' + (list.length === 1 ? '1 suite' : list.length + ' suites') + ' ran green.');
      return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.pass': { id: String(id) } } } }, 'http://127.0.0.1:' + port)
        .then(function () { return { rejected: false, reds: [] }; }, function () { return { rejected: false, reds: [] }; });
    }
    const why = reds.map(function (x) { return x.suite + (x.failures.length ? ': ' + x.failures.join('; ') : ''); }).join(' | ');
    // The red suites by name, so the line says WHAT to go and look at and not only that
    // something failed.
    await report('deskVerify: rejected, ' + where + '. Red: ' + why);
    return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.reject': { id: String(id), why: why } } } }, 'http://127.0.0.1:' + port)
      .then(function () { return { rejected: true, reds: reds.map(function (x) { return x.suite; }) }; },
        function () { return { rejected: true, reds: reds.map(function (x) { return x.suite; }) }; });
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
const goalsRun = Object.create(null);
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
  // THE VERIFY-PHASE PASS STARTS NOTHING ANY MORE (goal/G19.13, decided in the item). It came without a commit, a moment
  // before the claim, so it checked the old tree; the claim that follows it is the trigger now. Do not put it back.
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
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) return false;
  return spawnSync('git', ['merge-base', '--is-ancestor', String(commit), 'HEAD'], { cwd: REPO, encoding: 'utf8' }).status === 0;
}
function shortOf(commit) { return String(commit || '').slice(0, 8); }
async function startWaiting(job, pulled) {
  job.since = job.since || Date.now();
  if (job.row) runWaiting.run(new Date(job.since).toISOString(), job.row);
  waitingFor.push(job);
  if (job.said) return;
  job.said = true;
  const t = tree();
  await desk('chat.add', { id: job.id, text: 'deskVerify: not checked, waiting for ' + shortOf(job.commit) + ': the tree, at ' +
    (t.short || t.commit || 'an unknown commit') + ' (' + pulled + '), does not hold the commit the ' + (job.kind === 'red' ? 'red ' : '') + 'claim was made at. Nothing was measured, so this is neither a pass nor a reject; it is checked once the commit arrives.' });
}
let waitTicking = false;
async function waitOnce() {
  if (!waitingFor.length || checking || waitTicking) return;
  waitTicking = true;
  try {
    const m = await mode();
    if (m.mode !== 'desk' || checking) return;
    pullFirst();
    for (const job of waitingFor.slice()) {
      if (holds(job.commit)) {
        waitingFor.splice(waitingFor.indexOf(job), 1);
        if (job.row) runRequeued.run(job.row);
        watchQueue.push(job);
      } else if (Date.now() - job.since >= GIVE_UP_MS) {
        waitingFor.splice(waitingFor.indexOf(job), 1);
        if (job.row) runEnded.run('gave up waiting', new Date().toISOString(), job.row);
        await desk('chat.add', { id: job.id, text: 'deskVerify: gave up waiting for ' + shortOf(job.commit) + ': the tree still lacks it after ' +
          Math.round((Date.now() - job.since) / 60000) + ' minutes, so nothing was checked. Push it and claim again.' });
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
// item's check) and each must come back red: at least one FAILURE line. One line on the item says which: confirmed,
// naming the suites, or not confirmed, naming every one already green and any that could not be run. A red is what is
// expected here, so it presses neither verify.pass nor verify.reject, and it never runs the undo (verify.regress).
async function redCheck(id, commit) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  stopped = false;
  running = { id: String(id), suite: '', since: new Date().toISOString() };
  try {
    const list = await suitesOf(id);
    const reds = [];
    const greens = [];
    const unrun = [];
    if (!list.length) unrun.push('the item lists no test file');
    for (const rel of list) {
      const file = path.join(REPO, rel);
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
    const t = tree();
    const at = shortOf(commit) || t.short || t.commit || 'an unknown commit';
    const confirmed = reds.length > 0 && !greens.length && !unrun.length;
    const text = confirmed
      ? 'deskVerify: red confirmed at ' + at + ': ' + reds.join(', ')
      : 'deskVerify: red not confirmed at ' + at + ': ' + greens.map(function (g) { return g + ' is already green'; }).concat(unrun).join('; ');
    await desk('chat.add', { id: String(id), text: text });
    return { red: true, confirmed: confirmed };
  } finally {
    running = { id: '', suite: '', since: '' };
    stopped = false;
    sayIdle();
  }
}

async function drainQueue() {
  if (checking) return;
  checking = true;
  try {
    while (watchQueue.length) {
      const job = watchQueue.shift();
      // A JOB THAT NAMES A COMMIT WAITS FOR IT (goal/G19.13): pulled first, and not run until the tree holds it.
      if (job.commit) {
        const pulled = pullFirst();
        if (!holds(job.commit)) { await startWaiting(job, pulled); continue; }
      }
      if (job.row) runStarted.run(new Date().toISOString(), job.row);
      runningJob = job;
      let outcome = 'ended';
      try {
        let r = null;
        if (job.kind === 'goal') r = await goalRun(job.id);
        else if (job.kind === 'full') r = await fullRun(job.id);
        else if (job.kind === 'red') r = await redCheck(job.id, job.commit);
        else r = await claimCheck(job.id);
        if (r && r.red) outcome = r.confirmed ? 'red confirmed' : 'red not confirmed';
        else if (r && r.unchecked) outcome = 'not checked';
        else if (r && typeof r.rejected === 'boolean') outcome = r.rejected ? 'rejected' : 'passed';
      } catch (e) {
        /* the desk is the record; a failed check is asked again by its next word */
        outcome = 'broke: ' + String((e && e.message) || e).slice(0, 200);
      }
      runningJob = null;
      if (job.row) runEnded.run(outcome, new Date().toISOString(), job.row);
    }
  } finally { checking = false; runningJob = null; }
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
          // A GOAL REOPENED OR REGRESSED EMPTIES AGAIN (goal/G19.2): the desk clears its emptied mark on either, and its
          // next goal.emptied is a fresh run that the once-per-goal rule below must not swallow.
          let rb = null;
          try { rb = JSON.parse(r && r.body || 'null'); } catch (e) { rb = null; }
          if (rb && rb.id && (r.verb === 'verify.regress' || (r.verb === 'press' && rb.what === 'reopen'))) delete goalsRun[String(rb.id)];
          const job = watched(r);
          if (!job) return;
          // ONE PASS PER GOAL (goal/G8.12): a second goal.emptied for a goal already run does nothing. A re-verify
          // asked of a goal (goal/G19.2) is a word of its own and is always run.
          if (job.kind === 'goal' && !job.again && goalsRun[job.id]) return;
          if (queued.some(function (q) { return q.kind === job.kind && q.id === job.id; })) return;
          if (queuedAlready(job)) return;
          if (job.kind === 'goal' && !job.again) goalsRun[job.id] = true;
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
// shows, 'goal' or 'full'. The stop flag is cleared before the first suite and after the last, so a Stop ends this
// run and never the next one - it was cleared only by an item check, and a full run stopped by hand left the next
// full run stopped at its first suite.
async function runList(doing, goalId, list) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  const reds = [];
  // The suites that printed a red, apart from the missing and the stopped ones: what the undo reads (goal/G19.2).
  const failed = [];
  stopped = false;
  for (const where of list) {
    const index = list.indexOf(where) + 1;
    const expected = expectedOf(where);
    const file = path.join(REPO, where);
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
    if (run.stopped) { reds.push(where + ': stopped by hand'); break; }
    if (run.timedOut) reds.push(where + ': stopped at the time limit of ' + SUITE_MS + 'ms');
    else if (/FAILURE #/.test(run.said)) { reds.push(where); failed.push(where); }
  }
  running = { id: '', suite: '', since: '' };
  stopped = false;
  // THE REPORT IS ONE LINE (goal/G8.7, Andy: "both"): what went red, in the goal's own chat, where he reads it. Since
  // goal/G19.2 the caller writes it, after the undo below, so the one line also says what the red took back.
  const text = reds.length
    ? doing + ' run on ' + list.length + ' suites: red in ' + reds.join(', ')
    : doing + ' run on ' + list.length + ' suites: all green';
  return { ran: list, reds: reds, failed: failed, text: text };
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
  const t = tree();
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
  const pulled = pullFirst();
  const r = await runList('goal', goalId, await goalSuites(goalId));
  const undo = await regress(r.failed, pulled, 'goal');
  const t = tree();
  const where = ' (at ' + (t.short || t.commit || 'an unknown commit') + ', ' + pulled + ')';
  await desk('chat.add', { id: String(goalId), text: r.text + where + (r.reds.length ? ', so the goal is not passed' : '') + regressSaid(undo) });
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
  const pulled = pullFirst();
  const r = await runList('full', goalId, suiteFiles().map(rel));
  const undo = await regress(r.failed, pulled, 'full');
  const t = tree();
  await desk('chat.add', { id: String(goalId), text: r.text + ' (at ' + (t.short || t.commit || 'an unknown commit') + ', ' + pulled + ')' + regressSaid(undo) });
  sayIdle();
  return r;
}

// IDLE TIME (goal/G8.4). Andy, 2026-10-06: "when it's agent or it's desk have been idle for more than an hour". The box
// adds what the hour alone misses: a node whose agent holds a phase is busy however long the silence. So idle is an
// hour since the newest write the desk holds AND no open item taken by this node's agent (--node's name).
// The newest write is read with the desk's own `changes`, from a cursor kept here, so after the first read only what is
// new is asked for. The first read walks every record once, page by page; that is its cost, stated, not hidden.
const IDLE_MS = 60 * 60 * 1000;
let cursor = { n: 0, at: '' };
function desk(verb, args) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  const one = {}; one[verb] = args;
  return spirit.core.ask('jobs.api', { ask: { desk: one } }, 'http://127.0.0.1:' + port)
    .then(function (r) { return r && r.status === 200 && r.body ? r.body : {}; }, function () { return {}; });
}
async function newestWrite() {
  for (let i = 0; i < 10000; i++) {
    const page = await desk('changes', { n: cursor.n, line: 0 });
    const recs = Array.isArray(page.records) ? page.records : [];
    // Records come in the order they were written, so the last one is the newest; a page with nothing new keeps it.
    if (recs.length) cursor.at = String(recs[recs.length - 1].at || cursor.at);
    if (Number(page.n) > cursor.n) cursor.n = Number(page.n);
    if (!page.more || !recs.length) break;
  }
  return cursor.at;
}
async function idle() {
  const since = await newestWrite();
  const found = await desk('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false });
  const items = (Array.isArray(found.items) ? found.items : []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
  const holding = NODE_NAME ? items.filter(function (it) { return it.with === NODE_NAME; }).map(function (it) { return String(it.id); }) : [];
  const quiet = !!since && Date.now() - Date.parse(since) >= IDLE_MS;
  return { idle: quiet && !holding.length, since: since, holding: holding };
}
// A PASS OF THE CHORES. Busy, it does nothing. Idle, it still runs no suite: the box's limit, the report comes from
// the dataset and never from a run. What the chores are - which paths one may write, what the report holds - is his to
// rule first (the red question on goal/G8.4), so until then a pass names nothing done.
async function choreOnce() {
  const state = await idle();
  if (!state.idle) return { did: [] };
  return { did: [] };
}

// TOLERATED REDS, ALL AT ONCE (goal/G8.7). Andy, 2026-10-06: "for now, tolerated reds have to be granted as a whole,
// in order to pop the Done button for the goal, so the final full suite lists the reds outside the goals scope in a
// red-question for the goal, that blocks the Done button for the goal."
// So: the newest outcome of every test in the dataset; a red whose suite is on no item's file list of the current goal
// is OUTSIDE; and if there are any, ONE grant on the goal row names them. A goal's Done already waits on every open
// grant (goal/G8.5), so nothing else is needed to hold it. A closed item is still the goal's, so its suites are inside.
// It asks once: while its own grant stands open, it asks for none. It presses nothing and grants nothing - granting is
// his alone, and "deskVerify will NOT press done or closed on my behalf".
const newestEach = db.prepare('SELECT suite, title, outcome FROM results WHERE rowid IN (SELECT MAX(rowid) FROM results GROUP BY suite, title)');
function goalCheck() {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  if (!port) return Promise.resolve({ goal: '', outside: [], asked: false });
  const at = function (ask) { return spirit.core.ask('jobs.api', { ask: ask }, 'http://127.0.0.1:' + port); };
  return at({ desk: { 'items.search': { text: '', currentGoalOnly: true, goalsOnly: false, includeClosed: true } } }).then(async function (r) {
    const items = ((r && r.body && Array.isArray(r.body.items)) ? r.body.items : []).map(function (i) {
      try { return JSON.parse(i.label); } catch (e) { return null; }
    }).filter(Boolean);
    const goal = (items.filter(function (i) { return i.goal === ''; })[0] || {}).id || '';
    const inside = Object.create(null);
    items.forEach(function (it) {
      (Array.isArray(it.files) ? it.files : []).forEach(function (f) {
        const p = String((f && f.path) || '');
        if (/^spirit\/test\/.+\.js$/.test(p)) inside[path.basename(p)] = true;
      });
    });
    const reds = Object.create(null);
    newestEach.all().forEach(function (row) { if (row.outcome === 'red' && !inside[row.suite]) reds[row.suite] = true; });
    const outside = Object.keys(reds).sort();
    if (!goal || !outside.length) return { goal: goal, outside: outside, asked: false };
    // Already asked and not yet granted: his list stands, and asking again would be a second button for one decision.
    const open = await at({ desk: { 'item.checks': { id: goal } } }).then(function (c) {
      return ((c && c.body && c.body.checks) || []).some(function (x) { return x.kind === 'G' && x.state === 'open' && String(x.words).indexOf('tolerated reds:') === 0; });
    }, function () { return false; });
    if (open) return { goal: goal, outside: outside, asked: false };
    await at({ desk: { 'check.add': { id: goal, kind: 'G', words: 'tolerated reds: ' + outside.join(', '), test: '' } } });
    return { goal: goal, outside: outside, asked: true };
  }, function () { return { goal: '', outside: [], asked: false }; });
}

// A ROW IS WRITTEN for a test's first record or a change of outcome, and nothing else.
function keep(suite, title, outcome) {
  const last = newest.get(suite, title);
  if (last && last.outcome === outcome) return { written: false };
  const t = tree();
  addRow.run(suite, title, outcome, t.commit, t.dirty, new Date().toISOString());
  return { written: true };
}

appServer.serve({
  mode: {
    request: {}, reply: { mode: '', apps: [''] },
    handler: function () { return mode(); },
  },
  // THE SHORT LOOP (goal/G8.6): what it would run, and one pass of it.
  suites: {
    request: {}, reply: { suites: [''] },
    handler: function () { return suites().then(function (list) { return { suites: list }; }); },
  },
  'loop.once': {
    request: {}, reply: { ran: [''] },
    handler: function () { return loopOnce(); },
  },
  // IDLE TIME (goal/G8.4): whether this node is idle, and one pass of the chores.
  idle: {
    request: {}, reply: { idle: true, since: '', holding: [''] },
    handler: function () { return idle(); },
  },
  'chore.once': {
    request: {}, reply: { did: [''] },
    handler: function () { return choreOnce(); },
  },
  // THE ONE THING IT MAY DO ON HIS NODE (goal/G8.3): run one item's suites and ask the desk to take a verify back.
  // TOLERATED REDS (goal/G8.7): the reds outside the current goal, and one grant on the goal naming them.
  'goal.check': {
    request: {}, reply: { goal: '', outside: [''], asked: false },
    handler: function () { return goalCheck(); },
  },
  // THE VERIFIER TAB'S THREE VERBS (goal/G8.11), deskVerify's own; Andy, 2026-10-09, on an app's verbs: they need no
  // grant of his until he rules the app intrinsic. Desk draws its tab from `now` and shows nothing where no deskVerify
  // answers.
  //   now            what runs, for which item, since when, and what waits
  //   records.search the dataset's rows, newest first, one bucket, as every search in this tree answers
  //   stop           his intervention: the run ends and its claim is rejected saying so, never passed
  now: {
    // THE QUEUE AS {kind, id} (goal/G19.3): declared as [''] it was refused whenever work waited, and the tab vanished.
    request: {}, reply: { running: { id: '', suite: '', since: '' }, queued: [{ kind: '', id: '' }] },
    handler: function () {
      return { running: { id: running.id, suite: running.suite, since: running.since }, queued: watchQueue.map(function (q) { return { kind: q.kind, id: q.id }; }) };
    },
  },
  'records.search': {
    request: { text: '' }, reply: { items: [{ key: '', label: '' }], more: false },
    handler: function (a) {
      const text = String(a.text || '');
      const rows = newestRows.all().filter(function (r) {
        return !text || String(r.suite).indexOf(text) !== -1 || String(r.title).indexOf(text) !== -1;
      });
      return walked(rows, function (r) {
        return { key: String(r.rowid), label: JSON.stringify({ suite: r.suite, title: r.title, outcome: r.outcome, commit: r.commit, dirty: r.dirty, at: r.at }) };
      });
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
  'claim.check': {
    request: { id: '' }, reply: { rejected: false, reds: [''] },
    handler: function (a) { return claimCheck(String(a.id || '')); },
  },
  // ONE RECORD, AS IT HAPPENS (his words above). The answer says whether it was kept: a repeat of the same outcome is
  // not, and that is the whole of the de-duplication - the history is the flips. Only his clone keeps anything: on an
  // agent's node "it will never commit", so a record there is taken and answered, and nothing is stored.
  record: {
    request: { suite: '', title: '', outcome: '' }, reply: { written: true },
    handler: function (a) {
      const suite = String(a.suite || '');
      const title = String(a.title || '');
      const outcome = String(a.outcome || '');
      if (!suite || !title) throw new Error('a record needs its suite and its title');
      if (outcome !== 'red' && outcome !== 'green') throw new Error('an outcome is red or green');
      return mode().then(function (m) { return m.mode === 'desk' ? keep(suite, title, outcome) : { written: false }; });
    },
  },
});
