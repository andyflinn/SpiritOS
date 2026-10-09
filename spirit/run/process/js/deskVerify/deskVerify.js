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
  seen = { at: now, commit: git(['rev-parse', 'HEAD']), dirty: dirty };
  return seen;
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
function runSuite(file, port, onTests) {
  return new Promise(function (resolve) {
    const out = [];
    let timedOut = false;
    let tests = 0;
    const kid = spawn(process.execPath, [file, '--verify-port', String(port)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    runningKid = kid;
    // EACH ASSERTION AS IT IS PRINTED (goal/G8.12), so the tab's bar moves while a suite runs rather than once it
    // ends. The printed lines are what every reader of a suite uses (runAll, claim.check), not the exit code.
    const count = function (text) {
      const n = String(text).split('\n').filter(function (l) { return /SUCCESS #|FAILURE #/.test(l); }).length;
      if (!n || typeof onTests !== 'function') return;
      tests += n;
      onTests(tests);
    };
    const stop = setTimeout(function () { timedOut = true; try { kid.kill(); } catch (e) { /* gone */ } }, SUITE_MS);
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
//   doing     'item' one item's suites, 'full' the short loop, 'idle' nothing running
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
  try { runningKid.kill(); } catch (e) { /* already gone */ }
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
  return claimCheckRun(id).then(function (r) { idle(); return r; }, function (e) { idle(); throw e; });
}
function claimCheckRun(id) {
  const port = Number(spirit.core.node.const.SPIRIT_PORT);
  stopped = false;
  running = { id: String(id), suite: '', since: new Date().toISOString() };
  return suitesOf(id).then(async function (list) {
    const reds = [];
    // NOTHING TO RUN IS NOT A PASS (goal/G8.10, grown from rule/11 point 2): an item with no test file on its list had
    // no reds, and no reds asked verify.pass - so it took the Done button without one assertion having run. A list with
    // nothing on it, and a listed file that is gone, are both rejections now, and the missing file is named.
    if (!list.length) reds.push({ suite: '(no test file on the item\'s list)', failures: ['nothing to run, so nothing passed'] });
    for (const rel of list) {
      const file = path.join(REPO, rel);
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
      if (lines.length) reds.push({ suite: rel, failures: lines });
    }
    if (!reds.length) {
      // ALL GREEN IS ITS WORD TOO (goal/G8.3, found by claude-windows verifying b93a54d1): Andy, "only deskVerify brings
      // the button", so saying nothing would leave Done forever absent on his node. verify.pass is that word.
      return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.pass': { id: String(id) } } } }, 'http://127.0.0.1:' + port)
        .then(function () { return { rejected: false, reds: [] }; }, function () { return { rejected: false, reds: [] }; });
    }
    const why = reds.map(function (x) { return x.suite + (x.failures.length ? ': ' + x.failures.join('; ') : ''); }).join(' | ');
    return spirit.core.ask('jobs.api', { ask: { desk: { 'verify.reject': { id: String(id), why: why } } } }, 'http://127.0.0.1:' + port)
      .then(function () { return { rejected: true, reds: reds.map(function (x) { return x.suite; }) }; },
        function () { return { rejected: true, reds: reds.map(function (x) { return x.suite; }) }; });
  });
}

// THE WATCHER (goal/G8.10). Andy, 2026-10-09, on what starts the check: "deskVerify watching changes.", and "an agent
// should be able to trigger a re-verify". Until now claim.check was a verb nobody called, so no code item on his node
// ever got its Done button. This reads the desk's own `changes` from a cursor of its own - the idle cursor is another
// reader and the two must not eat each other's pages - and runs the check on two words and no others:
//   a verifier's pass   phase.done, phase verify, pass true
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
function queuedAlready(id) { return watchQueue.indexOf(id) !== -1 || running.id === id; }
function watched(r) {
  let b = null;
  try { b = JSON.parse(r && r.body || 'null'); } catch (e) { b = null; }
  if (!b || !b.id) return '';
  if (r.verb === 'verify.again') return String(b.id);
  if (r.verb === 'phase.done' && String(b.phase) === 'verify' && b.pass === true) return String(b.id);
  return '';
}
async function drainQueue() {
  if (checking) return;
  checking = true;
  try {
    while (watchQueue.length) {
      const id = watchQueue.shift();
      try { await claimCheck(id); } catch (e) { /* the desk is the record; a failed check is asked again by its next word */ }
    }
  } finally { checking = false; }
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
          const id = watched(r);
          if (id && queued.indexOf(id) === -1 && !queuedAlready(id)) queued.push(id);
        });
      }
      if (n > watchAt) watchAt = n;
      if (!page.more || !recs.length) break;
    }
  } finally { reading = false; }
  queued.forEach(function (id) { watchQueue.push(id); });
  if (queued.length) drainQueue();
  return { read: read, queued: queued };
}
const watcher = setInterval(function () { watchOnce().catch(function () { /* next tick */ }); }, WATCH_MS);
if (watcher.unref) watcher.unref();

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
    request: {}, reply: { running: { id: '', suite: '', since: '' }, queued: [''] },
    handler: function () {
      return { running: { id: running.id, suite: running.suite, since: running.since }, queued: watchQueue.slice() };
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
