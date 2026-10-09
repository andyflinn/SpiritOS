'use strict';

// goal/G4.23, Q19: the harness also runs the suites an app or a process keeps in its own test folder. Red on today's
// tree; wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.23: "I kind of like that the picker is bound by the repo: a user-app, for example
//   should have it's tests in a test-subfolder, where they belong....", then to Q19 ("Should the harness also run
//   them?"): "the harness should check in / process/js/<process-name>/test/ / shell/<appname>/test/ / for valid suites
//   and run them if they exist."
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  spirit/test/runAll.js discovers, beside spirit/test/*.js, every spirit/run/shell/<app>/test/*.js and
//      spirit/run/process/js/<name>/test/*.js, by the same rule as today ("a suite is a file that reports": it calls
//      startTest); anything else there is named as skipped, as today.
//   2  It runs them like any other suite; the filter (the first argument) narrows them as it narrows the others.
//   3  runAll.js --list [filter] prints the suites it would run, one path per line relative to spirit/test, and runs
//      nothing: no sweep, no record written. This test asks that, never a nested run, since a second harness inside the
//      harness would sweep the temp folders of suites still running beside it.
//
// LEFT OPEN, not asserted: how such a suite finds testSupport.js (a relative require is what this test plants).
// The generated board that would have grouped them by folder is gone (goal/G8.12).
//
// The test plants two small suites, one per kind of folder, runs the real harness filtered to their names, and
// removes them again, whatever happens.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G4.23: ';
const RUN = path.join(__dirname, '..', 'run');
const RUNALL = path.join(__dirname, 'runAll.js');
const APP_DIR = path.join(RUN, 'shell', 'zzHarnessProbeApp');
const PROC_DIR = path.join(RUN, 'process', 'js', 'zzHarnessProbeProc');

function suite(name, depth) {
  return "'use strict';\n" +
    "const test = require('" + '../'.repeat(depth) + "test/testSupport.js');\n" +
    "test.startTest('" + name + ": a planted suite (goal/G4.23 Q19)');\n" +
    "test.check('" + name + " ran');\n" +
    "test.reportSuccessFailureCount();\n";
}

test.startTest('goal/G4.23 Q19: the harness runs suites in shell/<app>/test/ and process/js/<name>/test/');

let out = '';
try {
  fs.mkdirSync(path.join(APP_DIR, 'test'), { recursive: true });
  fs.mkdirSync(path.join(PROC_DIR, 'test'), { recursive: true });
  // spirit/run/shell/<app>/test/ is four folders below spirit/, process/js/<name>/test/ five.
  fs.writeFileSync(path.join(APP_DIR, 'test', 'zzHarnessProbeShell.js'), suite('zzHarnessProbeShell', 4));
  fs.writeFileSync(path.join(PROC_DIR, 'test', 'zzHarnessProbeProc.js'), suite('zzHarnessProbeProc', 5));
  const alone = spawnSync(process.execPath, [path.join(APP_DIR, 'test', 'zzHarnessProbeShell.js')], { encoding: 'utf8', timeout: 30000 });
  if (/Test completed/.test(alone.stdout) && !/❌/.test(alone.stdout)) test.check('the planted app suite runs and passes on its own');
  else test.fail('the planted app suite did not run on its own: ' + String(alone.stdout + alone.stderr).slice(-200));
  const r = spawnSync(process.execPath, [RUNALL, '--list', 'zzHarnessProbe'], { encoding: 'utf8', timeout: 60000, env: process.env });
  out = String(r.stdout || '') + String(r.stderr || '');
} catch (e) {
  test.fail('the suite threw: ' + (e && e.stack || e));
} finally {
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.rmSync(PROC_DIR, { recursive: true, force: true });
}

const lines = out.split('\n').map(function (l) { return l.trim().split(path.sep).join('/'); }).filter(Boolean);
const listed = function (tail) { return lines.some(function (l) { return /\.js$/.test(l) && l.slice(-tail.length) === tail; }); };
if (listed('run/shell/zzHarnessProbeApp/test/zzHarnessProbeShell.js')) test.check('runAll --list names shell/zzHarnessProbeApp/test/zzHarnessProbeShell.js');
else test.fail(OWED + 'runAll --list did not name the app suite; it printed: ' + JSON.stringify(out.slice(-300)));
if (listed('run/process/js/zzHarnessProbeProc/test/zzHarnessProbeProc.js')) test.check('runAll --list names process/js/zzHarnessProbeProc/test/zzHarnessProbeProc.js');
else test.fail(OWED + 'runAll --list did not name the process suite');
if (lines.every(function (l) { return /\.js$/.test(l); }) && lines.length === 2) test.check('--list prints those two paths and nothing else, and runs nothing');
else test.fail(OWED + 'runAll --list printed ' + lines.length + ' lines: ' + JSON.stringify(lines.slice(0, 5)));
if (!fs.existsSync(APP_DIR) && !fs.existsSync(PROC_DIR)) test.check('the planted folders are gone again');
else test.fail('a planted folder was left behind');

test.reportSuccessFailureCount();
