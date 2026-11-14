'use strict';

// lab/labNodes.js
// THE LAB NODES (goal/G47.3, "Redraw the lab environment"): the nodes and relays tests run on, made once in the
// git-ignored repo://lab/node/ instead of one copy of the tree per test run. The box:
//   "repo://lab/node/ is .gitignored; labMaster maintains a set of clones just in there: two relays and three "personal" nodes."
//   "lab has its own local repo, inside a .gitignored repo://lab/<name>/: a local clone of the checkout, its only source the
//    checkout, no github remote, so nothing made in it can reach github."
//   "before a run, a lab node takes the files under test: the checkout's commit and its uncommitted edits ..., as a snapshot
//    commit on a local branch of lab's repo; the node switches to it. the checkout's own history is untouched."
//   "clean state: lab resets its node before each test (spirit/state/ wiped, node restarted), never the tests"
//   "a lock file per lab node, one test on it at a time; a test that finds every lab node taken waits."
//
// Lab's repo is repo://lab/repo/. Its only source is the checkout: a snapshot is the checkout's spirit/run as it stands on
// disk, read by lab's own index (its work tree named as the checkout's), so the checkout's index, refs and objects are never
// written. The snapshot is a commit on lab's local branch lab/snapshot. Each lab node is a git worktree of lab's repo in
// repo://lab/node/<name>/, switched to the snapshot and cleaned (git clean -x: spirit/state/ and whatever a test planted go)
// before it is handed out. The lock is repo://lab/node/<name>.lock, holding the pid of the process it was handed to; a lock
// whose holder has ended is free. The node a holder started is stopped when the holder ends, or by the next taker.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const LAB = __dirname;
const LAB_REPO = path.join(LAB, 'repo');
const NODES = path.join(LAB, 'node');
const BRANCH = 'lab/snapshot';
// "two relays and three "personal" nodes"
const POOLS = { node: ['personal1', 'personal2', 'personal3'], relay: ['relay1', 'relay2'] };

const sleepSync = function (ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function git(args, opts) {
  return execFileSync('git', args, Object.assign({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 }, opts || {})).trim();
}
// Lab's own git, its work tree the checkout: what it reads, it reads from disk; what it writes goes to lab's repo only.
function labGit(args) { return git(['--git-dir=' + path.join(LAB_REPO, '.git'), '--work-tree=' + REPO].concat(args), { cwd: REPO }); }
function alive(pid) { if (!pid) return false; try { process.kill(Number(pid), 0); return true; } catch (e) { return e.code === 'EPERM'; } }

// A SHORT LOCK OF THE WHOLE LAB: making the repo, a snapshot (one index), and every decision on a node's lock are taken
// under it, so two processes never both break the same stale node lock (wsl found that on Linux: two holders handed one
// node). Taken by 'wx'. It is held for moments, so it is stale only when its holder has ended AND it is older than
// LAB_LOCK_STALE_MS: a lock another process has just written is never taken for the dead one it replaced.
const LAB_LOCK_STALE_MS = 30000;
function tryLabLock(at) {
  try { fs.writeFileSync(at, String(process.pid), { flag: 'wx' }); return true; } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let pid = ''; let age = 0;
    try { pid = fs.readFileSync(at, 'utf8').trim(); age = Date.now() - fs.statSync(at).mtimeMs; } catch (r) { return false; }
    if (pid && !alive(pid) && age > LAB_LOCK_STALE_MS) { try { fs.unlinkSync(at); } catch (r) { /* another took it */ } }
    return false;
  }
}
async function withLabLock(fn) {
  fs.mkdirSync(NODES, { recursive: true });
  const at = path.join(NODES, '.lab.lock');
  while (!tryLabLock(at)) await sleep(50);
  try { return await fn(); } finally { try { fs.unlinkSync(at); } catch (e) { /* gone */ } }
}

// Lab's repo, made once: no remote at all, its line endings kept as the checkout's files have them.
function ensureRepo() {
  if (fs.existsSync(path.join(LAB_REPO, '.git'))) return;
  fs.mkdirSync(LAB_REPO, { recursive: true });
  git(['init', '-q', '-b', 'lab/base', LAB_REPO]);
  git(['-C', LAB_REPO, 'config', 'core.autocrlf', 'false']);
  git(['-C', LAB_REPO, 'config', 'core.safecrlf', 'false']);
  git(['-C', LAB_REPO, 'config', 'user.name', 'lab']);
  git(['-C', LAB_REPO, 'config', 'user.email', 'lab@lab.invalid']);
  git(['-C', LAB_REPO, 'config', 'commit.gpgsign', 'false']);
}

