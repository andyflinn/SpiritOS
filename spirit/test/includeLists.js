'use strict';

// spirit/test/includeLists.js
// A NODE STARTS ONLY WHAT ITS INCLUDE LISTS NAME — slim/G1.3, written
// FIRST, red on today's code (claude-windows tests, wsl-claude builds).
//
//   Andy: "keep server slim by default", "every lab node used for testing
//   will be starting 4 (FOUR!) server processes". His go on slim/G1.3,
//   2026-09-29. Decided in the item: the node keeps two lists, the server
//   processes it starts and the shell elements it offers, each named by its
//   path ("they're all identified by path"); no list, or not
//   listed: not started, not in the launcher, not in Jobs; intrinsic apps
//   are always included and can never be excluded ("intrinsic apps must
//   always be included, never excluded"); Desk is no longer intrinsic
//   ("desk is no longer intrinsic").
//
// THE UNITS THIS ASKS FOR:
//   - spirit/run/js/includeList.js, the ONE reader of the lists, kept in
//     relay-state/include.json, a file the owner can read (Andy, "agreed":
//     it is config he cares about, so not node.db, by 0018):
//       paths(rootDir) -> sorted array of module paths, as 'process/js/desk',
//         'shell/textEditor' (intrinsic shell apps always among them)
//       add(rootDir, path)  (a suite's setup, T6)
//   - jobs.startNodeServers(rootDir) starts only the listed ones (T1, T2),
//     and jobs.startJob refuses a script under process/ that is not listed,
//     so it never runs (T3).
//
//   - TWO NEW NODE VERBS, a config group of their own, reviewed by
//     wsl-claude and named by Andy ("config.searchModules and
//     config.setModules, so config can have other similar verbs"), both
//     loopback only:
//       config.searchModules {query} -> {items: [{key: path, label}], more}
//       config.setModules {path, on}; on starts a process live (T4),
//       off takes it off the list and it stops at the next restart.
//
// NOT HERE, AND WHY:
//   - T9 (the text file viewer offers Start Job / Open app only for what is
//     included, and the switch) is in natterIntrinsic.js, whose fake shell
//     is the one that can drive renderAppOfFile.
//   - T10's "and the desk server with it" is what T5 gives a live node (its
//     desk state folder seeds the desk server); only the manifest and the
//     intrinsic rule are asserted here.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by slim/G1.3: ';
const REPO_RUN = path.join(__dirname, '..', 'run');

test.startTest('slim/G1.3: a node starts only what its include lists name');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

let includeList = null;
try { includeList = require('../run/js/includeList.js'); } catch (e) { includeList = null; }
function can(fn) { return !!(includeList && typeof includeList[fn] === 'function'); }
// The suite speaks in names under one prefix; the list holds paths.
const PREFIX = { process: 'process/js/', shell: 'shell/' };
function names(root, kind) {
  if (!can('paths')) return null;
  let all = null;
  try { all = includeList.paths(root); } catch (e) { return 'threw ' + e.message; }
  if (!Array.isArray(all)) return all;
  return all.filter(function (p) { return p.indexOf(PREFIX[kind]) === 0; }).map(function (p) { return p.slice(PREFIX[kind].length); }).sort();
}
function add(root, kind, name) { if (!can('add')) return false; includeList.add(root, PREFIX[kind] + name); return true; }

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

