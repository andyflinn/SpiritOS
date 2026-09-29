'use strict';

// spirit/test/includeLists.js
// A NODE STARTS ONLY WHAT ITS INCLUDE LISTS NAME — slim/G1.3, written
// FIRST, red on today's code (claude-windows tests, wsl-claude builds).
//
//   Andy: "keep server slim by default", "every lab node used for testing
//   will be starting 4 (FOUR!) server processes". His go on slim/G1.3,
//   2026-09-29. Decided in the item: the node keeps two lists, the server
//   processes it starts and the shell elements it offers; no list, or not
//   listed: not started, not in the launcher, not in Jobs; intrinsic apps
//   are always included and can never be excluded ("intrinsic apps must
//   always be included, never excluded"); Desk is no longer intrinsic
//   ("desk is no longer intrinsic").
//
// THE UNITS THIS ASKS FOR:
//   - spirit/run/js/includeList.js, the ONE reader of the lists, so where
//     they are kept is the build's (wsl-claude: node.db or a readable file
//     under relay-state/, Andy to say):
//       names(rootDir, kind) -> sorted array of names; kind 'process'|'shell'
//       add(rootDir, kind, name)  (a suite's setup, T6; no verb adds yet)
//   - jobs.startNodeServers(rootDir) starts only the listed ones (T1, T2),
//     and jobs.startJob refuses a script under process/ that is not listed,
//     so it never runs (T3).
//
// NOT HERE, AND WHY:
//   - T4 (adding starts it live): no door adds to a list yet. Proposed to
//     wait for the managers session; Andy to say.
//   - T9 (the text file viewer offers Start Job / Open app only for what is
//     included): the page cannot read relay-state/, so it needs a node verb.
//     Proposed, reviewed by wsl-claude: include.search {query, kind} ->
//     {items, more}, loopback only. Written once Andy says yes to the verb.
//   - T10's "and the desk server with it" is what T5 gives a live node (its
//     desk state folder seeds the desk server); only the manifest and the
//     intrinsic rule are asserted here.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by slim/G1.3: ';
const REPO_RUN = path.join(__dirname, '..', 'run');

test.startTest('slim/G1.3: a node starts only what its include lists name');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

let includeList = null;
try { includeList = require('../run/js/includeList.js'); } catch (e) { includeList = null; }
function can(fn) { return !!(includeList && typeof includeList[fn] === 'function'); }
function names(root, kind) { try { return can('names') ? includeList.names(root, kind) : null; } catch (e) { return 'threw ' + e.message; } }
function add(root, kind, name) { if (!can('add')) return false; includeList.add(root, kind, name); return true; }

const jobs = require('../run/js/jobs.js')(require('../run/js/kernel.js'), 65432);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'include-lists-'));
const marks = path.join(scratch, 'marks');
fs.mkdirSync(marks);
const started = [];

// A node's run folder with the given node-operated servers in process/js.
// Each one, when it runs, drops <marks>/<label>-<name> and stays up.
function plantNode(label, servers) {
  const run = path.join(scratch, label, 'spirit', 'run');
  (servers || []).forEach(function (name) {
    const dir = path.join(run, 'process', 'js', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ label: name, kind: 'server', operated: 'node', args: [] }));
    fs.writeFileSync(path.join(dir, name + '.js'),
      'require("fs").writeFileSync(' + JSON.stringify(path.join(marks, label + '-' + name)) + ', "ran");\nsetInterval(function () {}, 1000);\n');
  });
  fs.mkdirSync(path.join(run, 'relay-state'), { recursive: true });
  return run;
}
function ran(label, name) { return fs.existsSync(path.join(marks, label + '-' + name)); }
function boot(run) {
  const js = jobs.startNodeServers(run) || [];
  js.forEach(function (j) { started.push(j); });
  return js;
}
async function waitFor(fn, ms) {
  for (let t = 0; t < ms; t += 100) { if (fn()) return true; await sleep(100); }
  return fn();
}

