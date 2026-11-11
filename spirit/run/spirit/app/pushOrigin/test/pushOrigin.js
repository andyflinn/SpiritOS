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
}, 3000);

// Run as Run starts it: the script and nothing more, from a folder that is no repo.
test.run('run with no argument it ends well', 0.2, function () {
  if (!W.head) return 'no clone to push from: the world failed';
  const r = spawnSync(process.execPath, [W.copy], { cwd: W.tmp, encoding: 'utf8', timeout: 60000 });
  W.said = String(r.stdout || '') + String(r.stderr || '');
  return r.status === 0 ? true : 'it exited ' + r.status + ': ' + short(W.said);
}, 3000);
test.run('origin now holds the commit of the repo it lives in', 0.2, function () {
  if (!W.head) return 'no clone to push from: the world failed';
  const there = (git(['rev-parse', 'master'], W.origin).stdout || '').trim();
  return there === W.head ? true : 'origin holds ' + short(there || 'nothing') + ', the clone ' + W.head + '; it said ' + short(W.said);
}, 1000);
