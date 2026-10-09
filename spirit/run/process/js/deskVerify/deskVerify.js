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
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const appServer = require('../../../js/appServer.js');

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
const newest = db.prepare('SELECT outcome FROM results WHERE suite = ? AND title = ? ORDER BY rowid DESC LIMIT 1');
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
  return suites().then(function (list) {
    const ran = [];
    list.forEach(function (rel) {
      const file = path.join(REPO, rel);
      if (!fs.existsSync(file)) return;
      spawnSync(process.execPath, [file, '--verify-port', String(port)], { cwd: REPO, stdio: 'ignore', timeout: 600000 });
      ran.push(rel);
    });
    return { ran: ran };
  });
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