// T4's whole node, and its loopback door.
let node = null;
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
// Through the node's own request helper, never a reach of its own (oneDoor.js).
function call(port, body) {
  return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
    let parsed = null;
    try { parsed = JSON.parse(r.text); } catch (e) { parsed = null; }
    return { status: r.status, text: r.text, body: parsed };
  }, function (e) { return { status: 0, text: String((e && e.code) || e), body: null }; });
}
async function booted(port) {
  for (let i = 0; i < 150; i++) {
    const r = await call(port, { verb: 'app.state' });
    if (r.status && r.status !== 0) return true;
    await sleep(200);
  }
  return false;
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
    test.fail(OWED + 'there is no includeList.add(rootDir, path) to list alpha with');
  } else {
    boot(B);
    const up = await waitFor(function () { return ran('b', 'alpha'); }, 4000);
    await sleep(800);
    if (up && !ran('b', 'beta')) test.check('alpha, listed, ran; beta, not listed, did not');
    else test.fail(OWED + 'alpha ran ' + up + ', beta ran ' + ran('b', 'beta'));
  }

  // A FACE IS A SERVER PROCESS TOO. faceProof ("serves": true) is started by
  // appClient.startAll, not startNodeServers, and the goal's own check is
  // "Start a test node: it runs server.js alone" (found reviewing 6501e589).
  test.subHeading('T1/T2 for faces: appClient.startAll starts only a listed face');
  const H = plantNode('h', []);
  ['facea', 'faceb'].forEach(function (name) {
    const dir = path.join(H, 'process', 'js', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ name: name, serves: true }));
    fs.writeFileSync(path.join(dir, name + '.js'), '');
  });
  const appClient = require('../run/js/appClient.js');
  function facesStarted() {
    const handed = [];
    appClient.createAppClient({ rootDir: H, log: function () {},
      startServerJob: function (cmd, args) { handed.push(args[args.indexOf('--app') + 1]); return null; } }).startAll();
    return handed.sort();
  }
  const noneListed = facesStarted();
  if (noneListed.length === 0) test.check('no list: startAll starts no face');
  else test.fail(OWED + 'no list, yet startAll started ' + JSON.stringify(noneListed));
  if (add(H, 'process', 'facea')) {
    const oneListed = facesStarted();
    if (JSON.stringify(oneListed) === JSON.stringify(['facea'])) test.check('facea listed: startAll starts facea and not faceb');
    else test.fail(OWED + 'with facea listed, startAll started ' + JSON.stringify(oneListed));
  } else test.fail(OWED + 'no includeList.add to list a face with');

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

  test.subHeading('T4: switching a process on starts it without a restart (config.setModules)');
  // A WHOLE TREE, COPIED (plantRun), never a link to this checkout: the
  // node resolves its root from its own file, so a link would write here.
  const G = path.join(scratch, 'g', 'spirit', 'run');
  plantRun.plantRunTree(G);
  fs.rmSync(path.join(G, 'relay-state'), { recursive: true, force: true });
  fs.mkdirSync(path.join(G, 'relay-state'), { recursive: true });
  const alphaDir = path.join(G, 'process', 'js', 'alpha');
  fs.mkdirSync(alphaDir, { recursive: true });
  fs.writeFileSync(path.join(alphaDir, 'alpha.json'), JSON.stringify({ label: 'alpha', kind: 'server', operated: 'node', args: [] }));
  fs.writeFileSync(path.join(alphaDir, 'alpha.js'),
    'require("fs").writeFileSync(' + JSON.stringify(path.join(marks, 'g-alpha')) + ', "ran");\nsetInterval(function () {}, 1000);\n');
  const port = await freePort();
  const home = path.join(scratch, 'home');
  fs.mkdirSync(home, { recursive: true });
  node = spawn(process.execPath, ['js/server.js', '--port', String(port)], {
    cwd: G, stdio: ['ignore', 'ignore', 'ignore'], env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }),
  });
  if (!(await booted(port))) {
    test.fail(OWED + 'the planted node did not come up on ' + port);
  } else {
    await sleep(1000);
    const before = ran('g', 'alpha');
    const set = await call(port, { verb: 'config.setModules', path: 'process/js/alpha', on: true });
    const up = await waitFor(function () { return ran('g', 'alpha'); }, 5000);
    if (!before && set.status === 200 && up) test.check('alpha, not running, ran once switched on, and the node was never restarted');
    else test.fail(OWED + 'before ' + before + ', config.setModules answered ' + set.status + ' ' + String(set.text).slice(0, 120) + ', alpha ran ' + up);

    // The list is the owner's, so it is a file he can read (Andy: agreed,
    // relay-state/include.json, not node.db).
    let file = null;
    try { file = fs.readFileSync(path.join(G, 'relay-state', 'include.json'), 'utf8'); JSON.parse(file); } catch (e) { file = null; }
    if (file && file.indexOf('process/js/alpha') !== -1) test.check('relay-state/include.json is readable JSON and names process/js/alpha');
    else test.fail(OWED + 'relay-state/include.json reads ' + JSON.stringify(file && file.slice(0, 120)));

    test.subHeading('config.searchModules answers what this node includes, as a search');
    const found = await call(port, { verb: 'config.searchModules', query: '' });
    const items = found.body && Array.isArray(found.body.items) ? found.body.items : null;
    const keys = items ? items.map(function (i) { return i && i.key; }) : [];
    if (found.status === 200 && items && keys.indexOf('process/js/alpha') !== -1 && typeof found.body.more === 'boolean') {
      test.check('config.searchModules {query: \'\'} -> {items, more}, process/js/alpha among the items');
    } else test.fail(OWED + 'config.searchModules answered ' + found.status + ' ' + String(found.text).slice(0, 160));
    const narrow = await call(port, { verb: 'config.searchModules', query: 'zzz-none' });
    const none = narrow.body && Array.isArray(narrow.body.items) ? narrow.body.items : null;
    if (narrow.status === 200 && none && none.length === 0) test.check('a query nothing matches finds nothing');
    else test.fail(OWED + 'a query matching nothing answered ' + narrow.status + ' ' + String(narrow.text).slice(0, 120));

    test.subHeading('Switched off, it leaves the list (and stops at the next restart)');
    const off = await call(port, { verb: 'config.setModules', path: 'process/js/alpha', on: false });
    const again = await call(port, { verb: 'config.searchModules', query: '' });
    const left = again.body && Array.isArray(again.body.items) ? again.body.items.map(function (i) { return i && i.key; }) : null;
    if (off.status === 200 && left && left.indexOf('process/js/alpha') === -1) test.check('switched off, config.searchModules no longer finds alpha');
    else test.fail(OWED + 'switched off answered ' + off.status + ', the search then finds ' + JSON.stringify(left));
  }
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  started.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  if (node) { try { node.kill(); } catch (e) { /* gone */ } }
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 500);
});
