'use strict';

// spirit/run/spirit/app/pullOrigin/test/pullOrigin.js (spec: ./pullOrigin.md)
// Each case its own clone with a bare origin and a second clone that pushes to it, all in the temp folder; no real repo
// and no network are touched. The clones keep line endings as written (core.autocrlf false, set at each git clone),
// as pushOrigin's test does. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/test/testReport.js');
// ITS TEMP FOLDERS FROM THE ONE DOOR (goal/G47.1, the box, no pollution: "One helper on the spirit object hands a process
// its temp folder, made empty when asked; nothing else builds a temp path"): each under its suite's route, removed after.
const tempFolder = S.requireScript('spirit/tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/app/pullOrigin/test/pullOrigin/' + name + tempAsked); }
test.after(function () { try { require('fs').rmSync(tempFolder.path('spirit/app/pullOrigin/test/pullOrigin'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });

function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }
const FILE = path.join(RUN, 'spirit', 'app', 'pullOrigin', 'pullOrigin.js');
const lib = function () { try { return require(FILE).pullOrigin; } catch (e) { return null; } };

const W = { tmps: [] };
test.after(function () { W.tmps.forEach(function (t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) { /* scratch */ } }); });

// origin with one commit of shared.txt; clone (the owner's) and other (somebody else's) both on master.
function world() {
  const tmp = ownTemp('spirit-pullorigin');
  W.tmps.push(tmp);
  const origin = path.join(tmp, 'origin.git'), clone = path.join(tmp, 'clone'), other = path.join(tmp, 'other');
  git(['init', '-q', '--bare', '-b', 'master', origin], tmp);
  git(['clone', '-q', '-c', 'core.autocrlf=false', origin, clone], tmp);
  const who = function (c, n) { git(['config', 'user.email', 'test@example.invalid'], c); git(['config', 'user.name', n], c); };
  who(clone, 'owner'); git(['checkout', '-q', '-b', 'master'], clone);
  fs.writeFileSync(path.join(clone, 'shared.txt'), 'line one\n');
  fs.writeFileSync(path.join(clone, 'gone.txt'), 'to be changed or deleted\n');
  git(['add', '-A'], clone); git(['commit', '-q', '-m', 'base'], clone); git(['push', '-q', 'origin', 'master'], clone);
  git(['clone', '-q', '-c', 'core.autocrlf=false', origin, other], tmp);
  who(other, 'other');
  const w = { tmp: tmp, origin: origin, clone: clone, other: other };
  w.read = function (dir, f) { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return null; } };
  w.head = function (dir) { return (git(['rev-parse', 'HEAD'], dir).stdout || '').trim(); };
  w.originHead = function () { return (git(['rev-parse', 'master'], origin).stdout || '').trim(); };
  w.commit = function (dir, file, text, msg) { if (text === null) fs.rmSync(path.join(dir, file)); else fs.writeFileSync(path.join(dir, file), text); git(['add', '-A'], dir); return git(['commit', '-q', '-m', msg], dir).status === 0; };
  w.theirs = function (file, text) { w.commit(other, file, text, 'theirs'); git(['push', '-q', 'origin', 'master'], other); };
  // Ends at the front of master: on master, at origin's master, nothing left unsaved, nothing in progress.
  w.atFront = function () {
    const on = (git(['rev-parse', '--abbrev-ref', 'HEAD'], clone).stdout || '').trim();
    const clean = (git(['status', '--porcelain'], clone).stdout || '').trim() === '';
    const busy = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD'].some(function (p) { return fs.existsSync(path.join(clone, '.git', p)); });
    return on === 'master' && w.head(clone) === w.originHead() && clean && !busy;
  };
  w.branches = function () { return (git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], clone).stdout || '').split('\n').filter(Boolean); };
  return w;
}

test.run('given no repo, or a folder that is no clone, it answers ok false with a reason and throws nothing', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const tmp = ownTemp('spirit-pullorigin'); W.tmps.push(tmp);
  for (const a of [undefined, {}, { repo: '' }, { repo: tmp }]) {
    let r; try { r = await p(a); } catch (e) { return false; }
    if (!r || r.ok !== false || !r.reason) return false;
  }
  return true;
}, test.limit.slow);

// Andy: "push any changes i made".
test.run('its owner\'s edited and new files are committed and pushed, and the clone ends at the front of master', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  fs.writeFileSync(path.join(w.clone, 'shared.txt'), 'line one, his\n');
  fs.writeFileSync(path.join(w.clone, 'new.txt'), 'new of his\n');
  const r = await p({ repo: w.clone });
  const there = (git(['show', 'master:shared.txt'], w.origin).stdout || '') === 'line one, his\n' && (git(['show', 'master:new.txt'], w.origin).stdout || '') === 'new of his\n';
  return (!!r && r.ok === true && there && w.atFront()) || false;
}, test.limit.slow);

