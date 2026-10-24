'use strict';

// fileTransfer goal/G1.6: the fileServer is intrinsic, it runs on every node. Red on today's tree.
//   Andy (G1.1): "whether every node runs the fileServer by default; yes. its intrinsic and many apps can
//   use it." Found unbuilt at the goal's close, since no red carried it; Andy: "fix it."
// Since goal/G30.20 a server runs where its manifest's runs says, and an intrinsic one always runs at home; there is
// no include list any more.
// The contract the builder follows (the shape both agents gave in goal/G1.6):
//   1. A server's manifest may say intrinsic: true, honoured like a shell element's: always included,
//      never excluded, with nothing listed.
//   2. The node starts it on a fresh node, with no runs in its manifest.
//   3. spirit/run/process/js/fileServer/fileServer.json says intrinsic: true.
//   A server without the word is untouched: not listed, not started (slim/G1.3).

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by fileTransfer goal/G1.6: ';
const REPO_RUN = path.join(__dirname, '..', 'run');
const jobs = require('../run/spirit/jobs.js')(require('../run/spirit/kernel.js'), 65432);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function waitFor(fn, ms) { for (let t = 0; t < ms; t += 100) { if (fn()) return true; await sleep(100); } return fn(); }

test.startTest('fileTransfer goal/G1.6: an intrinsic server runs on every node');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'file-intrinsic-'));
const marks = path.join(scratch, 'marks');
fs.mkdirSync(marks);
const started = [];

// A fresh node: two node-operated servers, one intrinsic, neither with runs.
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
// Since goal/G22.5: a node's root always holds its identity, and the servers it starts are handed it (--node).
require('../run/spirit/relayAuth.js').saveIdentity(run, require('../run/spirit/relayAuth.js').generateIdentity('n'));

(async function () {
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
