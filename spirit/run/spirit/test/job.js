'use strict';

// spirit/run/spirit/test/job.js
// The tests of spirit/job.js, and of no other module, in this one file (spec: ./job.md). Its sections, after its own
// checks: a job's id is a route, what spirit/state/<name>/ holds, and the vendored libraries. Since goal/G43.19 it holds the one-shot apps the node
// registers (the box, 2 and 4). This file holds goal/G41.30, the review's RH1:
// "jobs.create still spawns any program". Since goal/G43.20 (box: "jobs.create starts only an app's own script,
// spirit/app/<name>/<name>.js, of an app whose <name>.json says node run true; anything else is refused"). Raw calls over http to a scratch node's door,
// no spirit object; neither Andy's node nor an agent's is touched. Each thing asked to run would write a marker of its
// own, so "it ran" is read from the disk, not from the answer.
// One test.run per test (goal/G47.2): the tests run one at a time in the order written, each section's scratch node booted
// by its "the world:" test and kept in that section's object for the tests after it; a section's world stops the node of
// the section before, as the old run did, and test.after stops whatever is left.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const { scratchNode, sleep, until } = H;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
function long(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
const WAIT_MS = 1500;
function stop(node) {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LABH.freeTree(node); } catch (e) { /* scratch */ }
}

// ── job.create starts this node's processes, and no other program (goal/G41.30, RH1) ──
const J = {};
const call = async function (args) {
  const r = await fetch(J.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'job.create', args: args }) });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, code: body && body.code, text: text };
};
const script = function (m) { return 'require("fs").writeFileSync(' + JSON.stringify(m) + ',"ran");'; };
const plant = function (rel, m) { const f = path.join(J.run, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, script(m)); return f; };
const mark = function (n) { return path.join(J.marks, n); };
const refusedCase = async function (name, m, args) {
  const a = await call(args);
  await sleep(WAIT_MS);
  const ran = fs.existsSync(m);
  return { refused: a.status >= 400 && a.status < 500 && typeof a.code === 'string' && !!a.code, refusedWhy: name + ': answered ' + a.status + ' ' + short(a.text), ran: ran, ranWhy: name + ': IT RAN, its marker is on the disk' };
};
const RC = {};
const refused = function (k) { return RC[k] ? (RC[k].refused ? true : RC[k].refusedWhy) : 'not asked: the test before it failed'; };
const neverRan = function (k) { return RC[k] ? (!RC[k].ran ? true : RC[k].ranWhy) : 'not asked: the test before it failed'; };