(async function () {
  test.subHeading('T1: a node with no include list starts no server process');
  const A = plantNode('a', ['alpha', 'beta']);
  const bootA = boot(A);
  await sleep(1500);
  if (!ran('a', 'alpha') && !ran('a', 'beta') && bootA.length === 0) {
    test.check('no list: startNodeServers started nothing, and neither server ran');
  } else test.fail(OWED + 'no list, yet ' + bootA.length + ' started; alpha ran ' + ran('a', 'alpha') + ', beta ran ' + ran('a', 'beta'));

  test.subHeading('T2: a listed server starts, an unlisted one does not');
  const B = plantNode('b', ['alpha', 'beta']);
  if (!add(B, 'process', 'alpha')) {
    test.fail(OWED + 'there is no includeList.add(rootDir, kind, name) to list alpha with');
  } else {
    boot(B);
    const up = await waitFor(function () { return ran('b', 'alpha'); }, 4000);
    await sleep(800);
    if (up && !ran('b', 'beta')) test.check('alpha, listed, ran; beta, not listed, did not');
    else test.fail(OWED + 'alpha ran ' + up + ', beta ran ' + ran('b', 'beta'));
  }

  test.subHeading('T3: an unlisted process never runs, so Jobs never shows it');
  const loneDir = path.join(B, 'process', 'js', 'lone');
  fs.mkdirSync(loneDir, { recursive: true });
  const lone = path.join(loneDir, 'lone.js');
  fs.writeFileSync(path.join(loneDir, 'lone.json'), JSON.stringify({ label: 'lone', args: [] }));
  fs.writeFileSync(lone, 'require("fs").writeFileSync(' + JSON.stringify(path.join(marks, 'b-lone')) + ', "ran");\n');
  let refused = null;
  try { refused = jobs.startJob('node', [lone, '{}'], { type: 'lone' }); } catch (e) { refused = null; }
  if (refused && refused.id) started.push(refused);
  await sleep(1500);
  const shown = jobs.listJobs().filter(function (j) { return JSON.stringify(j).indexOf('lone.js') !== -1; });
  if (!ran('b', 'lone') && !shown.length) test.check('Start Job on an unlisted script ran nothing, and Jobs shows no job for it');
  else test.fail(OWED + 'the unlisted lone.js ran ' + ran('b', 'lone') + ', Jobs shows ' + shown.length + ' job(s) for it');
  // Not vacuous: once listed, the same call runs it.
  if (add(B, 'process', 'lone')) {
    let job = null;
    try { job = jobs.startJob('node', [lone, '{}'], { type: 'lone' }); } catch (e) { job = null; }
    if (job && job.id) started.push(job);
    if (await waitFor(function () { return ran('b', 'lone'); }, 4000)) test.check('listed, the same Start Job runs it');
    else test.fail(OWED + 'lone.js, listed, still did not run');
  } else test.fail(OWED + 'no includeList.add to list lone with');

  test.subHeading('T5: a live node with no list is seeded once from its relay-state/process folders');
  const C = plantNode('c', ['gamma', 'delta', 'epsilon']);
  fs.mkdirSync(path.join(C, 'relay-state', 'process', 'gamma'), { recursive: true });
  fs.mkdirSync(path.join(C, 'relay-state', 'process', 'delta'), { recursive: true });
  boot(C);
  const seededUp = await waitFor(function () { return ran('c', 'gamma') && ran('c', 'delta'); }, 4000);
  await sleep(800);
  if (seededUp && !ran('c', 'epsilon')) test.check('gamma and delta, which ran here before, started; epsilon, which never did, did not');
  else test.fail(OWED + 'gamma ran ' + ran('c', 'gamma') + ', delta ran ' + ran('c', 'delta') + ', epsilon ran ' + ran('c', 'epsilon'));
  const seeded = names(C, 'process');
  if (JSON.stringify(seeded) === JSON.stringify(['delta', 'gamma'])) test.check('the list now names delta and gamma');
  else test.fail(OWED + 'the seeded process list reads ' + JSON.stringify(seeded));
  // Once: a folder that appears later is not a reason to include it.
  fs.mkdirSync(path.join(C, 'relay-state', 'process', 'epsilon'), { recursive: true });
  boot(C);
  await sleep(1500);
  const after = names(C, 'process');
  if (!ran('c', 'epsilon') && JSON.stringify(after) === JSON.stringify(['delta', 'gamma'])) {
    test.check('seeded once: a later epsilon folder neither lists nor starts epsilon');
  } else test.fail(OWED + 'after a second boot epsilon ran ' + ran('c', 'epsilon') + ', the list reads ' + JSON.stringify(after));

  test.subHeading('T6: a suite includes what it needs on its own test node, for that run only');
  const D = plantNode('d', ['alpha']);
  const E = plantNode('e', ['alpha']);
  if (add(D, 'process', 'alpha')) {
    const inD = names(D, 'process');
    const inE = names(E, 'process');
    if (Array.isArray(inD) && inD.indexOf('alpha') !== -1 && Array.isArray(inE) && inE.indexOf('alpha') === -1) {
      test.check('listing alpha on one test node leaves another test node\'s list without it');
    } else test.fail(OWED + 'd lists ' + JSON.stringify(inD) + ', e lists ' + JSON.stringify(inE));
  } else test.fail(OWED + 'no includeList.add for a suite to include with');

  test.subHeading('T10: intrinsic apps are always included; Desk is no longer intrinsic');
  let desk = {};
  try { desk = JSON.parse(fs.readFileSync(path.join(REPO_RUN, 'shell', 'desk', 'desk.json'), 'utf8')); } catch (e) { desk = {}; }
  if (desk.intrinsic !== true) test.check('shell/desk/desk.json no longer says intrinsic');
  else test.fail(OWED + 'shell/desk/desk.json still says "intrinsic": true');
  const F = plantNode('f', []);
  [['core', true], ['plain', false]].forEach(function (p) {
    const dir = path.join(F, 'shell', p[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, p[0] + '.json'), JSON.stringify({ name: p[0], intrinsic: p[1] }));
    fs.writeFileSync(path.join(dir, p[0] + '.js'), '');
  });
  const bare = names(F, 'shell');
  if (Array.isArray(bare) && bare.indexOf('core') !== -1 && bare.indexOf('plain') === -1) {
    test.check('with nothing listed, the intrinsic app is included and the plain one is not');
  } else test.fail(OWED + 'with nothing listed the shell list reads ' + JSON.stringify(bare));
  if (add(F, 'shell', 'plain')) {
    const both = names(F, 'shell');
    if (Array.isArray(both) && both.indexOf('core') !== -1 && both.indexOf('plain') !== -1) test.check('listing plain adds it beside the intrinsic one');
    else test.fail(OWED + 'after listing plain the shell list reads ' + JSON.stringify(both));
  } else test.fail(OWED + 'no includeList.add to list a shell element with');
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
