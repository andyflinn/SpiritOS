'use strict';

// spirit/run/process/js/desk/goalShare.js
// THE DESK SHARES currentGoal.json THROUGH GIT ITSELF (goal/G4.21).
//
//   Andy, 2026-10-04: "should my deskServer, when i cause a status change on an item, automatically commit & sync
//   currentGoal.json ?", "i generally only read the repo. i think we should make this automatic? agree?", "can the
//   automatic handle the complications?", "do it", and on the shape, "yes, that's the shape."
//
//   node goalShare.js --repo <dir> --path <path in the repo> --from <file> [--remote origin] [--branch master]
//
// An automation beside its owner (goal/G4.21, decided): desk.js starts this through its own node's jobs.create, so the
// node runs it as a job of process/js/desk. It fetches <remote>/<branch>, builds ONE commit on top of it that sets
// <path> to the bytes of <from> and changes nothing else, and pushes it. HIS CHECKOUT IS NEVER WRITTEN, PULLED OR
// REBASED: the commit is built in a temporary index (GIT_INDEX_FILE), from objects only, so his files, his index,
// HEAD and his branches stay as they were; he gets the file on his next pull. A refused push (someone pushed in
// between) is fetched, rebuilt on the new tip and tried again, at most TRIES times. Exit 0 with the pushed hash once
// pushed (or the tip's, when it already holds these bytes); exit 1 when it gives up.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const TRIES = 5;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] !== undefined ? String(process.argv[i + 1]) : fallback;
}
const REPO = arg('repo', '');
const PATH = arg('path', '').replace(/\\/g, '/');
const FROM = arg('from', '');
const REMOTE = arg('remote', 'origin');
const BRANCH = arg('branch', 'master');

const INDEX = path.join(os.tmpdir(), 'spirit-goalshare-' + process.pid + '.index');
// Every way out removes the temporary index first: process.exit skips a finally (wsl-claude's review of 16633dd7).
function end(code, line) {
  try { fs.unlinkSync(INDEX); } catch (e) { /* none written */ }
  (code ? process.stderr : process.stdout).write(line + '\n');
  process.exit(code);
}
if (!REPO || !PATH || !FROM) end(1, 'usage: node goalShare.js --repo <dir> --path <path in the repo> --from <file> [--remote origin] [--branch master]');
if (!fs.existsSync(FROM)) end(1, 'goalShare: no file ' + FROM);
function git(args, env) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
  return { status: r.status, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function must(r, what) { if (r.status !== 0) throw new Error(what + ': ' + (r.err || r.out)); return r.out; }

// One attempt: the remote's tip as it is now, one commit on it, one push. 'pushed', 'same' or 'refused'.
function attempt() {
  must(git(['fetch', '-q', REMOTE, '+refs/heads/' + BRANCH + ':refs/remotes/' + REMOTE + '/' + BRANCH]), 'fetch');
  const base = must(git(['rev-parse', 'refs/remotes/' + REMOTE + '/' + BRANCH]), 'rev-parse');
  const blob = must(git(['hash-object', '-w', '--no-filters', '--', path.resolve(FROM)]), 'hash-object');
  const env = { GIT_INDEX_FILE: INDEX };
  must(git(['read-tree', base], env), 'read-tree');
  must(git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + PATH], env), 'update-index');
  const tree = must(git(['write-tree'], env), 'write-tree');
  if (tree === must(git(['rev-parse', base + '^{tree}']), 'rev-parse tree')) return { result: 'same', hash: base };
  const commit = must(git(['commit-tree', tree, '-p', base, '-m', 'currentGoal.json, shared by the desk (goal/G4.21)']), 'commit-tree');
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
end(1,'goalShare: gave up after ' + TRIES + ' tries: ' + last);
