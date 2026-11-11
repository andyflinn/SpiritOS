'use strict';

// spirit/run/spirit/app/deskVerify/test/deskVerify.js
// The tests of spirit/app/deskVerify/deskVerify.js (spec: ./deskVerify.md; goal/G43.27). Andy: "cw, it's supposed to be in
// run:/spirit/state/deskVerify/data/ !!!!!!!!!!!!!!!!!". The file is started as the node starts it (spirit/job.js,
// runServer), from a scratch folder, with a pipe nobody serves: it stops at the pipe, after it has opened its db.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
// spirit/app/deskVerify/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskVerify.js');
const MANIFEST = path.join(__dirname, '..', 'deskVerify.json');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Every file under a folder, relative to it.
function filesUnder(dir) {
  const out = [];
  (function walk(d) {
    let names = [];
    try { names = fs.readdirSync(d); } catch (e) { return; }
    names.forEach(function (n) {
      const p = path.join(d, n);
      if (fs.statSync(p).isDirectory()) walk(p); else out.push(path.relative(dir, p).split(path.sep).join('/'));
    });
  }(dir));
  return out.sort();
}
// Started as the node starts it, its working folder cwd; it stops at the pipe nobody serves.
function start(cwd, values, state) {
  const args = [FILE, JSON.stringify(values || {}), '--pipe', path.join(cwd, 'no-pipe')].concat(state ? ['--state', state] : []);
  const r = spawnSync(process.execPath, args, { cwd: cwd, encoding: 'utf8', timeout: 30000 });
  return { status: r.status, said: String(r.stdout || '') + String(r.stderr || '') };
}

// What the steps make, read by the steps after them.
const W = {};
test.after(function () { try { if (W.scratch) fs.rmSync(W.scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ } });

// 1. verify.db lives in its state
test.run('started with --state and no db, it makes verify.db in its state', 0.2, function () {
  if (!fs.existsSync(FILE)) return 'spirit/app/deskVerify/deskVerify.js is not there';
  W.scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverify-'));
  W.one = path.join(W.scratch, 'one');
  const state = path.join(W.one, 'spirit', 'state', 'deskVerify', 'data');
  fs.mkdirSync(state, { recursive: true });
  const r1 = start(W.one, {}, state);
  return fs.existsSync(path.join(state, 'verify.db')) || 'no verify.db in its state; it said ' + short(r1.said);
}, test.limit.long);
test.run('it makes no verify.db anywhere else in its working folder', 0.2, function () {
  if (!W.one) return 'no first start: the world failed';
  const made = filesUnder(W.one).filter(function (f) { return /verify\.db/.test(f) && f.indexOf('spirit/state/deskVerify/data/') !== 0; });
  return !made.length || 'it also made ' + short(made);
}, test.limit.quick);
test.run('it makes no verify.db beside the script', 0.2, function () {
  const beside = fs.readdirSync(path.dirname(FILE)).filter(function (n) { return /^verify\.db/.test(n); });
  return !beside.length || 'beside the script: ' + short(beside);
}, test.limit.quick);

// 2. the node hands it spirit/state/deskVerify/data/
test.run('the node names its state spirit/state/deskVerify/data/, so verify.db is kept there', 0.2, function () {
  // The node's own line (spirit/job.js, runServer): the folder it names for an app's state.
  const jobs = fs.readFileSync(path.join(RUN, 'spirit', 'job.js'), 'utf8');
  const line = (/const\s+state\s*=\s*(path\.join\(rootDir,[^;]+\));/.exec(jobs) || [])[1];
  let named = '';
  try { named = line ? new Function('path', 'rootDir', 'name', 'return ' + line)(path, RUN, 'deskVerify') : ''; } catch (e) { named = 'threw ' + e.message; }
  return path.resolve(String(named)) === path.join(RUN, 'spirit', 'state', 'deskVerify', 'data') || 'job.js names its state ' + short(named);
}, test.limit.quick);

// 3. db names another file
test.run('given db, it keeps its records in that file', 0.2, function () {
  if (!W.scratch) return 'no scratch folder: the world failed';
  const two = path.join(W.scratch, 'two');
  W.state2 = path.join(two, 'state');
  fs.mkdirSync(W.state2, { recursive: true });
  const other = path.join(two, 'elsewhere', 'mine.db');
  const r3 = start(two, { db: other }, W.state2);
  return fs.existsSync(other) || 'no file at db; it said ' + short(r3.said);
}, test.limit.long);
test.run('given db, it makes nothing in its state', 0.2, function () {
  if (!W.state2) return 'no second start: the world failed';
  return !filesUnder(W.state2).length || 'in its state: ' + short(filesUnder(W.state2));
}, test.limit.quick);

// 4. with neither, it stops
test.run('no --state and no db: it exits 2', 0.2, function () {
  if (!W.scratch) return 'no scratch folder: the world failed';
  W.three = path.join(W.scratch, 'three');
  fs.mkdirSync(W.three, { recursive: true });
  W.r4 = start(W.three, {}, '');
  return W.r4.status === 2 || 'it exited ' + W.r4.status;
}, test.limit.quick);
test.run('it says why', 0.2, function () {
  if (!W.r4) return 'no third start: the world failed';
  return /no --state and no db/.test(W.r4.said) || 'it said ' + short(W.r4.said);
}, test.limit.quick);
test.run('it makes no verify.db anywhere', 0.2, function () {
  if (!W.three) return 'no third start: the world failed';
  return !filesUnder(W.three).length || 'it made ' + short(filesUnder(W.three));
}, test.limit.quick);

// 5. its manifest leaves db empty
test.run('deskVerify.json\'s db default is empty, so a node\'s start keeps verify.db in its state', 0.2, function () {
  let m = null;
  try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { m = null; }
  const db = ((m && m.args) || []).filter(function (a) { return a && a.name === 'db'; })[0];
  return (!!db && db.default === '') || 'db in the manifest: ' + short(db);
}, test.limit.quick);
