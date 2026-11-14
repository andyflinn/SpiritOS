'use strict';

// spirit/run/spirit/app/pushOrigin/test/pushOrigin.js
// PUSHORIGIN RUN WITH NO REPO (goal/G43.21; spec: ./pushOrigin.md). Andy, Q1: "it will push the repo it's in." A scratch
// clone with a bare origin of its own, both in the temp folder, holding a copy of pushOrigin.js where the app keeps it;
// the copy is run with no argument from outside the clone. No real repo and no network are touched.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function git(args, cwd) { return spawnSync('git', args, { cwd: cwd, encoding: 'utf8' }); }
const FILE = path.join(RUN, 'spirit', 'app', 'pushOrigin', 'pushOrigin.js');

// What the world made, for the tests after it.
const W = {};
test.after(function () { if (W.tmp) { try { fs.rmSync(W.tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ } } });

test.run('the world: a clone with one commit its bare origin does not hold', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/pushOrigin/pushOrigin.js is not there';
  const tmp = W.tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pushorigin-'));
  const origin = W.origin = path.join(tmp, 'origin.git');
  const clone = path.join(tmp, 'clone');
  git(['init', '-q', '--bare', '-b', 'master', origin], tmp);
  git(['clone', '-q', origin, clone], tmp);
  git(['config', 'user.email', 'test@example.invalid'], clone);
  git(['config', 'user.name', 'test'], clone);
  git(['checkout', '-q', '-b', 'master'], clone);
  // Origin has a master of its own first, as a real origin does; the commit to push comes after it.
  fs.writeFileSync(path.join(clone, 'first.txt'), 'on origin already\n');
  git(['add', '-A'], clone);
  git(['commit', '-q', '-m', 'on origin already'], clone);
  git(['push', '-q', 'origin', 'master'], clone);
  // goal/G43.32: pushOrigin.js takes the spirit object first, so the clone holds the product's run://spirit/ as the
  // repo does (its tracked files), pushOrigin.js among them, where the app keeps it.
  const copy = W.copy = path.join(clone, 'spirit', 'run', 'spirit', 'app', 'pushOrigin', 'pushOrigin.js');
  const repo = path.resolve(path.dirname(FILE), '..', '..', '..', '..', '..');
  (spawnSync('git', ['ls-files', '--', 'spirit/run/spirit'], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 }).stdout || '').split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(repo, f)); })
    .forEach(function (f) { const d = path.join(clone, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(repo, f), d); });
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(FILE, copy);
  fs.writeFileSync(path.join(clone, 'note.txt'), 'made by the test\n');
  git(['add', '-A'], clone);
  const made = git(['commit', '-q', '-m', 'the commit to push'], clone);
  W.head = (git(['rev-parse', 'HEAD'], clone).stdout || '').trim();
  return made.status === 0 && !!W.head ? true : 'no commit could be made: nothing judged. ' + short(made.stderr);
}, test.limit.slow);

// Run as Run starts it: the script and nothing more, from a folder that is no repo.
test.run('run with no argument it ends well', 0.2, function () {
  if (!W.head) return 'no clone to push from: the world failed';
  const r = spawnSync(process.execPath, [W.copy], { cwd: W.tmp, encoding: 'utf8', timeout: 60000 });
  W.said = String(r.stdout || '') + String(r.stderr || '');
  return r.status === 0 ? true : 'it exited ' + r.status + ': ' + short(W.said);
}, test.limit.slow);
test.run('origin now holds the commit of the repo it lives in', 0.2, function () {
  if (!W.head) return 'no clone to push from: the world failed';
  const there = (git(['rev-parse', 'master'], W.origin).stdout || '').trim();
  return there === W.head ? true : 'origin holds ' + short(there || 'nothing') + ', the clone ' + W.head + '; it said ' + short(W.said);
}, test.limit.quick);