// THE FILES UNDER TEST: the checkout's spirit/run as it stands, its commit and its uncommitted edits (new files too, what
// .gitignore keeps out stays out), one commit on lab/snapshot. Answers its sha.
function snapshotUnlocked() {
  ensureRepo();
  labGit(['add', '-A', '--', 'spirit/run']);
  const tree = labGit(['write-tree']);
  let parent = '';
  try { parent = labGit(['rev-parse', '-q', '--verify', 'refs/heads/' + BRANCH]); } catch (e) { parent = ''; }
  if (parent && labGit(['rev-parse', parent + '^{tree}']) === tree) return parent;
  let head = ''; try { head = git(['-C', REPO, 'rev-parse', 'HEAD']); } catch (e) { head = 'unknown'; }
  const sha = labGit(['commit-tree', tree, '-m', 'lab snapshot of the checkout at ' + head].concat(parent ? ['-p', parent] : []));
  labGit(['update-ref', 'refs/heads/' + BRANCH, sha]);
  return sha;
}
function snapshot() { return withLabLock(snapshotUnlocked); }

// THE LOCK OF ONE LAB NODE. take(kind) waits until a node of the pool is free, and answers its name. tryLock is only ever
// called under the lab lock (firstFree), so breaking a lock whose holder ended is one process's decision.
function lockPath(name) { return path.join(NODES, name + '.lock'); }
function pidPath(name) { return path.join(NODES, name + '.pid'); }
function firstFree(pool) { return pool.find(tryLock) || ''; }
function tryLock(name) {
  const at = lockPath(name);
  try { fs.writeFileSync(at, String(process.pid), { flag: 'wx' }); return true; } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let pid = ''; try { pid = fs.readFileSync(at, 'utf8').trim(); } catch (r) { return false; }
    if (pid && alive(pid)) return false;
    try { fs.unlinkSync(at); } catch (r) { return false; }
    try { fs.writeFileSync(at, String(process.pid), { flag: 'wx' }); return true; } catch (r) { return false; }
  }
}
async function take(kind) {
  const pool = POOLS[kind];
  if (!pool) throw new Error('no lab pool ' + kind);
  fs.mkdirSync(NODES, { recursive: true });
  for (;;) {
    const name = await withLabLock(function () { return firstFree(pool); });
    if (name) return name;
    await sleep(250);
  }
}
const held = new Set();
function release(name) {
  stopNode(name);
  try { if (fs.readFileSync(lockPath(name), 'utf8').trim() === String(process.pid)) fs.unlinkSync(lockPath(name)); } catch (e) { /* not ours, or gone */ }
  held.delete(name);
}
// A holder that ends frees what it held: its nodes stopped, its locks gone.
process.on('exit', function () { Array.from(held).forEach(release); });

// The node process a holder started on a lab node, written down so the next taker can stop it.
function noteNode(name, pid) { try { fs.writeFileSync(pidPath(name), String(pid)); } catch (e) { /* the next taker cannot stop it */ } }
function stopNode(name) {
  let pid = ''; try { pid = fs.readFileSync(pidPath(name), 'utf8').trim(); } catch (e) { return; }
  if (pid && alive(pid)) { try { process.kill(Number(pid)); } catch (e) { /* gone */ } }
  try { fs.unlinkSync(pidPath(name)); } catch (e) { /* gone */ }
}