// Andy: "pull to the front of master".
test.run('behind origin, it takes origin\'s newest and lays its owner\'s change on top', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  w.theirs('theirs.txt', 'theirs\n');
  fs.writeFileSync(path.join(w.clone, 'mine.txt'), 'mine\n');
  const r = await p({ repo: w.clone });
  return (!!r && r.ok === true && w.read(w.clone, 'theirs.txt') === 'theirs\n' && w.read(w.clone, 'mine.txt') === 'mine\n' && w.atFront()) || false;
}, test.limit.slow);

test.run('with nothing of its own and nothing new on origin, it ends well and makes no commit', 0.2, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  const was = w.originHead();
  const r = await p({ repo: w.clone });
  return (!!r && r.ok === true && w.originHead() === was && w.atFront()) || false;
}, test.limit.slow);

// Andy: "past any mess that sometimes blocks it": both changed the same line, and the owner's line wins.
test.run('where its owner and origin changed the same line, its owner\'s line wins, and it is pushed', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  w.theirs('shared.txt', 'line one, theirs\n');
  fs.writeFileSync(path.join(w.clone, 'shared.txt'), 'line one, his\n');
  const r = await p({ repo: w.clone });
  return (!!r && r.ok === true && (git(['show', 'master:shared.txt'], w.origin).stdout || '') === 'line one, his\n' && w.atFront()) || false;
}, test.limit.slow);

test.run('a rebase left in progress is ended, and the clone ends at the front of master', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  w.theirs('shared.txt', 'line one, theirs\n');
  w.commit(w.clone, 'shared.txt', 'line one, mine\n', 'mine');
  git(['fetch', '-q', 'origin'], w.clone);
  const stuck = git(['rebase', 'origin/master'], w.clone);
  if (stuck.status === 0 || !fs.existsSync(path.join(w.clone, '.git', 'rebase-merge')) && !fs.existsSync(path.join(w.clone, '.git', 'rebase-apply'))) return false;
  const r = await p({ repo: w.clone });
  return (!!r && r.ok === true && w.atFront()) || false;
}, test.limit.slow);

test.run('a merge left in progress is ended, and the clone ends at the front of master', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  w.theirs('shared.txt', 'line one, theirs\n');
  w.commit(w.clone, 'shared.txt', 'line one, mine\n', 'mine');
  git(['fetch', '-q', 'origin'], w.clone);
  const stuck = git(['merge', 'origin/master'], w.clone);
  if (stuck.status === 0 || !fs.existsSync(path.join(w.clone, '.git', 'MERGE_HEAD'))) return false;
  const r = await p({ repo: w.clone });
  return (!!r && r.ok === true && w.atFront()) || false;
}, test.limit.slow);

// A detached HEAD's own commits are never lost.
test.run('a detached HEAD goes back to master, its own commit kept on a branch of its own', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  git(['checkout', '-q', '--detach'], w.clone);
  w.commit(w.clone, 'detached.txt', 'made detached\n', 'detached');
  const lone = w.head(w.clone);
  const r = await p({ repo: w.clone });
  const kept = w.branches().some(function (b) { return /^pullOrigin-/.test(b) && w.head(w.clone) !== lone && (git(['rev-parse', b], w.clone).stdout || '').trim() === lone; });
  return (!!r && r.ok === true && kept && w.atFront()) || false;
}, test.limit.slow);

// What no side can win (one deleted what the other changed): the owner's commits are kept, and master is origin's.
test.run('a clash no side wins leaves master at origin\'s, its owner\'s commit kept on a branch, and says so', 0.4, async function () {
  const p = lib(); if (!p) return false;
  const w = world();
  w.theirs('gone.txt', null);
  fs.writeFileSync(path.join(w.clone, 'gone.txt'), 'changed by him\n');
  const r = await p({ repo: w.clone });
  const kept = w.branches().filter(function (b) { return /^pullOrigin-/.test(b); }).some(function (b) { return (git(['show', b + ':gone.txt'], w.clone).stdout || '') === 'changed by him\n'; });
  const said = !!r && (r.did || []).some(function (d) { return /kept on the branch pullOrigin-/.test(d); });
  return (!!r && r.ok === true && kept && said && w.atFront()) || false;
}, test.limit.slow);

// Run as Run starts it: the script and nothing more, from a folder that is no repo; it syncs the clone it lives in.
test.run('run with no argument it syncs the clone it lives in, and its line says ok', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  const w = world();
  const repo = path.resolve(RUN, '..', '..');
  (spawnSync('git', ['ls-files', '--', 'spirit/run/spirit'], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout || '').split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(repo, f)); })
    .forEach(function (f) { const d = path.join(w.clone, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(repo, f), d); });
  const copy = path.join(w.clone, 'spirit', 'run', 'spirit', 'app', 'pullOrigin', 'pullOrigin.js');
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(FILE, copy);
  const r = spawnSync(process.execPath, [copy], { cwd: w.tmp, encoding: 'utf8', timeout: 120000 });
  return (r.status === 0 && /^pullOrigin: ok/.test(r.stdout || '') && w.atFront() && (git(['ls-tree', '-r', '--name-only', 'master'], w.origin).stdout || '').indexOf('spirit/run/spirit/app/pullOrigin/pullOrigin.js') !== -1) || false;
}, test.limit.long);
