'use strict';

// fileTransfer goal/G1.6: the fileServer is intrinsic, it runs on every node. Red on today's tree.
//   Andy (G1.1): "whether every node runs the fileServer by default; yes. its intrinsic and many apps can
//   use it." Found unbuilt at the goal's close, since no red carried it; Andy: "fix it."
// Today intrinsic is read for shell elements only (includeList.js intrinsicShell), and a server runs only
// if relay-state/include.json lists it, so a fresh node starts no fileServer.
// The contract the builder follows (the shape both agents gave in goal/G1.6):
//   1. A server's manifest may say intrinsic: true, honoured like a shell element's: always included,
//      never excluded, with nothing listed.
//   2. The node starts it on a fresh node, with no include.json at all.
//   3. spirit/run/process/js/fileServer/fileServer.json says intrinsic: true.
//   A server without the word is untouched: not listed, not started (slim/G1.3).

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by fileTransfer goal/G1.6: ';
const REPO_RUN = path.join(__dirname, '..', 'run');
const includeList = require('../run/js/includeList.js');
const jobs = require('../run/js/jobs.js')(require('../run/js/kernel.js'), 65432);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, ms) { for (let t = 0; t < ms; t += 100) { if (fn()) return true; await sleep(100); } return fn(); }

test.startTest('fileTransfer goal/G1.6: an intrinsic server runs on every node');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'file-intrinsic-'));
const marks = path.join(scratch, 'marks');
fs.mkdirSync(marks);
const started = [];

// A fresh node: two node-operated servers, one intrinsic, and no include.json at all.
const run = path.join(scratch, 'n', 'spirit', 'run');
[['core', true], ['plain', false]].forEach(function (s) {
  const dir = path.join(run, 'process', 'js', s[0]);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { label: s[0], kind: 'server', operated: 'node', args: [] };
  if (s[1]) manifest.intrinsic = true;
  fs.writeFileSync(path.join(dir, s[0] + '.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, s[0] + '.js'),
    'require("fs").writeFileSync(' + JSON.stringify(path.join(marks, s[0])) + ', "ran");\nsetInterval(function () {}, 1000);\n');
});
fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });

(async function () {
  test.subHeading('an intrinsic server is included with nothing listed, and cannot be excluded');
  const all = includeList.paths(run);
  if (all.indexOf('process/js/core') !== -1 && all.indexOf('process/js/plain') === -1) test.check('with nothing listed, the intrinsic server is included and the plain one is not');
  else test.fail(OWED + 'with nothing listed the node includes ' + JSON.stringify(all));
  try { includeList.remove(run, 'process/js/core'); } catch (e) { /* refusing is also keeping it */ }
  if (includeList.includes(run, 'process/js/core')) test.check('removing it from the list leaves it included');
  else test.fail(OWED + 'an intrinsic server could be excluded');

  test.subHeading('a fresh node starts it');
  (jobs.startNodeServers(run) || []).forEach(function (j) { started.push(j); });
  const coreRan = await waitFor(function () { return fs.existsSync(path.join(marks, 'core')); }, 8000);
  const plainRan = fs.existsSync(path.join(marks, 'plain'));
  if (coreRan && !plainRan) test.check('the intrinsic server ran; the plain one did not');
  else test.fail(OWED + 'on a fresh node: intrinsic ' + (coreRan ? 'ran' : 'did not run') + ', plain ' + (plainRan ? 'ran' : 'did not run'));

  test.subHeading('the fileServer says it');
  let m = {};
  try { m = JSON.parse(fs.readFileSync(path.join(REPO_RUN, 'process', 'js', 'fileServer', 'fileServer.json'), 'utf8')); } catch (e) { m = {}; }
  if (m.intrinsic === true) test.check('fileServer.json says intrinsic: true');
  else test.fail(OWED + 'fileServer.json does not say intrinsic: true');
})().catch(function (e) { test.fail(OWED + 'the red itself tripped: ' + (e && e.message)); }).then(function () {
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