// ── pushOrigin({repo}) as publishData calls it, tried on what can go wrong ──
// Each case its own clone with a bare origin, in the temp folder; the function is the module's own, required.
const lib = function () { try { return require(FILE).pushOrigin; } catch (e) { return null; } };
function world() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pushorigin-'));
  (W.more = W.more || []).push(tmp);
  const origin = path.join(tmp, 'origin.git'), clone = path.join(tmp, 'clone'), other = path.join(tmp, 'other');
  git(['init', '-q', '--bare', '-b', 'master', origin], tmp);
  git(['clone', '-q', origin, clone], tmp);
  [clone].forEach(function (c) { git(['config', 'user.email', 'test@example.invalid'], c); git(['config', 'user.name', 'test'], c); git(['checkout', '-q', '-b', 'master'], c); });
  fs.writeFileSync(path.join(clone, 'shared.txt'), 'line one\n');
  git(['add', '-A'], clone); git(['commit', '-q', '-m', 'base'], clone); git(['push', '-q', 'origin', 'master'], clone);
  git(['clone', '-q', origin, other], tmp);
  git(['config', 'user.email', 'test@example.invalid'], other); git(['config', 'user.name', 'other'], other);
  const head = function (dir) { return (git(['rev-parse', 'HEAD'], dir).stdout || '').trim(); };
  const originHead = function () { return (git(['rev-parse', 'master'], origin).stdout || '').trim(); };
  const commit = function (dir, file, text, msg) { fs.writeFileSync(path.join(dir, file), text); git(['add', '-A'], dir); return git(['commit', '-q', '-m', msg], dir).status === 0; };
  return { tmp: tmp, origin: origin, clone: clone, other: other, head: head, originHead: originHead, commit: commit };
}
test.after(function () { (W.more || []).forEach(function (t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (e) { /* scratch */ } }); });
const answered = function (r) { return !!r && r.ok === false && typeof r.reason === 'string' && !!r.reason; };

