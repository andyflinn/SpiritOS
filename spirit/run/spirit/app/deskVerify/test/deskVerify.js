'use strict';

// spirit/run/spirit/app/deskVerify/test/deskVerify.js
// The tests of spirit/app/deskVerify/deskVerify.js (spec: ./deskVerify.md; goal/G43.27). Andy: "cw, it's supposed to be in
// run:/spirit/state/deskVerify/data/ !!!!!!!!!!!!!!!!!". The file is started as the node starts it (spirit/jobs.js,
// runServer), from a scratch folder, with a pipe nobody serves: it stops at the pipe, after it has opened its db.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
// spirit/app/deskVerify/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskVerify.js');
const MANIFEST = path.join(__dirname, '..', 'deskVerify.json');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('deskVerify.js: where the verifier keeps its records');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskverify-'));
try {
  if (!fs.existsSync(FILE)) { test.fail('spirit/app/deskVerify/deskVerify.js is not there'); }
  else {
    test.subHeading('1. verify.db lives in its state');
    const one = path.join(scratch, 'one');
    const state = path.join(one, 'spirit', 'state', 'deskVerify', 'data');
    fs.mkdirSync(state, { recursive: true });
    const r1 = start(one, {}, state);
    ok(fs.existsSync(path.join(state, 'verify.db')), 'started with --state and no db, it makes verify.db in its state', 'no verify.db in its state; it said ' + short(r1.said));
    const made = filesUnder(one).filter(function (f) { return /verify\.db/.test(f) && f.indexOf('spirit/state/deskVerify/data/') !== 0; });
    ok(!made.length, 'it makes no verify.db anywhere else in its working folder', 'it also made ' + short(made));
    const beside = fs.readdirSync(path.dirname(FILE)).filter(function (n) { return /^verify\.db/.test(n); });
    ok(!beside.length, 'it makes no verify.db beside the script', 'beside the script: ' + short(beside));

    test.subHeading('2. the node hands it spirit/state/deskVerify/data/');
    // The node's own line (spirit/jobs.js, runServer): the folder it names for an app's state.
    const jobs = fs.readFileSync(path.join(RUN, 'spirit', 'jobs.js'), 'utf8');
    const line = (/const\s+state\s*=\s*(path\.join\(rootDir,[^;]+\));/.exec(jobs) || [])[1];
    let named = '';
    try { named = line ? new Function('path', 'rootDir', 'name', 'return ' + line)(path, RUN, 'deskVerify') : ''; } catch (e) { named = 'threw ' + e.message; }
    ok(path.resolve(String(named)) === path.join(RUN, 'spirit', 'state', 'deskVerify', 'data'),
      'the node names its state spirit/state/deskVerify/data/, so verify.db is kept there', 'jobs.js names its state ' + short(named));

    test.subHeading('3. db names another file');
    const two = path.join(scratch, 'two');
    const state2 = path.join(two, 'state');
    fs.mkdirSync(state2, { recursive: true });
    const other = path.join(two, 'elsewhere', 'mine.db');
    const r3 = start(two, { db: other }, state2);
    ok(fs.existsSync(other), 'given db, it keeps its records in that file', 'no file at db; it said ' + short(r3.said));
    ok(!filesUnder(state2).length, 'given db, it makes nothing in its state', 'in its state: ' + short(filesUnder(state2)));

    test.subHeading('4. with neither, it stops');
    const three = path.join(scratch, 'three');
    fs.mkdirSync(three, { recursive: true });
    const r4 = start(three, {}, '');
    ok(r4.status === 2, 'no --state and no db: it exits 2', 'it exited ' + r4.status);
    ok(/no --state and no db/.test(r4.said), 'it says why', 'it said ' + short(r4.said));
    ok(!filesUnder(three).length, 'it makes no verify.db anywhere', 'it made ' + short(filesUnder(three)));
  }

  test.subHeading('5. its manifest leaves db empty');
  let m = null;
  try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { m = null; }
  const db = ((m && m.args) || []).filter(function (a) { return a && a.name === 'db'; })[0];
  ok(!!db && db.default === '', 'deskVerify.json\'s db default is empty, so a node\'s start keeps verify.db in its state', 'db in the manifest: ' + short(db));
} finally {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
}

test.reportSuccessFailureCount();
