'use strict';

// spirit/run/spirit/app/testicle/test/testAll.js
// The test of spirit/app/testicle/testAll.js, and of no other module (spec: ./testAll.md). goal/G47.6, box point 5: "npm test
// points at a product test-all: one command that runs every suite through testicle's queue on a fresh checkout and fails
// when anything is red." cw named it: "testAll.js, in testicle's own folder ... npm test runs it." Judged in minutes, not on
// the whole tree (wsl's red, cw: "fine"): a scratch tree with one planted script whose own suite holds and one whose own
// suite fails, testAll given those two; then given the holding one alone.
// One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = S.requireScript('spirit/test/testReport.js');
const LABH = S.requireScript('spirit/test/headLessChrome.js');

const TESTALL = 'spirit/app/testicle/testAll.js';
const GREEN = 'spirit/zzAll/green.js', GREENS = 'spirit/zzAll/test/green.js';
const RED = 'spirit/zzAll/red.js', REDS = 'spirit/zzAll/test/red.js';
const SUITE_HEAD = "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));\n";
const T = { s: null, both: null, alone: null };
test.after(function () { try { if (T.s) LABH.freeTree(T.s); } catch (e) { /* scratch */ } });

// npm test runs it (cw: "npm test runs it"), from the repository's root.
test.run('npm test runs spirit/app/testicle/testAll.js', 0.4, function () {
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')); } catch (e) { return false; }
  const cmd = String((pkg && pkg.scripts && pkg.scripts.test) || '');
  return /(^|[\s/])spirit\/run\/spirit\/app\/testicle\/testAll\.js(\s|$)/.test(cmd) || false;
}, test.limit.quick);
test.run('spirit/app/testicle/testAll.js is there', 0.2, function () {
  return fs.existsSync(path.join(RUN, TESTALL)) || false;
}, test.limit.quick);
test.run('a scratch tree is made with a script whose own suite holds and one whose own suite fails, and no node running on it', 0.2, function () {
  const t = LABH.scratchTree();
  T.s = t;
  const run = path.join(t.root, 'spirit', 'run');
  fs.mkdirSync(path.join(run, 'spirit', 'zzAll', 'test'), { recursive: true });
  fs.writeFileSync(path.join(run, GREEN), "'use strict';\n// green\n");
  fs.writeFileSync(path.join(run, RED), "'use strict';\n// red\n");
  fs.writeFileSync(path.join(run, GREENS), SUITE_HEAD + "test.run('green holds', 0.2, function () { return true; }, test.limit.quick);\n");
  fs.writeFileSync(path.join(run, REDS), SUITE_HEAD + "test.run('red fails', 0.2, function () { return false; }, test.limit.quick);\n");
  T.run = run;
  return fs.existsSync(path.join(run, REDS)) || false;
}, test.limit.slow);
test.run('testAll given both runs them and fails: it exits other than 0, since one is red', 0.8, function () {
  if (!T.run || !fs.existsSync(path.join(T.run, TESTALL))) return false;
  T.both = spawnSync(process.execPath, [TESTALL, GREEN, RED], { cwd: T.run, encoding: 'utf8', timeout: 280000 });
  return (T.both.status !== null && T.both.status !== 0) || false;
}, test.limit.long);
test.run('testAll given the holding one alone exits 0', 0.8, function () {
  if (!T.both) return false;
  T.alone = spawnSync(process.execPath, [TESTALL, GREEN], { cwd: T.run, encoding: 'utf8', timeout: 280000 });
  return T.alone.status === 0 || false;
}, test.limit.long);