// Given nothing, or what is no clone, it answers ok false with its reason, and never throws.
test.run('given no repo, or one that is no clone, it answers ok false with a reason and throws nothing', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-pushorigin-')); (W.more = W.more || []).push(tmp);
  const bad = [];
  for (const a of [undefined, null, {}, { repo: '' }, { repo: path.join(tmp, 'not-there') }, { repo: tmp }]) {
    let r; try { r = await p(a); } catch (e) { bad.push(short(a) + ' threw ' + short(e && e.message)); continue; }
    if (!answered(r)) bad.push(short(a) + ' answered ' + short(r));
  }
  return !bad.length || bad.join('; ');
}, test.limit.slow);
// goal/G19.6, the box: "it refuses a detached HEAD".
test.run('a detached HEAD is refused, saying so, and the clone and origin are as they were', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const w = world();
  w.commit(w.clone, 'mine.txt', 'mine\n', 'mine');
  git(['checkout', '-q', '--detach'], w.clone);
  const before = w.head(w.clone), was = w.originHead();
  const r = await p({ repo: w.clone });
  // pushing HEAD:HEAD would make a branch called HEAD on origin (pushOrigin.js): origin keeps master alone.
  const heads = (git(['for-each-ref', '--format=%(refname)', 'refs/heads'], w.origin).stdout || '').trim();
  return (answered(r) && /detached HEAD/i.test(r.reason) && w.head(w.clone) === before && w.originHead() === was && heads === 'refs/heads/master') || 'answered ' + short(r) + ', origin moved ' + (w.originHead() !== was) + ', its branches ' + short(heads);
}, test.limit.slow);
// pushOrigin.js: "a rebase already in progress is the owner's: either way it refuses, { ok:false, reason }, and touches
// nothing". A rebase-merge leaves HEAD detached, which is refused before; an am stopped on a patch keeps HEAD on its branch.
test.run('a rebase already in progress is refused, saying so, and is still in progress after', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const w = world();
  w.commit(w.other, 'shared.txt', 'line one, theirs\n', 'theirs');
  const patch = git(['format-patch', '-1', '--stdout'], w.other).stdout || '';
  w.commit(w.clone, 'shared.txt', 'line one, mine\n', 'mine');
  w.commit(w.clone, 'mine.txt', 'mine\n', 'mine to push');
  const pf = path.join(w.tmp, 'theirs.patch'); fs.writeFileSync(pf, patch);
  const owner = git(['am', pf], w.clone);
  const apply = path.join(w.clone, '.git', 'rebase-apply');
  if (owner.status === 0 || !fs.existsSync(apply)) return 'the world: the owner\'s am did not stop on its patch';
  const was = w.originHead();
  const r = await p({ repo: w.clone });
  const still = fs.existsSync(apply);
  return (answered(r) && /rebase is in progress/i.test(r.reason) && still && w.originHead() === was) || 'answered ' + short(r) + ', the owner\'s am still in progress ' + still + ', origin moved ' + (w.originHead() !== was);
}, test.limit.slow);
// goal/G5.1, pushOrigin.js: "if the rebase hits a clash ... The clone is left exactly as it was (same HEAD, unsaved edits
// back in place, untracked files kept), and origin is unchanged."
test.run('a clash with origin: ok false, the clone as it was, its unsaved edit and untracked file back, origin unchanged', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const w = world();
  w.commit(w.other, 'shared.txt', 'line one, theirs\n', 'theirs'); git(['push', '-q', 'origin', 'master'], w.other);
  w.commit(w.clone, 'shared.txt', 'line one, mine\n', 'mine');
  fs.writeFileSync(path.join(w.clone, 'mine.txt'), 'tracked\n'); git(['add', 'mine.txt'], w.clone); git(['commit', '-q', '-m', 'tracked'], w.clone);
  fs.writeFileSync(path.join(w.clone, 'mine.txt'), 'tracked, edited unsaved\n');
  fs.writeFileSync(path.join(w.clone, 'loose.txt'), 'untracked\n');
  const before = w.head(w.clone), was = w.originHead();
  const r = await p({ repo: w.clone });
  const bad = [];
  if (!answered(r)) bad.push('answered ' + short(r));
  if (w.head(w.clone) !== before) bad.push('HEAD moved');
  if (w.originHead() !== was) bad.push('origin moved');
  try { if (fs.readFileSync(path.join(w.clone, 'mine.txt'), 'utf8') !== 'tracked, edited unsaved\n') bad.push('the unsaved edit is not back'); } catch (e) { bad.push('mine.txt is gone'); }
  if (!fs.existsSync(path.join(w.clone, 'loose.txt'))) bad.push('the untracked file is gone');
  if (fs.existsSync(path.join(w.clone, '.git', 'rebase-merge')) || fs.existsSync(path.join(w.clone, '.git', 'rebase-apply'))) bad.push('a rebase is left in progress');
  return !bad.length || bad.join('; ');
}, test.limit.slow);
// goal/G5.1, Andy: "ensures my commits go through", while the clone is behind origin; its unsaved edit comes back.
test.run('behind origin with no clash it pushes: origin holds both commits, and the unsaved edit is back', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const w = world();
  w.commit(w.other, 'theirs.txt', 'theirs\n', 'theirs'); git(['push', '-q', 'origin', 'master'], w.other);
  const theirs = w.head(w.other);
  w.commit(w.clone, 'mine.txt', 'mine\n', 'mine');
  fs.writeFileSync(path.join(w.clone, 'shared.txt'), 'line one, edited unsaved\n');
  const r = await p({ repo: w.clone });
  const on = w.originHead();
  const holds = git(['merge-base', '--is-ancestor', theirs, on], w.origin).status === 0 && /mine/.test(git(['log', '--format=%s', '-1', on], w.origin).stdout || '');
  const back = fs.readFileSync(path.join(w.clone, 'shared.txt'), 'utf8') === 'line one, edited unsaved\n';
  return (!!r && r.ok === true && holds && back) || 'answered ' + short(r) + ', origin holds both ' + holds + ', the edit back ' + back;
}, test.limit.slow);
// goal/G19.6, the box: "pushOrigin puts back exactly its own stash, or says it could not", and pushOrigin.js: "a stash
// somebody else made meanwhile stays where it is". The meanwhile is a pre-push hook in the clone that stashes an edit.
test.run('it puts back only its own stash: a stash somebody made meanwhile stays in the list, untouched', 0.4, async function () {
  const p = lib(); if (!p) return 'pushOrigin.js does not load';
  const w = world();
  w.commit(w.clone, 'mine.txt', 'mine\n', 'mine');
  fs.writeFileSync(path.join(w.clone, 'mine.txt'), 'mine, edited unsaved\n');
  const hook = path.join(w.clone, '.git', 'hooks', 'pre-push');
  fs.writeFileSync(hook, '#!/bin/sh\n[ -f .git/zzOnce ] && exit 0\ntouch .git/zzOnce\nprintf "somebody else\'s edit\\n" > shared.txt\ngit stash push -q -m "somebody else" -- shared.txt\nexit 0\n');
  fs.chmodSync(hook, 0o755);
  const r = await p({ repo: w.clone });
  const list = git(['stash', 'list', '--format=%gs'], w.clone).stdout || '';
  const kept = /somebody else/.test(list) && !/pushOrigin/.test(list);
  const back = fs.readFileSync(path.join(w.clone, 'mine.txt'), 'utf8') === 'mine, edited unsaved\n';
  const theirs = fs.readFileSync(path.join(w.clone, 'shared.txt'), 'utf8') === 'line one\n';
  return (!!r && r.ok === true && kept && back && theirs) || 'answered ' + short(r) + ', stash list ' + short(list) + ', own edit back ' + back + ', the other stash not popped ' + theirs;
}, test.limit.slow);
