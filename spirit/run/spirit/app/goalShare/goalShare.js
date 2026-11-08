'use strict';

// spirit/run/spirit/app/goalShare/goalShare.js
// THE DESK SHARES THE CURRENT GOAL AND THE RULES THROUGH GIT ITSELF (goal/G4.21, goal/G5.8), an app of its own since
// goal/G43.28. Its contract and its test: ./test/goalShare.md and ./test/goalShare.js.
//
//   Andy, 2026-10-04: "should my deskServer, when i cause a status change on an item, automatically commit & sync
//   currentGoal.json ?", "do it", "yes, that's the shape."
//   Andy, goal/G43.28: "move goalShare into spirit/app/goalShare/ like pushOrigin", "it's an app with NO mount at all,
//   but a node:run:true", "the goalShare file just will just push both, current goal and rules. AT THE SAME FUCKING
//   TIME", and "one button that says "Share Current Goal", so from my point of view, it has no argument".
//
//   node goalShare.js
//
// NOTHING IS HANDED, and nothing is read from its command line: desk starts it as a job, and the app detail's Run
// starts it the same way. It reads desk's state, spirit/state/desk/data/ (read only, never written), and shares what
// it finds there into the checkout that holds this file: currentGoal.json and rules.md, to
// spirit/run/spirit/app/desk/currentGoal.json and spirit/run/spirit/app/desk/rules.md. With neither file there (an
// agent's node, whose desk holds no goal) it says so and makes no commit; with one, that one alone.
//
// HOW (goal/G4.21, unchanged): it fetches origin/master, builds ONE commit on top of it that sets both paths to the
// bytes of desk's files and changes nothing else, and pushes it. HIS CHECKOUT IS NEVER WRITTEN, PULLED OR REBASED: the
// commit is built in a temporary index (GIT_INDEX_FILE), from objects only, so his files, his index, HEAD and his
// branches stay as they were; he gets the files on his next pull. A refused push (someone pushed in between) is
// fetched, rebuilt on the new tip and tried again, at most TRIES times. Exit 0 with the pushed hash once pushed (or the
// tip's, when it already holds these bytes); exit 1 when it gives up.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TRIES = 5;
const REMOTE = 'origin';
const BRANCH = 'master';
const MESSAGE = 'the current goal and the rules, shared by the desk (goal/G43.28)';

// The run folder holding this app (spirit/run/spirit/app/goalShare/ -> spirit/run/), and the checkout holding it: the
// first folder up with a .git, as desk finds its own (nodeDesk.js, GOAL_REPO).
const RUN_DIR = path.resolve(__dirname, '..', '..', '..');
const REPO = (function () {
  for (let d = __dirname; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return '';
  }
}());
// Desk's state, as the node names it for desk (spirit/state/desk/data/), and where each file goes in the checkout.
const DESK_STATE = path.join(RUN_DIR, 'spirit', 'state', 'desk', 'data');
const SHARED = ['currentGoal.json', 'rules.md'].map(function (name) {
  return { from: path.join(DESK_STATE, name), path: path.relative(REPO || RUN_DIR, path.join(RUN_DIR, 'spirit', 'app', 'desk', name)).split(path.sep).join('/') };
});

const INDEX = path.join(os.tmpdir(), 'spirit-goalshare-' + process.pid + '.index');
// Every way out removes the temporary index first: process.exit skips a finally (wsl-claude's review of 16633dd7).
function end(code, line) {
  try { fs.unlinkSync(INDEX); } catch (e) { /* none written */ }
  (code ? process.stderr : process.stdout).write(line + '\n');
  process.exit(code);
}
const present = SHARED.filter(function (f) { return fs.existsSync(f.from); });
if (!present.length) end(0, 'goalShare: nothing to share, desk\'s state holds neither currentGoal.json nor rules.md');
if (!REPO) end(1, 'goalShare: not in a git checkout');
function git(args, env) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function must(r, what) { if (r.status !== 0) throw new Error(what + ': ' + (r.err || r.out)); return r.out; }

// One attempt: the remote's tip as it is now, one commit on it setting every file found, one push. 'pushed', 'same'
// or 'refused'.
function attempt() {
  must(git(['fetch', '-q', REMOTE, '+refs/heads/' + BRANCH + ':refs/remotes/' + REMOTE + '/' + BRANCH]), 'fetch');
  const base = must(git(['rev-parse', 'refs/remotes/' + REMOTE + '/' + BRANCH]), 'rev-parse');
  const env = { GIT_INDEX_FILE: INDEX };
  must(git(['read-tree', base], env), 'read-tree');
  present.forEach(function (f) {
    const blob = must(git(['hash-object', '-w', '--no-filters', '--', f.from]), 'hash-object');
    must(git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + f.path], env), 'update-index');
  });
  const tree = must(git(['write-tree'], env), 'write-tree');
  if (tree === must(git(['rev-parse', base + '^{tree}']), 'rev-parse tree')) return { result: 'same', hash: base };
  const commit = must(git(['commit-tree', tree, '-p', base, '-m', MESSAGE]), 'commit-tree');
  const pushed = git(['push', '-q', REMOTE, commit + ':refs/heads/' + BRANCH]);
  return pushed.status === 0 ? { result: 'pushed', hash: commit } : { result: 'refused', why: pushed.err || pushed.out };
}

let last = '';
for (let i = 1; i <= TRIES; i++) {
  let r;
  try { r = attempt(); } catch (e) { r = { result: 'refused', why: e.message }; }
  if (r.result !== 'refused') end(0, r.hash);
  last = r.why;
}
end(1, 'goalShare: gave up after ' + TRIES + ' tries: ' + last);