test.run('the world: the scratch node comes up, desk and icons switched on at boot', 0.2, async function () {
  J.marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-jobs-marks-'));
  // Icons, the first one-shot app (goal/G43.19), switched on at boot beside desk.
  J.node = await scratchNode({ servers: ['desk', 'icons'] });
  if (!J.node.up) return 'the scratch node did not come up: nothing judged';
  J.run = path.join(J.node.root, 'spirit', 'run');
  return true;
}, test.limit.slow);
test.after(function () {
  stop(J.node);
  try { if (J.marks) fs.rmSync(J.marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// another program is refused, and never runs
test.run('refused with a code: /bin/sh with a command line', 0.8, async function () {
  RC.sh = await refusedCase('/bin/sh with a command line', mark('sh'), { command: '/bin/sh', args: ['-c', 'echo pwned > ' + mark('sh')] });
  return refused('sh');
}, test.limit.slow);
test.run('and it never ran: /bin/sh with a command line', 0.8, function () { return neverRan('sh'); }, test.limit.quick);
test.run('refused with a code: sh, found on the path', 0.8, async function () {
  RC.sh2 = await refusedCase('sh, found on the path', mark('sh2'), { command: 'sh', args: ['-c', 'echo pwned > ' + mark('sh2')] });
  return refused('sh2');
}, test.limit.slow);
test.run('and it never ran: sh, found on the path', 0.8, function () { return neverRan('sh2'); }, test.limit.quick);
test.run('refused with a code: this node\'s own executable given code to run (-e)', 0.8, async function () {
  RC.dashE = await refusedCase('this node\'s own executable given code to run (-e)', mark('dashE'), { command: process.execPath, args: ['-e', script(mark('dashE'))] });
  return refused('dashE');
}, test.limit.slow);
test.run('and it never ran: this node\'s own executable given code to run (-e)', 0.8, function () { return neverRan('dashE'); }, test.limit.quick);

// this node's executable, on a script that is not its process, is refused
test.run('refused with a code: a script outside spirit/app', 0.8, async function () {
  const outside = path.join(J.marks, 'outside.js');
  fs.writeFileSync(outside, script(mark('outside')));
  RC.outside = await refusedCase('a script outside spirit/app', mark('outside'), { command: process.execPath, args: [outside] });
  return refused('outside');
}, test.limit.slow);
test.run('and it never ran: a script outside spirit/app', 0.8, function () { return neverRan('outside'); }, test.limit.quick);
test.run('refused with a code: a path climbing out of spirit/app', 0.8, async function () {
  plant('zz-climbed.js', mark('climbed'));
  RC.climbed = await refusedCase('a path climbing out of spirit/app', mark('climbed'), { command: process.execPath, args: ['spirit/app/desk/../../../zz-climbed.js'] });
  return refused('climbed');
}, test.limit.slow);
test.run('and it never ran: a path climbing out of spirit/app', 0.8, function () { return neverRan('climbed'); }, test.limit.quick);
test.run('refused with a code: an app whose json does not say node run true', 0.8, async function () {
  plant('spirit/app/zzNotRun/zzNotRun.js', mark('notRun'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzNotRun/zzNotRun.json'), JSON.stringify({ identity: { label: 'zz' } }));
  RC.notRun = await refusedCase('an app whose json does not say node run true', mark('notRun'), { command: process.execPath, args: ['spirit/app/zzNotRun/zzNotRun.js'] });
  return refused('notRun');
}, test.limit.slow);
test.run('and it never ran: an app whose json does not say node run true', 0.8, function () { return neverRan('notRun'); }, test.limit.quick);

// what this node may start still starts
test.run('an app\'s own spirit/app/<name>/<name>.js, its json saying node run true, starts', 0.2, async function () {
  // An app's own script, of an app whose json says node run true: its job is its route, spirit.app.<name>.
  plant('spirit/app/zzRun/zzRun.js', mark('run'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzRun/zzRun.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
  const inc = await call({ command: process.execPath, args: ['spirit/app/zzRun/zzRun.js'] });
  await sleep(WAIT_MS);
  return inc.status === 201 && fs.existsSync(mark('run')) ? true : 'a node run app: answered ' + inc.status + ' ' + short(inc.text) + ', ran ' + fs.existsSync(mark('run'));
}, test.limit.slow);
// A PAGE SENDS PLAIN node (the app detail's run, spirit/element/search/app/detailElement.js:68): job.js reads it as this
// node's own executable. The run before has ended, so the id is free again.
test.run('plain node with a node run app starts, as Run sends it', 0.2, async function () {
  const plainNode = await call({ command: 'node', args: ['spirit/app/zzRun/zzRun.js'] });
  await sleep(WAIT_MS);
  return plainNode.status >= 200 && plainNode.status < 300 ? true : 'node with a node run app answered ' + plainNode.status + ' ' + String(plainNode.text || '').slice(0, 160);
}, test.limit.slow);
// A SECOND SCRIPT IN AN APP FOLDER IS NEVER STARTED (goal/G43.20, the box).
test.run('refused with a code: a second script in a node run app\'s folder', 0.8, async function () {
  const helper = plant('spirit/app/zzRun/zzHelper.js', mark('helper'));
  RC.helper = await refusedCase("a second script in a node run app's folder", mark('helper'), { command: process.execPath, args: [helper] });
  return refused('helper');
}, test.limit.slow);
test.run('and it never ran: a second script in a node run app\'s folder', 0.8, function () { return neverRan('helper'); }, test.limit.quick);
// RH1 OPEN AGAIN (goal/G47.1, Andy's daily re-review): "A commit added a check that only looks at how the first argument
// ends, and anyone who can call jobs.create can get arbitrary code past it. The fix is to require that argument to be
// exactly the node's own spirit/appServer.js." Each first argument here ends in spirit/appServer.js and is not this
// node's own; the app after it is a real node run app, so only the first argument can refuse it.
const ownRunApp = function () {
  plant('spirit/app/zzRun/zzRun.js', mark('runAgain'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzRun/zzRun.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
  return 'spirit/app/zzRun/zzRun.js';
};
test.run('refused with a code: a spirit/appServer.js outside this node\'s tree, before a node run app', 0.8, async function () {
  const fake = path.join(J.marks, 'elsewhere', 'spirit', 'appServer.js');
  fs.mkdirSync(path.dirname(fake), { recursive: true });
  fs.writeFileSync(fake, script(mark('fakeOutside')));
  RC.fakeOutside = await refusedCase('a spirit/appServer.js outside this node\'s tree', mark('fakeOutside'), { command: process.execPath, args: [fake, ownRunApp()] });
  return refused('fakeOutside');
}, test.limit.slow);
test.run('and it never ran: a spirit/appServer.js outside this node\'s tree, before a node run app', 0.8, function () { return neverRan('fakeOutside'); }, test.limit.quick);
test.run('refused with a code: a spirit/appServer.js planted inside an app folder of this node, before a node run app', 0.8, async function () {
  const fake = plant('spirit/app/zzRun/spirit/appServer.js', mark('fakeInside'));
  RC.fakeInside = await refusedCase('a spirit/appServer.js planted inside an app folder', mark('fakeInside'), { command: process.execPath, args: [fake, ownRunApp()] });
  return refused('fakeInside');
}, test.limit.slow);
test.run('and it never ran: a spirit/appServer.js planted inside an app folder of this node, before a node run app', 0.8, function () { return neverRan('fakeInside'); }, test.limit.quick);

// GOAL/G41.33. THE BOX: "Console output goes to null by default, at the source, for every process. Only DEBUG turns it
// on. A crash is no exception: the exit code is enough to tell us to fix it, and we debug it by hand." Andy: "an
// appServer's should only write to stderr/stdout in DEBUG mode", "I WANT JUST THE structured json events." A job's log
// keeps what the node and the process's own published lines say. Andy, Q8, of the node and the relay themselves: "NOT the
// servers.", so only what they start is judged. scratchNode leaves DEBUG on, so each part sets it.
const door = async function (verb, args) {
  const r = await fetch(J.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
const setDebug = async function (on) { const a = await door('node.debug', { debug: { on: on } }); return !!(a.body && a.body.debug === on); };
const noisy = function (name, tail) {
  const f = path.join(J.run, 'spirit', 'app', name, name + '.js');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, tail);
  fs.writeFileSync(path.join(J.run, 'spirit', 'app', name, name + '.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
};
const finished = async function (id) {
  let job = null;
  await until(function () { return door('job.get', { key: id }).then(function (a) { job = a.body && (a.body.job || a.body); return !!(job && job.status && job.status !== 'running' && job.status !== 'pending'); }); }, 15000);
  return job;
};
const logText = function (job) { return JSON.stringify((job && job.log) || []); };
const start = async function (name) {
  const a = await door('job.create', { command: process.execPath, args: ['spirit/app/' + name + '/' + name + '.js'] });
  return a.status === 201 && a.body && a.body.id ? a.body.id : '';
};
// A process job that completes deletes itself (job.js:120), so each here ends with an exit code of its own and stays to be read.
const PUBLISH = 'const u = process.env.SPIRIT_CALLBACK_URL, id = process.env.SPIRIT_JOB_ID;'
  + 'fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call: "event.publish", args: { id: id, logMessage: "zzPublishedLine" } }) })';

// goal/G41.33: DEBUG off, a process's console goes nowhere, and what is structured stays
test.run('DEBUG is off', 0.2, async function () {
  noisy('zzNoisy', 'console.log("zzOutLine"); console.error("zzErrLine"); process.stdout.write("zzRawOut\\n"); process.stderr.write("zzRawErr\\n");'
    + PUBLISH + '.then(function () { process.exit(5); }, function () { process.exit(3); });');
  noisy('zzCrash', 'console.log("zzBeforeCrash"); throw new Error("zzCrashLine");');
  noisy('zzFlood', 'const line = "zzFlood".repeat(1000) + "\\n"; let n = 0; (function more() { while (n < 3000) { n++; if (!process.stdout.write(line)) { process.stdout.once("drain", more); return; } } process.exit(7); }());');
  return (await setDebug(false)) ? true : 'node.debug would not go off: nothing judged';
}, test.limit.quick);
test.run('a process that writes to its console starts', 0.2, async function () {
  J.id1 = await start('zzNoisy');
  if (!J.id1) return 'the process did not start: nothing judged';
  J.j1 = await finished(J.id1);
  J.said1 = logText(J.j1);
  return true;
}, test.limit.quick);
const noisyLog = function () { return J.said1 === undefined ? 'no log read: the process did not start' : ''; };
test.run('not in the job\'s log: zzOutLine', 0.2, function () { return noisyLog() || (!!J.j1 && J.said1.indexOf('zzOutLine') === -1 ? true : 'zzOutLine is in the job\'s log with DEBUG off: ' + short(J.said1)); }, test.limit.quick);
test.run('not in the job\'s log: zzErrLine', 0.2, function () { return noisyLog() || (!!J.j1 && J.said1.indexOf('zzErrLine') === -1 ? true : 'zzErrLine is in the job\'s log with DEBUG off: ' + short(J.said1)); }, test.limit.quick);
test.run('not in the job\'s log: zzRawOut', 0.2, function () { return noisyLog() || (!!J.j1 && J.said1.indexOf('zzRawOut') === -1 ? true : 'zzRawOut is in the job\'s log with DEBUG off: ' + short(J.said1)); }, test.limit.quick);
test.run('not in the job\'s log: zzRawErr', 0.2, function () { return noisyLog() || (!!J.j1 && J.said1.indexOf('zzRawErr') === -1 ? true : 'zzRawErr is in the job\'s log with DEBUG off: ' + short(J.said1)); }, test.limit.quick);
test.run('the node\'s own line stays', 0.2, function () { return noisyLog() || (J.said1.indexOf('job created') !== -1 ? true : 'the node\'s own lines went too: ' + short(J.said1)); }, test.limit.quick);
test.run('a line the process published stays', 0.2, function () { return noisyLog() || (J.said1.indexOf('zzPublishedLine') !== -1 ? true : 'a published line is gone: ' + short(J.said1)); }, test.limit.quick);
test.run('a process that crashes starts', 0.2, async function () {
  J.id2 = await start('zzCrash');
  if (!J.id2) return 'the crash did not start: nothing judged';
  J.j2 = await finished(J.id2);
  J.said2 = logText(J.j2);
  return true;
}, test.limit.quick);
test.run('a crash is no exception: its console is not in the log', 0.2, function () {
  if (J.said2 === undefined) return 'no log read: the crash did not start';
  return !!J.j2 && J.said2.indexOf('zzCrashLine') === -1 && J.said2.indexOf('zzBeforeCrash') === -1 ? true : 'a crash\'s console is in the job\'s log with DEBUG off: ' + short(J.said2);
}, test.limit.quick);
test.run('and the job says the exit code', 0.2, function () {
  const j = J.j2;
  return !!j && j.data && typeof j.data.exitCode === 'number' && j.data.exitCode !== 0 ? true : 'a crash left no exit code on the job: ' + short(j && j.data);
}, test.limit.quick);
// The attacker's way to hang it: a process that floods its console with nobody reading.
test.run('a process that floods its console starts', 0.2, async function () {
  J.id3 = await start('zzFlood');
  return J.id3 ? true : 'the flood did not start: nothing judged';
}, test.limit.quick);
test.run('it does not hang: 3 MB written and it ends, by its own exit code', 0.2, async function () {
  if (!J.id3) return 'the flood did not start: nothing judged';
  const j = await finished(J.id3);
  return !!j && j.data && j.data.exitCode === 7 ? true : 'the flood did not end with its own exit code: ' + short(j && { status: j.status, data: j.data });
}, test.limit.quick);

// goal/G41.33: only DEBUG turns it on
test.run('DEBUG is on', 0.2, async function () {
  return (await setDebug(true)) ? true : 'node.debug would not go on: nothing judged';
}, test.limit.quick);
test.run('the same process starts', 0.2, async function () {
  J.id4 = await start('zzNoisy');
  if (!J.id4) return 'the process did not start: nothing judged';
  J.said4 = logText(await finished(J.id4));
  return true;
}, test.limit.quick);
test.run('with DEBUG on, in the log: zzOutLine', 0.2, function () {
  if (J.said4 === undefined) return 'no log read: the process did not start';
  return J.said4.indexOf('zzOutLine') !== -1 ? true : 'with DEBUG on, zzOutLine is not in the job\'s log: ' + short(J.said4);
}, test.limit.quick);
test.run('with DEBUG on, in the log: zzErrLine', 0.2, function () {
  if (J.said4 === undefined) return 'no log read: the process did not start';
  return J.said4.indexOf('zzErrLine') !== -1 ? true : 'with DEBUG on, zzErrLine is not in the job\'s log: ' + short(J.said4);
}, test.limit.quick);

// ── ONE-SHOT APPS, REGISTERED BY THE NODE (goal/G43.19, box v16) ──
// The box, 2: "a one-shot app is an app with api.js and data.js at its top, node mount false or missing, and switched
// on. icons is the first."; 4: "the node registers each one-shot app where it reads the manifests and starts the
// permanent ones ... Switched off, its row goes, and a call to it answers app-not-served". Each thing that would run
// writes a marker, so "it ran" is read from the disc.
// the box, 4: a one-shot app switched on at boot is registered with the permanent ones
const branches = async function () { const t = await door('api', {}); return t.status === 200 && t.body ? Object.keys(t.body) : []; };
test.run('the world: icons\'s api.js names its verbs', 0.2, function () {
  J.iconVerbs = [];
  try { J.iconVerbs = Object.keys(require(path.join(J.run, 'spirit', 'app', 'icons', 'api.js')).verbs || {}); } catch (e) { J.iconVerbs = []; }
  return J.iconVerbs.length >= 1 ? true : 'icons has no api.js with verbs: no one-shot app to judge';
}, test.limit.quick);
test.run('icons, on in its node.json at boot, is in the api tree with no app.active asked', 0.2, async function () {
  return (await branches()).indexOf('icons') !== -1 ? true : 'the tree at boot: ' + short(await branches());
}, test.limit.quick);
test.run('and desk, a permanent server, beside it', 0.2, async function () {
  return (await branches()).indexOf('desk') !== -1 ? true : 'the tree lost desk: ' + short(await branches());
}, test.limit.quick);

// the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"; on again, it is back
test.run('the world: icons switched off', 0.2, async function () {
  return (await door('app.active', { key: 'icons', active: false })).status === 200 ? true : 'app.active icons false was refused';
}, test.limit.quick);
test.run('switched off, icons.icon answers app-not-served', 0.2, async function () {
  await sleep(WAIT_MS);
  const offCall = J.iconVerbs && J.iconVerbs.length ? await door('icons.' + J.iconVerbs[0], {}) : { text: '' };
  return /app-not-served/.test(offCall.text) ? true : 'switched off, it answered ' + offCall.status + ' ' + short(offCall.text);
}, test.limit.slow);
test.run('and the tree holds no icons', 0.2, async function () {
  return (await branches()).indexOf('icons') === -1 ? true : 'switched off, the tree holds icons';
}, test.limit.quick);
test.run('the world: icons switched on again', 0.2, async function () {
  return (await door('app.active', { key: 'icons', active: true })).status === 200 ? true : 'app.active icons true was refused';
}, test.limit.quick);
test.run('switched on again, icons is back in the tree, no restart of the node', 0.2, async function () {
  return (await until(function () { return branches().then(function (b) { return b.indexOf('icons') !== -1; }); }, 10000)) ? true : 'switched on again, the tree holds no icons';
}, test.limit.quick);

// the box, 2: "node mount false or missing": an icons.json with no node part is still one-shot
test.run('with node mount missing, icons is served', 0.2, async function () {
  const iconsJson = path.join(J.run, 'spirit', 'app', 'icons', 'icons.json');
  const kept = fs.readFileSync(iconsJson, 'utf8');
  const noNode = JSON.parse(kept); delete noNode.node;
  fs.writeFileSync(iconsJson, JSON.stringify(noNode, null, 2));
  try {
    await door('app.active', { key: 'icons', active: false });
    await sleep(WAIT_MS);
    await door('app.active', { key: 'icons', active: true });
    return (await until(function () { return branches().then(function (b) { return b.indexOf('icons') !== -1; }); }, 10000)) ? true : 'with node mount missing, the tree holds no icons: ' + short(await branches());
  } finally { fs.writeFileSync(iconsJson, kept); }
}, test.limit.slow);

// the attacker: what is not a one-shot app is never run as one
const notOneShot = async function (name, files, why) {
  const dir = path.join(J.run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  plant('spirit/app/' + name + '/' + name + '.js', mark(name));
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { label: name, intrinsic: false }, shell: { true: false, mount: true, tile: true }, node: files.nodeMount === undefined ? { mount: false } : { mount: files.nodeMount } }));
  if (files.api) fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { zz: {} } };\n');
  if (files.data) fs.writeFileSync(path.join(dir, 'data.js'), '');
  if (files.on !== false) await door('app.active', { key: name, active: true });
  await sleep(WAIT_MS);
  const c = await door(name + '.zz', {});
  await door('api', {});
  await sleep(WAIT_MS);
  const served = !/^2/.test(String(c.status)) && (await branches()).indexOf(name) === -1;
  return { notServed: served, notServedWhy: why + ': ' + name + '.zz answered ' + c.status + ' ' + short(c.text), neverRan: !fs.existsSync(mark(name)), neverRanWhy: why + ': ITS SCRIPT RAN, its marker is on the disc' };
};
const NO = {};
const notServed = function (k) { return NO[k] ? (NO[k].notServed ? true : NO[k].notServedWhy) : 'not asked: the test before it failed'; };
const scriptNeverRan = function (k) { return NO[k] ? (NO[k].neverRan ? true : NO[k].neverRanWhy) : 'not asked: the test before it failed'; };
test.run('an app with api.js and no data.js: it is not served', 0.2, async function () {
  NO.noData = await notOneShot('zzNoData', { api: true, data: false }, 'an app with api.js and no data.js');
  return notServed('noData');
}, test.limit.slow);
test.run('an app with api.js and no data.js: and its script never ran', 0.8, function () { return scriptNeverRan('noData'); }, test.limit.quick);
test.run('an app with data.js and no api.js: it is not served', 0.2, async function () {
  NO.noApi = await notOneShot('zzNoApi', { api: false, data: true }, 'an app with data.js and no api.js');
  return notServed('noApi');
}, test.limit.slow);
test.run('an app with data.js and no api.js: and its script never ran', 0.8, function () { return scriptNeverRan('noApi'); }, test.limit.quick);
test.run('an app with both, never switched on: it is not served', 0.2, async function () {
  NO.off = await notOneShot('zzOff', { api: true, data: true, on: false }, 'an app with both, never switched on');
  return notServed('off');
}, test.limit.slow);
test.run('an app with both, never switched on: and its script never ran', 0.8, function () { return scriptNeverRan('off'); }, test.limit.quick);

// The sections below, each folded in from a file of its own, run in order after the checks above.

// ── THE ROUTES PART ──
// A JOB'S ID IS A ROUTE (goal/G43.20, its box; spec: ./job.md, its section). Andy: "they're
// supposed to identify a "route" in the spirit-tree, NOT some invented number.", "ALL job id's will be routes to either a
// node supplied api (spirit.fs, etc...) or an app supplied id (spirit.app.<name>)", "a job cannot start if it is already
// running", and "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". A real node on
// a scratch copy of the tracked files; throwaway apps are planted in that copy, nothing kept in the repo. Never a live node.
const ROUTE = /^spirit(\.[A-Za-z][A-Za-z0-9]*)*$/;
// The node's own jobs, once each (Q1, Q2 and the box): the node's events, its files, its apps, its contacts, its auth.
const OWN = ['spirit', 'spirit.app', 'spirit.auth', 'spirit.contact', 'spirit.fs'];
// A throwaway app of spirit/app/<name>/: its script waits ms and ends; run true makes it a run app (node run true).
function plantApp(run, name, ms, nodeRun) {
  const dir = path.join(run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { icon: '🧪', label: name, intrinsic: false }, node: nodeRun ? { mount: false, run: true } : { mount: false } }));
  fs.writeFileSync(path.join(dir, name + '.js'), 'setTimeout(function () {}, ' + ms + ');\n');
}
const RT = {};
const rask = function (call, args) {
  return fetch(RT.node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
};

// routes: every job id is a route in the spirit tree, one job per id, and job.create starts only a run app (goal/G43.20)
test.run('the world: the routes part\'s scratch node comes up', 0.2, async function () {
  stop(J.node); J.node = null;
  RT.node = await H.scratchNode();
  if (!RT.node.up) return 'the scratch node did not come up: nothing judged';
  RT.run = path.join(RT.node.root, 'spirit', 'run');
  return true;
}, test.limit.slow);
test.after(function () { if (RT.node && RT.node.child) RT.node.child.kill(); });
test.run('the world: desk, an app server, is switched on', 0.2, async function () {
  const on = await rask('app.active', { key: 'desk', active: true });
  await H.sleep(5000);
  return on.status === 200 ? true : 'app.active desk: ' + long(on);
}, test.limit.slow);
test.run('the world: the node lists five or more jobs', 0.2, async function () {
  const list = await rask('job.search', { q: '' });
  RT.ids = ((list.body && list.body.items) || []).map(function (i) { return String(i.key); });
  return RT.ids.length >= 5 ? true : 'job.search: ' + long(list);
}, test.limit.quick);

// "ALL job id's will be routes": spirit.fs, spirit.app.<name>, never an invented number
test.run('no job id is a minted number, job_<n>', 0.2, function () {
  const minted = (RT.ids || []).filter(function (id) { return /^job_\d+$/.test(id); });
  return !minted.length ? true : minted.length + ' are: ' + long(minted);
}, test.limit.quick);
test.run('every job id is a route: spirit, then names, dot by dot', 0.2, function () {
  const ids = RT.ids || [];
  const notRoutes = ids.filter(function (id) { return !ROUTE.test(id); });
  return ids.length > 0 && !notRoutes.length ? true : 'not a route: ' + long(notRoutes);
}, test.limit.quick);
test.run('an app server\'s job is its route, spirit.app.desk', 0.2, function () {
  return (RT.ids || []).indexOf('spirit.app.desk') !== -1 ? true : 'ids: ' + long(RT.ids);
}, test.limit.quick);

// one job per family (Q1, Q2): the node's own jobs are spirit, spirit.fs, spirit.app, spirit.contact, spirit.auth
test.run('the node\'s own jobs are exactly spirit, spirit.app, spirit.auth, spirit.contact and spirit.fs: contacts, presence and peer search in one, the app list and app faces in one, stats and join steps under spirit', 0.2, async function () {
  RT.own = [];
  for (const id of RT.ids || []) {
    const g = await rask('job.get', { key: id });
    const job = (g.body && g.body.job) || {};
    // The node's own: its permanent jobs, never a server's or a process's run.
    if (job.kind === 'permanent') RT.own.push({ id: id, job: job });
  }
  RT.ownIds = RT.own.map(function (o) { return o.id; }).sort();
  return JSON.stringify(RT.ownIds) === JSON.stringify(OWN) ? true : 'the node\'s own jobs: ' + long(RT.ownIds);
}, test.limit.quick);
test.run('the node\'s own ids have at most two parts', 0.2, function () {
  const own = RT.own || [];
  return own.length > 0 && own.every(function (o) { return o.id.split('.').length <= 2; }) ? true : 'own: ' + long(RT.ownIds);
}, test.limit.quick);
test.run('a job has no type field any more: the id says what it is', 0.2, function () {
  const own = RT.own || [];
  const typed = own.filter(function (o) { return Object.prototype.hasOwnProperty.call(o.job, 'type'); });
  return own.length > 0 && !typed.length ? true : typed.length + ' still carry a type: ' + long(typed.map(function (o) { return o.id + ':' + o.job.type; }));
}, test.limit.quick);

// "only jobs in the app folder with node:run:true can be started with job.create"
test.run('another script, in no app folder, is refused', 0.8, async function () {
  plantApp(RT.run, 'zzRun', 4000, true);
  plantApp(RT.run, 'zzMount', 4000, false);
  fs.mkdirSync(path.join(RT.run, 'scratchScripts'), { recursive: true });
  fs.writeFileSync(path.join(RT.run, 'scratchScripts', 'zzOther.js'), 'setTimeout(function () {}, 100);\n');
  RT.runApp = path.join(RT.run, 'spirit', 'app', 'zzRun', 'zzRun.js');
  const other = await rask('job.create', { command: process.execPath, args: [path.join(RT.run, 'scratchScripts', 'zzOther.js')] });
  return other.status >= 400 ? true : 'job.create answered ' + long(other);
}, test.limit.quick);
test.run('an app\'s script whose json has no node run is refused', 0.8, async function () {
  const mount = await rask('job.create', { command: process.execPath, args: [path.join(RT.run, 'spirit', 'app', 'zzMount', 'zzMount.js')] });
  return mount.status >= 400 ? true : 'job.create answered ' + long(mount);
}, test.limit.quick);
test.run('another command is refused', 0.8, async function () {
  const command = await rask('job.create', { command: 'git', args: ['status'] });
  return command.status >= 400 ? true : 'job.create answered ' + long(command);
}, test.limit.quick);
test.run('a run app\'s own script starts, under its route spirit.app.zzRun', 0.2, async function () {
  const first = await rask('job.create', { command: process.execPath, args: [RT.runApp] });
  const firstId = first.body && (first.body.id || first.body.key);
  return first.status >= 200 && first.status < 300 && firstId === 'spirit.app.zzRun' ? true : 'job.create answered ' + long(first);
}, test.limit.quick);

// "a job cannot start if it is already running" (Q3), pending counting as running
test.run('a second start while it runs is refused, "already running"', 0.2, async function () {
  const second = await rask('job.create', { command: process.execPath, args: [RT.runApp] });
  return second.status >= 400 && /already running/.test(JSON.stringify(second.body || '')) ? true : 'job.create answered ' + long(second);
}, test.limit.quick);
test.run('two starts at once: one gets in, the other is refused (the pending one counts as running)', 0.2, async function () {
  await H.sleep(5000);
  const both = await Promise.all([rask('job.create', { command: process.execPath, args: [RT.runApp] }), rask('job.create', { command: process.execPath, args: [RT.runApp] })]);
  RT.taken = both.filter(function (r) { return r.status >= 200 && r.status < 300; });
  return RT.taken.length === 1 ? true : 'answers: ' + long(both.map(function (r) { return r.status; }));
}, test.limit.slow);

// "a new run takes the id over and runs on"
test.run('after its run ended, a new run is the same id, spirit.app.zzRun, running again', 0.2, async function () {
  const taken = RT.taken || [];
  const again = taken[0] ? (taken[0].body && (taken[0].body.id || taken[0].body.key)) : '';
  const g = await rask('job.get', { key: 'spirit.app.zzRun' });
  return again === 'spirit.app.zzRun' && ((g.body && g.body.job) || {}).status === 'running' ? true : 'id ' + long(again) + ', job ' + long(g.body);
}, test.limit.quick);

// THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
// the attacker: ten starts at once, and a start right after a cancel
test.run('ten starts at the same moment: exactly one gets in', 0.2, async function () {
  await H.sleep(4500);
  const ten = await Promise.all(Array.from({ length: 10 }, function () { return rask('job.create', { command: process.execPath, args: [RT.runApp] }); }));
  const tenIn = ten.filter(function (r) { return r.status >= 200 && r.status < 300; });
  return tenIn.length === 1 ? true : tenIn.length + ' got in: ' + long(ten.map(function (r) { return r.status; }));
}, test.limit.slow);
test.run('cancelled, its next start takes the same id over', 0.2, async function () {
  const cancelled = await rask('job.cancel', { id: 'spirit.app.zzRun' });
  await H.sleep(800);
  const afterCancel = await rask('job.create', { command: process.execPath, args: [RT.runApp] });
  await rask('job.cancel', { id: 'spirit.app.zzRun' });
  return cancelled.status >= 200 && cancelled.status < 300 && afterCancel.status >= 200 && afterCancel.status < 300 && (afterCancel.body || {}).id === 'spirit.app.zzRun' ? true
    : 'cancel ' + long(cancelled) + ', start ' + long(afterCancel);
}, test.limit.slow);

// the attacker: a run app's route reached by a crooked path, a link, a second script, a json that only looks right
test.run('all the crooked ones are refused', 0.8, async function () {
  const run = RT.run;
  const runApp = RT.runApp;
  const app = function (n) { return path.join(run, 'spirit', 'app', n); };
  // A second script in the run app's own folder (the box: "A second script in an app folder is therefore never started").
  fs.writeFileSync(path.join(app('zzRun'), 'other.js'), 'setTimeout(function () {}, 100);\n');
  // "run": "true", a string, not true.
  plantApp(run, 'zzString', 4000, false);
  fs.writeFileSync(path.join(app('zzString'), 'zzString.json'), JSON.stringify({ identity: { icon: '🧪', label: 'zzString', intrinsic: false }, node: { mount: false, run: 'true' } }));
  // A run app's script with no json beside it.
  fs.mkdirSync(app('zzBare'), { recursive: true });
  fs.writeFileSync(path.join(app('zzBare'), 'zzBare.js'), 'setTimeout(function () {}, 100);\n');
  // A link outside every app folder pointing at the run app's script, and the mount app reached through the run app's folder.
  const link = path.join(run, 'scratchScripts', 'zzLink.js');
  try { fs.symlinkSync(runApp, link); } catch (e) { /* no links here: the case is judged as not made */ }
  const crooked = [
    ['the mount app through the run app\'s folder (../)', [path.join(app('zzRun'), '..', 'zzMount', 'zzMount.js')]],
    ['a second script in the run app\'s folder', [path.join(app('zzRun'), 'other.js')]],
    ['an app whose json says run "true", a string', [path.join(app('zzString'), 'zzString.js')]],
    ['an app script with no json', [path.join(app('zzBare'), 'zzBare.js')]],
    ['a link elsewhere to the run app\'s script', [link]],
    ['the run app\'s script with a trailing slash', [runApp + '/']],
    ['no script at all', []],
  ];
  const gotIn = [];
  for (const c of crooked) {
    const r = await rask('job.create', { command: process.execPath, args: c[1] });
    if (!(r.status >= 400)) gotIn.push(c[0] + ': ' + r.status + ' ' + long((r.body || {}).id));
    if (r.body && r.body.id) await rask('job.cancel', { id: String(r.body.id) });
  }
  return !gotIn.length ? true : gotIn.length + ' got in: ' + long(gotIn);
}, test.limit.quick);
test.run('the run app\'s script under another command (/bin/sh) is refused', 0.8, async function () {
  const shell = await rask('job.create', { command: '/bin/sh', args: [RT.runApp] });
  return shell.status >= 400 ? true : 'job.create answered ' + long(shell);
}, test.limit.quick);

// the attacker: ids that are no route, asked of job.get and job.cancel
test.run('each is answered as no job, nothing found, nothing crashed', 0.2, async function () {
  const bad = ['..', '../spirit', '__proto__', 'constructor', 'spirit.app.', 'spirit..fs', 'spirit.fs/../..', '', 'job_1', 'spirit.app.zzRun.extra'];
  const crashed = [];
  for (const id of bad) {
    const a = await rask('job.get', { key: id });
    const b = await rask('job.cancel', { id: id });
    if (a.status === 0 || b.status === 0 || a.status >= 500 || b.status >= 500) crashed.push(id + ' ' + a.status + '/' + b.status);
    else if (a.status < 300 && a.body && a.body.job) crashed.push(id + ' found a job');
  }
  return !crashed.length ? true : long(crashed);
}, test.limit.quick);
test.run('and the node still answers after all of it', 0.2, async function () {
  const still = await rask('api', {});
  return still.status === 200 ? true : 'api answered ' + still.status;
}, test.limit.quick);

// ── THE STATE LAYOUT PART ──
// WHAT spirit/state/<name>/ HOLDS (goal/G43.20, its box; spec: ./job.md, its section).
// job.js makes each app's folder and starts its server. Andy: "WSL, YOU BETTER MAKE FUCKING SURE YOU GUARD FUCKING
// spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not fucking cheat with
// the fucking tests!!!!!!!!!!!!!!!!!!!!", "put those in spirit/state/<name>/ since they belong to the node.", "cache, which is
// written by spirit/appServer.js was ALWAYS supposed to go into spirit/state/<name>/cache/", "app data, which is written by
// the app, was ALWAYS supposed to go into spirit/state/<name>/data/". A real node on a scratch copy of the tracked files,
// with no run:/process folder in it, the tree's app servers switched on. Never a live node.

// What an app's folder of the node's state may hold (the box, "spirit/state/<name>/ holds node.json, cache/, data/, and on
// Linux door.sock"; Andy: "so far, so good.").
const MAY = ['node.json', 'cache', 'data'].concat(process.platform === 'win32' ? [] : ['door.sock']);
// The tree's app servers, each switched on: every app folder whose <name>.json says node.mount true, read from the folders
// (Andy: "where is the test that verifies that an app who claims to be mountable, ACTUALLY can be mounted?"), so a new one
// is judged the day it lands.
const APPS = path.join(REPO, 'spirit', 'run', 'spirit', 'app');
const SL = { servers: [] };
const sask = function (call, args) {
  return fetch(SL.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
};
const answersApi = function (name) {
  return H.until(function () { return sask('api', { family: name }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
};

// stateLayout: spirit/state/<name>/ holds node.json, cache/, data/ and door.sock, and nothing else; no relay-state, no process (goal/G43.20)
test.run('the world: the node starts on a tree with no run:/process folder', 0.2, async function () {
  if (RT.node) { LABH.freeTree(RT.node); RT.node = null; }
  SL.servers = fs.readdirSync(APPS).filter(function (n) {
    try { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return !!(j.node && j.node.mount === true); } catch (e) { return false; }
  });
  // A lab node's tree (goal/G47.3), its run:/process taken out before the node starts.
  SL.root = LABH.scratchTree().root;
  SL.run = path.join(SL.root, 'spirit', 'run');
  SL.state = path.join(SL.run, 'spirit', 'state');
  fs.rmSync(path.join(SL.run, 'process'), { recursive: true, force: true });
  fs.rmSync(path.join(SL.run, 'relay-state'), { recursive: true, force: true });
  SL.port = await H.freePort();
  SL.child = LABH.startNodeOn(SL.run, SL.port);
  SL.base = 'http://127.0.0.1:' + SL.port;
  const up = await H.until(function () { return sask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return up ? true : 'the node did not come up with no run:/process';
}, test.limit.slow);
test.after(async function () {
  try { if (SL.child) SL.child.kill(); } catch (e) { /* gone */ }
  await H.sleep(500);
  try { if (SL.root) LABH.freeTree(SL); } catch (e) { /* scratch */ }
});

// the node starts its apps with no process/ folder
test.run('the world: there are apps that say node.mount true', 0.2, async function () {
  for (const name of SL.servers) await sask('app.active', { key: name, active: true });
  return SL.servers.length >= 1 ? true : 'no app folder says node.mount true: nothing to judge';
}, test.limit.quick);
const mounts = async function (name) {
  if (SL.servers.indexOf(name) === -1) return name + ' says no node.mount true in its ' + name + '.json any more';
  return (await answersApi(name)) ? true : name + ' says node.mount true and never answered its api: ' + long(await sask('api', { family: name }));
};
test.run('agent says node.mount true, starts, and answers its api', 0.2, function () { return mounts('agent'); }, test.limit.quick);
test.run('backup says node.mount true, starts, and answers its api', 0.2, function () { return mounts('backup'); }, test.limit.quick);
test.run('chat says node.mount true, starts, and answers its api', 0.2, function () { return mounts('chat'); }, test.limit.quick);
test.run('desk says node.mount true, starts, and answers its api', 0.2, function () { return mounts('desk'); }, test.limit.quick);
test.run('deskClient says node.mount true, starts, and answers its api', 0.2, function () { return mounts('deskClient'); }, test.limit.quick);
const JUDGED = ['agent', 'backup', 'chat', 'desk', 'deskClient'];
test.run('every app that says node.mount true has a line of its own in this test', 0.2, async function () {
  const unjudged = SL.servers.filter(function (n) { return JUDGED.indexOf(n) === -1; });
  await H.sleep(3000);
  return !unjudged.length ? true : unjudged.map(function (n) { return n + ' has no line of its own in this test, so nothing judged it'; }).join('; ');
}, test.limit.slow);

// spirit/state/<name>/ holds node.json, cache/, data/ and on Linux door.sock, nothing else
const stateFolders = function () { return fs.readdirSync(SL.state).filter(function (n) { return fs.statSync(path.join(SL.state, n)).isDirectory(); }); };
test.run('the world: each app switched on has its folder in spirit/state/', 0.2, function () {
  const folders = stateFolders();
  return SL.servers.every(function (n) { return folders.indexOf(n) !== -1; }) ? true : 'folders: ' + long(folders);
}, test.limit.quick);
const holdsOnly = function (n) {
  if (!fs.existsSync(path.join(SL.state, n))) return 'spirit/state/' + n + '/ is not there';
  const extra = fs.readdirSync(path.join(SL.state, n)).filter(function (e) { return MAY.indexOf(e) === -1; });
  return !extra.length ? true : 'spirit/state/' + n + '/ also holds ' + long(extra);
};
// Each folder its own test, so each title is its own (they were one title said once per folder).
test.run('spirit/state/agent/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('agent'); }, test.limit.quick);
test.run('spirit/state/backup/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('backup'); }, test.limit.quick);
test.run('spirit/state/chat/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('chat'); }, test.limit.quick);
test.run('spirit/state/desk/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('desk'); }, test.limit.quick);
test.run('spirit/state/deskClient/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('deskClient'); }, test.limit.quick);
test.run('spirit/state/testicle/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () { return holdsOnly('testicle'); }, test.limit.quick);
const NAMED_FOLDERS = ['agent', 'backup', 'chat', 'desk', 'deskClient', 'testicle'];
test.run('every other folder of spirit/state/ holds only node.json, cache/, data/ and on Linux door.sock', 0.2, function () {
  const bad = stateFolders().filter(function (n) { return NAMED_FOLDERS.indexOf(n) === -1; }).map(holdsOnly).filter(function (v) { return v !== true; });
  return !bad.length ? true : bad.join('; ');
}, test.limit.quick);
// each app server's door
test.run('each app server\'s door.sock is spirit/state/<name>/door.sock', 0.2, function () {
  if (process.platform === 'win32') return true;
  const sockets = SL.servers.filter(function (n) { return fs.existsSync(path.join(SL.state, n, 'door.sock')); });
  return sockets.length === SL.servers.length ? true : 'sockets there: ' + long(sockets);
}, test.limit.quick);

// an app's data in spirit/state/<name>/data/: the folder the node hands it as --state
test.run('every server is handed spirit/state/<name>/data as its --state', 0.2, async function () {
  const handed = [];
  const list = await sask('job.search', { q: '' });
  for (const it of ((list.body && list.body.items) || [])) {
    const g = await sask('job.get', { key: it.key });
    const job = (g.body && g.body.job) || {};
    const args = (job.data && job.data.args) || job.args || [];
    const i = args.indexOf('--state');
    if (i !== -1) handed.push(path.relative(SL.run, String(args[i + 1])).split(path.sep).join('/'));
  }
  const wrong = handed.filter(function (p) { return !/^spirit\/state\/[^/]+\/data$/.test(p); });
  return handed.length >= SL.servers.length && !wrong.length ? true : 'handed: ' + long(handed);
}, test.limit.quick);

// no relay-state, no process: nothing of the node lives anywhere else
test.run('no spirit/run/relay-state/ is made', 0.2, function () {
  return !fs.existsSync(path.join(SL.run, 'relay-state')) ? true : 'the node made spirit/run/relay-state/: ' + long(fs.readdirSync(path.join(SL.run, 'relay-state')));
}, test.limit.quick);
test.run('no spirit/run/process/ is made', 0.2, function () {
  return !fs.existsSync(path.join(SL.run, 'process')) ? true : 'the node made spirit/run/process/';
}, test.limit.quick);

// THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code"): the
// layout must hold through what a node lives through, and no name may make a folder of the node's state elsewhere.
const layoutHolds = function (when) {
  const bad = [];
  stateFolders().forEach(function (n) {
    fs.readdirSync(path.join(SL.state, n)).filter(function (e) { return MAY.indexOf(e) === -1; }).forEach(function (e) { bad.push(n + '/' + e); });
  });
  if (fs.existsSync(path.join(SL.run, 'relay-state'))) bad.push('run:/relay-state');
  if (fs.existsSync(path.join(SL.run, 'process'))) bad.push('run:/process');
  return !bad.length ? true : when + ': out of place: ' + long(bad);
};
// the attacker: an app switched off and on again
test.run('backup switched off and on: the layout holds, nothing out of place', 0.2, async function () {
  await sask('app.active', { key: 'backup', active: false });
  await H.sleep(2000);
  await sask('app.active', { key: 'backup', active: true });
  await answersApi('backup');
  return layoutHolds('backup switched off and on');
}, test.limit.slow);

// the attacker: the node killed and started again on the same tree
test.run('the node comes back after a kill', 0.2, async function () {
  try { SL.child.kill('SIGKILL'); } catch (e) { /* gone */ }
  await H.sleep(1500);
  SL.child = LABH.startNodeOn(SL.run, SL.port);
  const back = await H.until(function () { return sask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return back ? true : 'the node did not come back';
}, test.limit.slow);
test.run('and every app server switched on starts again', 0.2, async function () {
  const again = [];
  for (const name of SL.servers) { if (await answersApi(name)) again.push(name); }
  return again.length === SL.servers.length ? true : 'answering after the restart: ' + long(again);
}, test.limit.quick);
test.run('after a kill and a restart: the layout holds, nothing out of place', 0.2, function () { return layoutHolds('after a kill and a restart'); }, test.limit.quick);

// the attacker: names that would put the node's state elsewhere
test.run('app.active refuses every name of no app', 0.2, async function () {
  const evil = ['..', '../..', 'relay-state', 'process', '../relay-state', 'desk/../../x', '.', '', 'con', 'desk/', 'a b', '__proto__'];
  const took = [];
  for (const k of evil) {
    const r = await sask('app.active', { key: k, active: true });
    if (r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false) took.push(k);
  }
  return !took.length ? true : 'taken: ' + long(took);
}, test.limit.quick);
test.run('and no folder appeared at the run root', 0.2, async function () {
  await H.sleep(2000);
  const outside = fs.readdirSync(SL.run).filter(function (n) { return ['relay-state', 'process', 'x'].indexOf(n) !== -1; });
  return !outside.length ? true : 'made: ' + long(outside);
}, test.limit.slow);
test.run('after the bad names: the layout holds, nothing out of place', 0.2, function () { return layoutHolds('after the bad names'); }, test.limit.quick);

// the attacker: an app's folder taken away while it runs
test.run('the node still answers with backup\'s folder gone under it', 0.2, async function () {
  fs.rmSync(path.join(SL.run, 'spirit', 'app', 'backup'), { recursive: true, force: true });
  await H.sleep(4000);
  const alive = await sask('api', {});
  return alive.status === 200 ? true : 'api answered ' + alive.status;
}, test.limit.slow);
test.run('backup\'s app folder gone: the layout holds, nothing out of place', 0.2, function () { return layoutHolds('backup\'s app folder gone'); }, test.limit.quick);

// ── THE VENDORED LIBRARIES PART ──
// NO run://node_modules/: chokidar and readdirp in spirit/job/ (goal/G43.25; spec: ./job.md, its section). Andy: "can we
// hide those suckers in spirit/jobs/ for now? without the damn node_modules container?". The two libraries sit in spirit/job/,
// job.js's own folder, and job.js is the user that brings them: they move whole, chokidar finds readdirp by path, job.js
// requires it by path, its fs-watcher job works as before, nothing names spirit/run/node_modules. deskClient's use is
// spirit/app/deskClient/test/deskClient.js, its chokidar part; fileSystem.js's one list of vendored folders is
// ./fileSystem.js, its vendoredFolders part. The tree read as it is; the watcher run in a child process on a scratch folder.

// The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
const BASE = '2fb29140';
const OLD = 'spirit/run/node_modules/';
const NEW = 'spirit/run/spirit/job/';
// The suites that name the old folder on purpose, left out of the scan (5): this one, job.js, and fileSystem's and
// deskClient's, by the names they had and the one test file each is folded into.
const SELF = /spirit\/run\/spirit\/test\/(job|job-vendoredLibraries|fileSystem|fileSystem-vendoredFolders)\.(js|md)$|spirit\/run\/spirit\/app\/deskClient\/test\/(deskClient|deskClient-chokidar)\.(js|md)$/;
function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
const VL = { tracked: [] };

// vendoredLibraries: chokidar and readdirp in spirit/job/, no run://node_modules (goal/G43.25)
// the world
test.run('the world: the base commit holds the 12 files of spirit/run/node_modules/ (chokidar and readdirp)', 0.2, function () {
  const before = git('ls-tree -r --name-only ' + BASE + ' -- ' + OLD).split('\n').filter(Boolean);
  return before.length === 12 && before.indexOf(OLD + 'chokidar/index.js') !== -1 && before.indexOf(OLD + 'readdirp/index.js') !== -1 ? true
    : BASE + ' holds ' + before.length + ' files there: nothing to compare with';
}, test.limit.quick);
test.run('the world: more than a hundred tracked files on disk are read', 0.2, function () {
  VL.tracked = git('ls-files').split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  return VL.tracked.length > 100 ? true : 'only ' + VL.tracked.length + ' tracked files read: nothing judged';
}, test.limit.quick);

// 1. both folders move whole to spirit/job/, spirit/run/node_modules/ is gone
// Each of the twelve written out, so that each check has a plain title of its own.
const movedWhole = function (rel) {
  const f = OLD + rel;
  const to = NEW + f.slice(OLD.length);
  const there = fs.existsSync(path.join(REPO, to)) && VL.tracked.indexOf(to) !== -1;
  if (!there) return to + ' is not there, in git';
  if (rel === 'chokidar/index.js') return true;
  const same = fs.readFileSync(path.join(REPO, to), 'latin1').replace(/\r\n/g, '\n') === execSync('git show ' + BASE + ':' + f, { cwd: REPO, maxBuffer: 1 << 26 }).toString('latin1').replace(/\r\n/g, '\n');
  return same ? true : to + ' differs from ' + f + ' at ' + BASE;
};
test.run('spirit/run/spirit/job/chokidar/LICENSE is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/LICENSE'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/README.md is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/README.md'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/handler.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/handler.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/handler.js is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/handler.js'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/index.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/index.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/index.js is there, in git (its one changed line judged under 2)', 0.2, function () { return movedWhole('chokidar/index.js'); }, test.limit.quick);
test.run('spirit/run/spirit/job/chokidar/package.json is there, in git, as it was', 0.2, function () { return movedWhole('chokidar/package.json'); }, test.limit.quick);
test.run('spirit/run/spirit/job/readdirp/LICENSE is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/LICENSE'); }, test.limit.quick);
test.run('spirit/run/spirit/job/readdirp/README.md is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/README.md'); }, test.limit.quick);
test.run('spirit/run/spirit/job/readdirp/index.d.ts is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/index.d.ts'); }, test.limit.quick);
test.run('spirit/run/spirit/job/readdirp/index.js is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/index.js'); }, test.limit.quick);
test.run('spirit/run/spirit/job/readdirp/package.json is there, in git, as it was', 0.2, function () { return movedWhole('readdirp/package.json'); }, test.limit.quick);
const keeps = function (n) {
  const dir = path.join(REPO, NEW, n);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return files.indexOf('package.json') !== -1 && files.some(function (x) { return /^licen[cs]e/i.test(x); }) ? true : 'spirit/job/' + n + '/ holds ' + long(files);
};
test.run('spirit/job/chokidar/ keeps its package.json and licence', 0.2, function () { return keeps('chokidar'); }, test.limit.quick);
test.run('spirit/job/readdirp/ keeps its package.json and licence', 0.2, function () { return keeps('readdirp'); }, test.limit.quick);
test.run('spirit/run/node_modules/ is gone from the disk', 0.2, function () {
  return !fs.existsSync(path.join(RUN, 'node_modules')) ? true : 'spirit/run/node_modules/ is still on the disk';
}, test.limit.quick);
test.run('no tracked file is left under spirit/run/node_modules/', 0.2, function () {
  const stillTracked = VL.tracked.filter(function (f) { return f.indexOf(OLD) === 0; });
  return !stillTracked.length ? true : stillTracked.length + ' still are: ' + long(stillTracked);
}, test.limit.quick);

// 2. chokidar finds readdirp by path, the one line changed in the library
const idxNew = path.join(REPO, NEW, 'chokidar', 'index.js');
test.run('the world: index.js:6 at the base commit imports readdirp by name', 0.2, function () {
  VL.now = fs.existsSync(idxNew) ? fs.readFileSync(idxNew, 'utf8').split(/\r?\n/) : [];
  VL.was = execSync('git show ' + BASE + ':' + OLD + 'chokidar/index.js', { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/);
  return !!/from\s+['"]readdirp['"]/.test(VL.was[5] || '') ? true : 'index.js:6 at ' + BASE + ' reads ' + long(VL.was[5]);
}, test.limit.quick);
test.run('spirit/job/chokidar/index.js:6 imports from "../readdirp/index.js"', 0.2, function () {
  const now = VL.now || [];
  return !!/from\s+['"]\.\.\/readdirp\/index\.js['"]/.test(now[5] || '') ? true : 'index.js:6 reads ' + long(now[5] || '(no file)');
}, test.limit.quick);
test.run('no other line of index.js changed', 0.2, function () {
  const now = VL.now || [];
  const was = VL.was || [];
  const differ = now.length ? was.map(function (l, i) { return l === now[i] ? -1 : i + 1; }).filter(function (i) { return i !== -1; }) : ['no file'];
  return now.length === was.length && differ.length === 1 && differ[0] === 6 ? true : 'lines changed: ' + long(differ) + ' (' + now.length + ' lines, were ' + was.length + ')';
}, test.limit.quick);
test.run('index.js names readdirp by name nowhere', 0.2, function () {
  const now = VL.now || [];
  return now.length && !now.some(function (l) { return !!/from\s+['"]readdirp['"]|require\(\s*['"]readdirp['"]\s*\)/.test(l); }) ? true
    : (now.length ? 'index.js still imports readdirp by name' : 'no spirit/job/chokidar/index.js to judge');
}, test.limit.quick);

// 3. the two users require it by path: job.js here, deskClient.js in its own test
test.run('spirit/run/spirit/job.js requires spirit/job/chokidar/index.js, which is spirit/job/chokidar/index.js', 0.2, function () {
  const u = 'spirit/run/spirit/job.js';
  const c = code(fs.readFileSync(path.join(REPO, u), 'utf8'));
  const specs = (c.match(/require\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); });
  let to = '';
  // goal/G43.32: loaded by spirit.require, by its run-root path ("spirit/jobs/chokidar/index.js"); a relative path is the old way.
  try { to = specs.length === 1 ? require.resolve(specs[0].charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, u)), specs[0]) : path.join(RUN, specs[0])) : ''; } catch (e) { to = ''; }
  return to === idxNew ? true : u + ' requires ' + long(specs) + ' (resolves to ' + long(to || 'nothing') + ')';
}, test.limit.quick);
test.run('nothing does require("chokidar") by name', 0.2, function () {
  const byName = VL.tracked.filter(function (f) { return /\.(js|mjs|cjs|html)$/.test(f) && !SELF.test(f) && f.indexOf(NEW + 'chokidar/') !== 0; })
    .filter(function (f) { return !!/require\(\s*['"]chokidar['"]\s*\)|from\s+['"]chokidar['"]|import\(\s*['"]chokidar['"]\s*\)/.test(code(fs.readFileSync(path.join(REPO, f), 'utf8'))); });
  return !byName.length ? true : byName.length + ' still do: ' + long(byName);
}, test.limit.quick);

// 4. the file watcher works as before
// Scratch folders inside spirit/run (scanFolder refuses anything outside it, as fsWatcherCommands.js says), removed after.
function child(src, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
  fs.rmSync(dir, { recursive: true, force: true });
  return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : '');
}
// The node's fs-watcher job (the Files tree and the spirit.fs events): a file made in its folder comes as a createFile.
test.run('the fs-watcher job hears a file made in its folder (createFile made.txt)', 0.2, function () {
  const jobsOut = child([
    "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job.js')) + ")(1);",
    "let job = null; jobs.events.on('job-updated', function (u) {",
    "  if (job && u.id === job.id && u.data && u.data.command && u.data.command.op === 'createFile' && u.data.command.path === 'made.txt') { console.log('HEARD'); process.exit(0); } });",
    "job = jobs.startFsWatcherJob(dir);",
    "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
    "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
  ].join('\n'), path.join(RUN, 'vendoredFolders-jobs-test'));
  return /^HEARD/.test(jobsOut) ? true : 'the fs-watcher job: ' + long(jobsOut);
}, test.limit.slow);

// THE CORE FLAG IS KEPT ON THE FILE LIST (goal/G47.1; Andy: "stick that flag on the fucking file list, then you have to
// check each file once with isCore()"): the tree sent to a page that connects reads nothing from disc. Asked on every
// send, it read an app's <name>.json once per file of that app, on the node's one thread (17 of 45 s on Andy's node).
// The fs-watcher job on this checkout's run folder; then the tree asked twice, every read of an app's json counted.
let treeSent = null;
test.run('the world: the fs-watcher job on the run folder, the tree asked twice, reads of the app jsons counted', 0.2, function () {
  // Not child(): it empties the folder it is given, and this one is the checkout's run folder, only read here.
  const run = function (src) { const r = spawnSync(process.execPath, ['-e', src, RUN], { cwd: RUN, encoding: 'utf8', timeout: 60000 }); return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : ''); };
  const out = run([
    "const fs = require('fs'), dir = process.argv[1];",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job.js')) + ")(1);",
    "const job = jobs.startFsWatcherJob(dir);",
    "const read = fs.readFileSync; let reads = 0;",
    "fs.readFileSync = function (f) { if (/[\\\\/]spirit[\\\\/]app[\\\\/][^\\\\/]+[\\\\/][^\\\\/]+\\.json$/.test(String(f))) reads += 1; return read.apply(fs, arguments); };",
    "const first = jobs.fsTreeCommands(); const second = jobs.fsTreeCommands();",
    "fs.readFileSync = read;",
    "const of = function (p) { return first.filter(function (c) { return c.path === p; })[0] || null; };",
    "console.log(JSON.stringify({ reads: reads, files: first.length, again: second.length, spirit: of('spirit/spirit.js'), noCore: of('spirit/app/icons/icons.js'), ownJson: of('spirit/app/icons/icons.json') }));",
    "job._stop(); process.exit(0);",
  ].join('\n'));
  try { treeSent = JSON.parse(String(out).trim().split('\n').pop()); } catch (e) { treeSent = null; }
  return (!!treeSent && treeSent.files > 100) || 'the tree: ' + long(out);
}, test.limit.slow);
test.run('the tree sent twice reads no app json from disc', 0.2, function () {
  if (!treeSent) return 'the tree was not read: the world failed';
  return treeSent.reads === 0 || treeSent.reads + ' reads of an app\'s json while ' + treeSent.files + ' files were sent twice';
}, test.limit.quick);
test.run('a core file comes with core: spirit/spirit.js', 0.2, function () {
  if (!treeSent) return 'the tree was not read: the world failed';
  return (!!treeSent.spirit && treeSent.spirit.core === true) || 'spirit/spirit.js: ' + long(treeSent.spirit);
}, test.limit.quick);
// coreFiles.js: an app's folder is core unless its <name>.json says intrinsic false, the json itself always core. icons says false.
test.run('a file of an app whose json says intrinsic false comes without core: spirit/app/icons/icons.js', 0.2, function () {
  if (!treeSent) return 'the tree was not read: the world failed';
  return (!!treeSent.noCore && treeSent.noCore.core === undefined) || 'spirit/app/icons/icons.js: ' + long(treeSent.noCore);
}, test.limit.quick);
test.run('and its own json comes with core: spirit/app/icons/icons.json', 0.2, function () {
  if (!treeSent) return 'the tree was not read: the world failed';
  return (!!treeSent.ownJson && treeSent.ownJson.core === true) || 'spirit/app/icons/icons.json: ' + long(treeSent.ownJson);
}, test.limit.quick);
// THE FLAG FOLLOWS AN APP'S <name>.json (goal/G47.1, cw's fix: "again only for an app's files when its <name>.json changes";
// Andy: "we need a red so no fool takes your fix out again"). On a scratch copy of the tracked run folder (job.js judges
// core files of the tree it sits in): a planted app zzKept, its json saying intrinsic false, its zzKept.js not core; the
// json changed to intrinsic true, its zzKept.js turns core, sent as a change; changed back, it is no longer core. The
// tree is never asked to read a json as it is sent.
let flagged = null;
test.run('the world: a scratch tree, an app zzKept whose json turns intrinsic true and back, its file\'s core flag read after each', 0.2, function () {
  const tree = LABH.scratchTree();
  const root = tree.root;
  try {
    const run = path.join(root, 'spirit', 'run');
    const app = path.join(run, 'spirit', 'app', 'zzKept');
    fs.mkdirSync(app, { recursive: true });
    const manifest = function (intrinsic) { return JSON.stringify({ identity: { icon: 'z', label: 'zzKept', intrinsic: intrinsic } }); };
    fs.writeFileSync(path.join(app, 'zzKept.json'), manifest(false));
    fs.writeFileSync(path.join(app, 'zzKept.js'), '\'use strict\';\n// zzKept\n');
    const src = [
      "const fs = require('fs'), path = require('path');",
      "const run = process.argv[1];",
      "const jobs = require(path.join(run, 'spirit', 'job.js'))(1);",
      "const job = jobs.startFsWatcherJob(run);",
      "const json = path.join(run, 'spirit', 'app', 'zzKept', 'zzKept.json');",
      "const core = function () { const c = jobs.fsTreeCommands().filter(function (x) { return x.path === 'spirit/app/zzKept/zzKept.js'; })[0]; return c ? c.core === true : null; };",
      "const wait = function (want, ms) { const end = Date.now() + ms; return new Promise(function (r) { (function tick() { const now = core(); if (now === want || Date.now() > end) return r(now); setTimeout(tick, 100); })(); }); };",
      "const out = { before: null, turned: null, back: null };",
      "setTimeout(async function () {",
      "  out.before = core();",
      "  fs.writeFileSync(json, " + JSON.stringify(manifest(true)) + ");",
      "  out.turned = await wait(true, 10000);",
      "  fs.writeFileSync(json, " + JSON.stringify(manifest(false)) + ");",
      "  out.back = await wait(false, 10000);",
      "  console.log(JSON.stringify(out));",
      "  try { job._stop(); } catch (e) {}",
      "  process.exit(0);",
      "}, 3000);",
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', src, run], { cwd: run, encoding: 'utf8', timeout: 60000 });
    try { flagged = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { flagged = null; }
    return !!flagged || 'the child said ' + long(r.stdout) + ' ' + long(r.stderr);
  } finally { LABH.freeTree(tree); }
}, test.limit.long);
test.run('an app\'s file whose json says intrinsic false comes without core: zzKept.js', 0.2, function () {
  if (!flagged) return 'the scratch tree was not watched: the world failed';
  return flagged.before === false || 'zzKept.js before: ' + long(flagged.before);
}, test.limit.quick);
test.run('its json changed to intrinsic true, its file comes with core', 0.2, function () {
  if (!flagged) return 'the scratch tree was not watched: the world failed';
  return flagged.turned === true || 'zzKept.js after intrinsic true: ' + long(flagged.turned);
}, test.limit.quick);
test.run('its json changed back to intrinsic false, its file comes without core again', 0.2, function () {
  if (!flagged) return 'the scratch tree was not watched: the world failed';
  return flagged.back === false || 'zzKept.js after intrinsic false again: ' + long(flagged.back);
}, test.limit.quick);

// 5. no file names spirit/run/node_modules any more
test.run('no tracked file names spirit/run/node_modules', 0.2, function () {
  VL.naming = VL.tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/brains/') !== 0 && !/\.(png|jpe?g|gif|ico|woff2?|ttf|zip|db)$/i.test(f); })
    .filter(function (f) { return /spirit\/run\/node_modules|!\/spirit\/run\/node_modules/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  return !VL.naming.length ? true : VL.naming.length + ' still do: ' + long(VL.naming);
}, test.limit.quick);
test.run('.gitignore holds no exception for spirit/run/node_modules', 0.2, function () {
  const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
  return !/run\/node_modules/.test(gi) ? true : '.gitignore still names it';
}, test.limit.quick);
const namesNoMore = function (f) {
  if (!VL.naming) return 'the tree was not read: the test before it failed';
  return VL.naming.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) ? true : f + (fs.existsSync(path.join(REPO, f)) ? ' still names it' : ' is not there to judge');
};
test.run('install/microscopic/create.js names spirit/run/node_modules no more', 0.2, function () { return namesNoMore('install/microscopic/create.js'); }, test.limit.quick);
test.run('install/chat-windows/create.js names spirit/run/node_modules no more', 0.2, function () { return namesNoMore('install/chat-windows/create.js'); }, test.limit.quick);