// RESET: the node stopped, its tree switched to the snapshot, everything not in it removed (spirit/state/ with it).
// A lab node made (again, when a test deleted its tree): a worktree of lab's repo at the snapshot. Under the lab lock.
function addWorktree(dir, sha) {
  const registered = function () { try { return git(['-C', LAB_REPO, 'worktree', 'list', '--porcelain']).split('\n').some(function (l) { return /^worktree /.test(l) && path.resolve(l.replace(/^worktree /, '')) === path.resolve(dir); }); } catch (e) { return false; } };
  try { git(['-C', LAB_REPO, 'worktree', 'prune']); } catch (e) { /* none */ }
  if (registered()) git(['-C', LAB_REPO, 'worktree', 'remove', '--force', dir]);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  git(['-C', LAB_REPO, 'worktree', 'add', '-q', '--detach', dir, sha]);
}
// A lab node switched to the snapshot and cleaned. A process just stopped can hold its files a moment on Windows: tried
// again before giving up.
// A name past Windows' old path limit (a test planted one) is removed with long paths on, or else by node itself.
function cleanTree(dir) {
  try { git(['-C', dir, '-c', 'core.longpaths=true', 'clean', '-q', '-ffdx']); return; } catch (e) {
    let left = [];
    try { left = git(['-C', dir, '-c', 'core.longpaths=true', 'clean', '-n', '-ffdx']).split('\n').map(function (l) { return l.replace(/^Would remove /, '').trim(); }).filter(Boolean); } catch (r) { throw e; }
    left.forEach(function (rel) { fs.rmSync(path.join(dir, rel), { recursive: true, force: true }); });
    const still = git(['-C', dir, '-c', 'core.longpaths=true', 'clean', '-n', '-ffdx']);
    if (still) throw new Error('still there after the clean: ' + still.slice(0, 200));
  }
}
function resetTree(name, dir, sha) {
  let last = null;
  for (let i = 0; i < 20; i++) {
    try {
      git(['-C', dir, '-c', 'core.longpaths=true', 'checkout', '-q', '-f', '--detach', sha]);
      cleanTree(dir);
      return dir;
    } catch (e) { last = e; sleepSync(250); }
  }
  throw new Error('lab node ' + name + ' could not be reset: ' + String(last && (last.stderr || last.message)).slice(0, 300));
}
async function reset(name, sha) {
  stopNode(name);
  const dir = path.join(NODES, name);
  if (!fs.existsSync(path.join(dir, '.git'))) { await withLabLock(function () { addWorktree(dir, sha); }); return dir; }
  return resetTree(name, dir, sha);
}

// HAND OUT ONE: a free node of the pool (waiting while all are taken), reset to the files under test. Answers
// { name, root, run, release(), started(pid) }; the caller starts its node there and names its pid by started().
async function handOut(kind) {
  const sha = await snapshot();
  const name = await take(kind);
  held.add(name);
  try {
    const root = await reset(name, sha);
    return { name: name, root: root, run: path.join(root, 'spirit', 'run'), sha: sha,
      started: function (pid) { noteNode(name, pid); }, release: function () { release(name); } };
  } catch (e) { release(name); throw e; }
}

// THE SAME, WITHOUT A PROMISE, for a test whose world is made in plain functions: it waits by blocking, which a test asking
// for a node has nothing else to do while.
function withLabLockSync(fn) {
  fs.mkdirSync(NODES, { recursive: true });
  const at = path.join(NODES, '.lab.lock');
  while (!tryLabLock(at)) sleepSync(50);
  try { return fn(); } finally { try { fs.unlinkSync(at); } catch (e) { /* gone */ } }
}
function handOutSync(kind) {
  const sha = withLabLockSync(snapshotUnlocked);
  const pool = POOLS[kind];
  if (!pool) throw new Error('no lab pool ' + kind);
  fs.mkdirSync(NODES, { recursive: true });
  let name = '';
  // One node taken, the first free one (find stops at it; filter would lock every free node of the pool), under the lab lock.
  while (!name) { name = withLabLockSync(function () { return firstFree(pool); }); if (!name) sleepSync(250); }
  held.add(name);
  try {
    stopNode(name);
    const dir = path.join(NODES, name);
    if (!fs.existsSync(path.join(dir, '.git'))) withLabLockSync(function () { addWorktree(dir, sha); });
    else resetTree(name, dir, sha);
    return { name: name, root: dir, run: path.join(dir, 'spirit', 'run'), sha: sha,
      started: function (pid) { noteNode(name, pid); }, release: function () { release(name); } };
  } catch (e) { release(name); throw e; }
}

module.exports = { handOut: handOut, handOutSync: handOutSync, snapshot: snapshot, POOLS: POOLS, LAB: LAB, NODES: NODES, LAB_REPO: LAB_REPO, BRANCH: BRANCH };
