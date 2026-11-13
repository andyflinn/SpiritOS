'use strict';

// spirit/run/spirit/test/buildStamp.js
// The tests of spirit/buildStamp.js, and of no other module (spec: ./buildStamp.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72).
//
// Which commit is this process actually running: git first (a deployed relay is a checkout), build.json second (the
// copies labMaster makes are trees, not repositories), "unknown" said plainly otherwise; and what a copy built from
// `git ls-files` would leave behind. Each test makes its own scratch repository or bare tree in the temp folder.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const S = require(path.join(RUN, 'spirit', 'buildStamp.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
function git(repo, args) { return execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'].concat(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
// A scratch repository holding spirit/run/spirit/a.js, committed: { repo, run } where run is its spirit/run.
function repository() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-buildstamp-'));
  git(repo, ['init', '-q']);
  put(path.join(repo, 'spirit', 'run', 'spirit', 'a.js'), 'one\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'first']);
  return { repo: repo, run: path.join(repo, 'spirit', 'run') };
}
// A tree in no repository (the temp folder is checked to be none), as labMaster's copies are.
function bareTree() {
  const run = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-buildstamp-')), 'spirit', 'run');
  fs.mkdirSync(run, { recursive: true });
  return run;
}
let inRepo = false;
try { git(os.tmpdir(), ['rev-parse', '--git-dir']); inRepo = true; } catch (e) { inRepo = false; }

// ── git first ──
let R = null;
test.run('the world: a checkout with one commit', 0.2, function () {
  R = repository();
  return !!git(R.repo, ['rev-parse', 'HEAD']) || 'no commit';
}, test.limit.quick);
test.run('in a checkout, resolve answers the commit HEAD is at, from git, with its commit time', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  const s = S.resolve(R.run);
  const want = git(R.repo, ['rev-parse', '--short', 'HEAD']);
  return (s.source === 'git' && s.commit === want && s.at === git(R.repo, ['log', '-1', '--format=%cI']) && s.dirty === false) || 'stamp: ' + short(s) + ', want ' + want;
}, test.limit.quick);
test.run('a tracked file edited and not committed is dirty: a bare sha there would be a confident lie', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  put(path.join(R.run, 'spirit', 'a.js'), 'edited\n');
  const s = S.resolve(R.run);
  git(R.repo, ['checkout', '--', '.']);
  return (s.dirty === true && s.source === 'git') || 'stamp: ' + short(s);
}, test.limit.quick);
test.run('git first: a checkout that also holds a build.json answers from git', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  put(path.join(R.run, S.STAMP_FILE), JSON.stringify({ commit: 'from-the-file' }));
  const s = S.resolve(R.run);
  fs.unlinkSync(path.join(R.run, S.STAMP_FILE));
  return (s.source === 'git' && s.commit !== 'from-the-file') || 'stamp: ' + short(s);
}, test.limit.quick);
test.run('fromGit answers null where there is no repository', 0.2, function () {
  if (inRepo) return 'the temp folder is inside a git repository: this cannot be judged here';
  return S.fromGit(bareTree()) === null || 'fromGit: ' + short(S.fromGit(bareTree()));
}, test.limit.quick);

// ── the file second, for copies ──
test.run('STAMP_FILE is build.json', 0.2, function () {
  return S.STAMP_FILE === 'build.json' || 'STAMP_FILE: ' + short(S.STAMP_FILE);
}, test.limit.quick);
test.run('write puts the stamp in build.json and a tree with no repository resolves from it, untracked count included', 0.2, function () {
  if (inRepo) return 'the temp folder is inside a git repository: this cannot be judged here';
  const run = bareTree();
  const ok = S.write(run, { commit: 'abc1234', dirty: true, at: '2026-11-13T09:00:00+01:00', untracked: 3 });
  const s = S.resolve(run);
  return (ok === true && s.source === 'file' && s.commit === 'abc1234' && s.dirty === true && s.at === '2026-11-13T09:00:00+01:00' && s.untracked === 3) || 'write ' + ok + ', stamp ' + short(s);
}, test.limit.quick);
test.run('write with no stamp says "unknown" rather than guessing', 0.2, function () {
  const run = bareTree();
  S.write(run, null);
  const f = JSON.parse(fs.readFileSync(path.join(run, S.STAMP_FILE), 'utf8'));
  return (f.commit === 'unknown' && f.dirty === false && f.at === '' && f.untracked === 0) || 'build.json: ' + short(f);
}, test.limit.quick);
test.run('write is best effort: a folder that cannot be written answers false and does not throw', 0.2, function () {
  let r;
  try { r = S.write(path.join(bareTree(), 'no', 'such', 'folder'), { commit: 'x' }); } catch (e) { return 'write threw: ' + short(e.message); }
  return r === false || 'write: ' + short(r);
}, test.limit.quick);
test.run('fromFile answers null for no build.json, a broken one, and one with no commit', 0.2, function () {
  const a = bareTree();
  const b = bareTree(); put(path.join(b, S.STAMP_FILE), '{not json');
  const c = bareTree(); put(path.join(c, S.STAMP_FILE), JSON.stringify({ commit: '', dirty: true }));
  const got = [S.fromFile(a), S.fromFile(b), S.fromFile(c)];
  return got.every(function (x) { return x === null; }) || 'fromFile: ' + short(got);
}, test.limit.quick);
test.run('no repository and no build.json: said plainly, commit "unknown", source "none"', 0.2, function () {
  if (inRepo) return 'the temp folder is inside a git repository: this cannot be judged here';
  const s = S.resolve(bareTree());
  return (s.commit === 'unknown' && s.source === 'none' && s.dirty === false && s.at === '') || 'stamp: ' + short(s);
}, test.limit.quick);

// ── what a copy would leave behind ──
test.run('missingFromCopy names a new file under spirit/ that git does not list: new files do not travel', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  put(path.join(R.repo, 'spirit', 'run', 'spirit', 'new.js'), 'new\n');
  const m = S.missingFromCopy(R.repo);
  return (m.length === 1 && m[0] === 'spirit/run/spirit/new.js') || 'missing: ' + short(m);
}, test.limit.quick);
test.run('git add is enough: an added file is no longer missing, with no commit', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  git(R.repo, ['add', '--', 'spirit/run/spirit/new.js']);
  const m = S.missingFromCopy(R.repo);
  return m.length === 0 || 'missing: ' + short(m);
}, test.limit.quick);
test.run('a new file under spirit/test, or outside spirit/, is not counted', 0.2, function () {
  if (!R) return 'no checkout: the world failed';
  put(path.join(R.repo, 'spirit', 'test', 't.js'), 't\n');
  put(path.join(R.repo, 'notes.txt'), 'n\n');
  const m = S.missingFromCopy(R.repo);
  return m.length === 0 || 'missing: ' + short(m);
}, test.limit.quick);
test.run('missingFromCopy outside a repository says nothing: an empty list, no throw', 0.2, function () {
  if (inRepo) return 'the temp folder is inside a git repository: this cannot be judged here';
  let m;
  try { m = S.missingFromCopy(path.dirname(path.dirname(bareTree()))); } catch (e) { return 'threw: ' + short(e.message); }
  return (Array.isArray(m) && m.length === 0) || 'missing: ' + short(m);
}, test.limit.quick);
