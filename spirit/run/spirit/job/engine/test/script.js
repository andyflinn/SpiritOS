'use strict';

// spirit/run/spirit/job/engine/test/script.js
// The tests of spirit/job/engine/script.js, and of no other module, in this one file (spec: ./script.md). Its sections, after its own
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
const path = require('path');
const { spawn, execSync, spawnSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const REPO = path.resolve(RUN, '..', '..');
const test = SPIRIT.requireScript('spirit/testicle/testReport/script.js');
// IT EXPOSES AN OBJECT, NEVER A BARE FUNCTION (goal/G49.16, Andy: "A FUNCTION MUST ALWAYS BE INSTALLED INSIDE A CONTAINING
// OBJECT. PERIOD!"; box v4: "spirit/job/engine/script.js { installJobs }"): asked in a process of its own, spirit.requireScript answers an
// object holding installJobs, each a function.
test.run('spirit/job/engine/script.js exposes an object holding installJobs, never a bare function', 0.2, function () {
  const P = require('path');
  let run = __dirname;
  while (run !== P.dirname(run) && !require('fs').existsSync(P.join(run, 'spirit', 'script.js'))) run = P.dirname(run);
  const r = require('child_process').spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); let m = null; try { m = spirit.requireScript('spirit/job/engine/script.js'); } catch (e) { m = null; } process.stdout.write(JSON.stringify({ t: typeof m, k: ['installJobs'].map(function (k) { return m ? typeof m[k] : ''; }) }));"], { cwd: run, encoding: 'utf8', timeout: 20000 });
  let o = null; try { o = JSON.parse(r.stdout); } catch (e) { o = null; }
  return (!!o && o.t === 'object' && o.k.length === 1 && o.k.every(function (k) { return k === 'function'; })) || false;
}, test.limit.quick);
// ITS TEMP FOLDERS FROM THE ONE HELPER (goal/G47.1, the box: "nothing else builds a temp path"): one of its own for each
// it asks, under its suite's path, the whole of it removed when the suite ends.
const tempFolder = require('../../../tempFolder/script.js').tempFolder;
let tempAsked = 0;
function ownTemp(name) { tempAsked += 1; return tempFolder('spirit/test/job/' + name + tempAsked); }
test.after(function () { try { fs.rmSync(tempFolder.path('spirit/test/job'), { recursive: true, force: true }); } catch (e) { /* the OS clears temp */ } });
const H = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js');
const { scratchNode, sleep, until } = H;
// AN APP IS KNOWN BY ITS ID, ITS FOLDER'S PATH IN DOTS (goal/G49.19): spirit/app/zzserve is spirit.app.zzserve, its key, its
// branch in the api tree and the head of its calls.
const appId = function (name) { return SPIRIT.dottedPath('spirit/app/' + name); };
// THE JOB ASKS THE FS CACHE, NEVER THE DISC (goal/G49.19): an app planted while the node runs is started or switched only once
// the node's app list, read from that cache, holds its folder as an app, under its id.
function untilApp(base, name) {
  const id = appId(name);
  return until(function () {
    return fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.app.search', args: { q: '' } }) })
      .then(function (r) { return r.json(); }).then(function (b) { return !!(b && Array.isArray(b.items) && b.items.some(function (i) { return i.key === id; })); }, function () { return false; });
  }, 15000);
}

const WAIT_MS = 1500;
function stop(node) {
  try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
  try { if (node && node.root) LABH.freeTree(node); } catch (e) { /* scratch */ }
}

// ── spirit.job.create starts this node's processes, and no other program (goal/G41.30, RH1) ──
const J = {};
// spirit.job.create's args as the verb takes them since goal/G48.4: a list in a JSON string. Every helper below sends them so.
function asSent(verb, args) { const a = Object.assign({}, args || {}); if (verb === 'spirit.job.create' && Array.isArray(a.args)) a.args = JSON.stringify(a.args); return a; }
// ITS ARGS AS JSON IN A STRING (goal/G48.4, Q6, Andy: lists are "spirit/type/string/json/script.js"): a list handed here is sent as the
// verb takes it, so a start is refused or let in by job.js's own rules, never by the type of its args.
const call = async function (args) {
  const a = Object.assign({}, args);
  if (Array.isArray(a.args)) a.args = JSON.stringify(a.args);
  const r = await fetch(J.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'spirit.job.create', args: a }) });
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
  return { refused: a.status >= 400 && a.status < 500 && typeof a.code === 'string' && !!a.code, ran: ran };
};
const RC = {};
const refused = function (k) { return RC[k] ? (RC[k].refused ? true : false) : false; };
const neverRan = function (k) { return RC[k] ? (!RC[k].ran ? true : false) : false; };

// APPS OF ITS OWN (goal/G47.4; Andy: "you make bloody well sure that such stupid hard-coded tests move", of tests that took
// the tree's real apps as their fixtures): a permanent server, zzserve, and a one-shot app, zzshot (the box, 2: "a one-shot
// app is an app with api.js and data.js at its top, node mount false or missing"), planted in each scratch tree this test
// boots, so no app of the tree coming or going ever changes what it judges.
const PLANTED = {
  'zzserve/zzserve.json': JSON.stringify({ identity: { icon: 'Z', label: 'Zz Serve', intrinsic: false }, mount: { 'zzserve.js': true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }),
  'zzserve/zzserve.js': ["'use strict';", "require('../../script.js');", "spirit.requireScript('spirit/server/app/script.js').serve({ 'ping.get': { request: {}, reply: { ok: true }, handler: function () { return { ok: true }; } } });", ''].join('\n'),
  // goal/G49.23: a page reads the store at its place, spirit.client (no spirit.required).
  'zzserve/api.js': ["'use strict';", "if (typeof require === 'function') require('../../script.js').requireScript('spirit/app/zzserve/data.js'); else window.spirit.requireScript('spirit/app/zzserve/data.js');", "module.exports = { verbs: { 'ping.get': {} } };", ''].join('\n'),
  'zzserve/data.js': ["'use strict';", "(function family() { var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : window.spirit.client; if (!D) return; D.makeFamily('spirit.app.zzserve', function () { return {}; }); }());", ''].join('\n'),
  'zzshot/zzshot.json': JSON.stringify({ identity: { icon: 'Z', label: 'Zz Shot', intrinsic: false }, mount: { 'zzshot.js': true }, shell: { true: false, mount: false, tile: false }, node: { mount: false } }),
  'zzshot/zzshot.js': ["'use strict';", "require('../../script.js');", ''].join('\n'),
  'zzshot/api.js': ["'use strict';", "if (typeof require === 'function') require('../../script.js').requireScript('spirit/app/zzshot/data.js'); else window.spirit.requireScript('spirit/app/zzshot/data.js');", "module.exports = { verbs: { 'ping.get': {} } };", ''].join('\n'),
  'zzshot/data.js': ["'use strict';", "(function family() { var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : window.spirit.client; if (!D) return; D.makeFamily('spirit.app.zzshot', function () { return {}; }); }());", ''].join('\n'),
};
function plantApps(run) {
  Object.keys(PLANTED).forEach(function (rel) { const p = path.join(run, 'spirit', 'app', rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, PLANTED[rel]); });
}
test.run('a scratch node comes up with its planted server and one-shot app switched on at boot', 0.2, async function () {
  J.marks = ownTemp('spirit-jobs-marks-');
  // Its one-shot app switched on at boot beside its server, both planted in the scratch tree before the node starts.
  J.node = await scratchNode({ servers: ['spirit.app.zzserve', 'spirit.app.zzshot'], before: plantApps });
  if (!J.node.up) return false;
  J.run = path.join(J.node.root, 'spirit', 'run');
  return true;
}, test.limit.slow);
test.after(function () {
  stop(J.node);
  try { if (J.marks) fs.rmSync(J.marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// another program is refused, and never runs
test.run('/bin/sh with a command line is refused with a code', 0.8, async function () {
  RC.sh = await refusedCase('/bin/sh with a command line', mark('sh'), { command: '/bin/sh', args: ['-c', 'echo pwned > ' + mark('sh')] });
  return refused('sh');
}, test.limit.slow);
test.run('/bin/sh with a command line never ran', 0.8, function () { return neverRan('sh'); }, test.limit.quick);
test.run('sh, found on the path, is refused with a code', 0.8, async function () {
  RC.sh2 = await refusedCase('sh, found on the path', mark('sh2'), { command: 'sh', args: ['-c', 'echo pwned > ' + mark('sh2')] });
  return refused('sh2');
}, test.limit.slow);
test.run('sh, found on the path, never ran', 0.8, function () { return neverRan('sh2'); }, test.limit.quick);
test.run('this node\'s own executable given code to run with -e is refused with a code', 0.8, async function () {
  RC.dashE = await refusedCase('this node\'s own executable given code to run (-e)', mark('dashE'), { command: process.execPath, args: ['-e', script(mark('dashE'))] });
  return refused('dashE');
}, test.limit.slow);
test.run('this node\'s own executable given code to run with -e never ran', 0.8, function () { return neverRan('dashE'); }, test.limit.quick);

// this node's executable, on a script that is not its process, is refused
test.run('a script outside spirit/app is refused with a code', 0.8, async function () {
  const outside = path.join(J.marks, 'outside.js');
  fs.writeFileSync(outside, script(mark('outside')));
  RC.outside = await refusedCase('a script outside spirit/app', mark('outside'), { command: process.execPath, args: [outside] });
  return refused('outside');
}, test.limit.slow);
test.run('a script outside spirit/app never ran', 0.8, function () { return neverRan('outside'); }, test.limit.quick);
test.run('a path climbing out of spirit/app is refused with a code', 0.8, async function () {
  plant('zz-climbed.js', mark('climbed'));
  RC.climbed = await refusedCase('a path climbing out of spirit/app', mark('climbed'), { command: process.execPath, args: ['spirit/app/zzserve/../../../zz-climbed.js'] });
  return refused('climbed');
}, test.limit.slow);
test.run('a path climbing out of spirit/app never ran', 0.8, function () { return neverRan('climbed'); }, test.limit.quick);
test.run('an app whose json does not say node run true is refused with a code', 0.8, async function () {
  plant('spirit/app/zzNotRun/zzNotRun.js', mark('notRun'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzNotRun/zzNotRun.json'), JSON.stringify({ identity: { label: 'zz' } }));
  RC.notRun = await refusedCase('an app whose json does not say node run true', mark('notRun'), { command: process.execPath, args: ['spirit/app/zzNotRun/zzNotRun.js'] });
  return refused('notRun');
}, test.limit.slow);
test.run('an app whose json does not say node run true never ran', 0.8, function () { return neverRan('notRun'); }, test.limit.quick);

// what this node may start still starts
test.run('an app\'s own spirit/app/<name>/<name>.js, its json saying node run true, starts', 0.2, async function () {
  // An app's own script, of an app whose json says node run true: its job is its route, spirit.app.<name>.
  plant('spirit/app/zzRun/zzRun.js', mark('run'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzRun/zzRun.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
  await untilApp(J.node.base, 'zzRun');
  const inc = await call({ command: process.execPath, args: ['spirit/app/zzRun/zzRun.js'] });
  await sleep(WAIT_MS);
  return inc.status === 201 && fs.existsSync(mark('run')) ? true : false;
}, test.limit.slow);
// A PAGE SENDS PLAIN node (the app detail's run, spirit/element/search/app/detail/script.js:68): job.js reads it as this
// node's own executable. The run before has ended, so the id is free again.
test.run('plain node with a node run app starts, as Run sends it', 0.2, async function () {
  const plainNode = await call({ command: 'node', args: ['spirit/app/zzRun/zzRun.js'] });
  await sleep(WAIT_MS);
  return plainNode.status >= 200 && plainNode.status < 300 ? true : false;
}, test.limit.slow);
// A SECOND SCRIPT IN AN APP FOLDER IS NEVER STARTED (goal/G43.20, the box).
test.run('a second script in a node run app\'s folder is refused with a code', 0.8, async function () {
  const helper = plant('spirit/app/zzRun/zzHelper.js', mark('helper'));
  RC.helper = await refusedCase("a second script in a node run app's folder", mark('helper'), { command: process.execPath, args: [helper] });
  return refused('helper');
}, test.limit.slow);
test.run('a second script in a node run app\'s folder never ran', 0.8, function () { return neverRan('helper'); }, test.limit.quick);
// RH1 OPEN AGAIN (goal/G47.1, Andy's daily re-review): "A commit added a check that only looks at how the first argument
// ends, and anyone who can call jobs.create can get arbitrary code past it. The fix is to require that argument to be
// exactly the node's own spirit/server/app/script.js." Each first argument here ends in spirit/server/app/script.js and is not this
// node's own; the app after it is a real node run app, so only the first argument can refuse it.
const ownRunApp = function () {
  plant('spirit/app/zzRun/zzRun.js', mark('runAgain'));
  fs.writeFileSync(path.join(J.run, 'spirit/app/zzRun/zzRun.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
  return 'spirit/app/zzRun/zzRun.js';
};
test.run('a spirit/server/app/script.js outside this node\'s tree, given before a node run app, is refused with a code', 0.8, async function () {
  const fake = path.join(J.marks, 'elsewhere', 'spirit', 'appServer.js');
  fs.mkdirSync(path.dirname(fake), { recursive: true });
  fs.writeFileSync(fake, script(mark('fakeOutside')));
  RC.fakeOutside = await refusedCase('a spirit/server/app/script.js outside this node\'s tree', mark('fakeOutside'), { command: process.execPath, args: [fake, ownRunApp()] });
  return refused('fakeOutside');
}, test.limit.slow);
test.run('a spirit/server/app/script.js outside this node\'s tree, given before a node run app, never ran', 0.8, function () { return neverRan('fakeOutside'); }, test.limit.quick);
test.run('a spirit/server/app/script.js planted inside an app folder of this node, given before a node run app, is refused with a code', 0.8, async function () {
  const fake = plant('spirit/app/zzRun/spirit/server/app/script.js', mark('fakeInside'));
  RC.fakeInside = await refusedCase('a spirit/server/app/script.js planted inside an app folder', mark('fakeInside'), { command: process.execPath, args: [fake, ownRunApp()] });
  return refused('fakeInside');
}, test.limit.slow);
test.run('a spirit/server/app/script.js planted inside an app folder of this node, given before a node run app, never ran', 0.8, function () { return neverRan('fakeInside'); }, test.limit.quick);
// RH1 CARRIED OVER (goal/G48.5, the box: "the node starts a server process only as its own spirit/server/script.js, then --app, then
// the script; any other server.js as the first argument is refused", "the start check carries over exactly ... (RH1)").
test.run('this node\'s own spirit/server/script.js, then --app, then a node run app, starts', 0.8, async function () {
  const app = ownRunApp();
  const own = path.join(J.run, 'spirit', 'server', 'script.js');
  const r = await call({ command: process.execPath, args: [own, '--app', app] });
  await sleep(WAIT_MS);
  return (r.status === 201 && fs.existsSync(mark('runAgain'))) || false;
}, test.limit.slow);
test.run('a spirit/server/script.js outside this node\'s tree, then --app, then a node run app, is refused with a code', 0.8, async function () {
  const fake = path.join(J.marks, 'elsewhere2', 'spirit', 'server', 'script.js');
  fs.mkdirSync(path.dirname(fake), { recursive: true }); fs.writeFileSync(fake, script(mark('fakeServerOut')));
  RC.fakeServerOut = await refusedCase('a spirit/server/script.js outside this node\'s tree', mark('fakeServerOut'), { command: process.execPath, args: [fake, '--app', ownRunApp()] });
  return refused('fakeServerOut');
}, test.limit.slow);
test.run('a spirit/server/script.js outside this node\'s tree, then --app, then a node run app, never ran', 0.8, function () { return neverRan('fakeServerOut'); }, test.limit.quick);
test.run('a spirit/server/script.js planted inside an app folder of this node, then --app, then a node run app, is refused with a code', 0.8, async function () {
  const fake = plant('spirit/app/zzRun/spirit/server/script.js', mark('fakeServerIn'));
  RC.fakeServerIn = await refusedCase('a spirit/server/script.js planted inside an app folder', mark('fakeServerIn'), { command: process.execPath, args: [fake, '--app', ownRunApp()] });
  return refused('fakeServerIn');
}, test.limit.slow);
test.run('a spirit/server/script.js planted inside an app folder of this node, then --app, then a node run app, never ran', 0.8, function () { return neverRan('fakeServerIn'); }, test.limit.quick);

// GOAL/G41.33. THE BOX: "Console output goes to null by default, at the source, for every process. Only DEBUG turns it
// on. A crash is no exception: the exit code is enough to tell us to fix it, and we debug it by hand." Andy: "an
// appServer's should only write to stderr/stdout in DEBUG mode", "I WANT JUST THE structured json events." A job's log
// keeps what the node and the process's own published lines say. Andy, Q8, of the node and the relay themselves: "NOT the
// servers.", so only what they start is judged. scratchNode leaves DEBUG on, so each part sets it.
const door = async function (verb, args) {
  const r = await fetch(J.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: asSent(verb, args) }) });
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
  return { status: r.status, body: body, text: text };
};
// spirit.debug and spirit.publish, node.debug and event.publish before goal/G49.23 (box v22 Part 2).
const setDebug = async function (on) { const a = await door('spirit.debug', { debug: { on: on } }); return !!(a.body && a.body.debug === on); };
const noisy = function (name, tail) {
  const f = path.join(J.run, 'spirit', 'app', name, name + '.js');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, tail);
  fs.writeFileSync(path.join(J.run, 'spirit', 'app', name, name + '.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
};
const finished = async function (id) {
  let job = null;
  await until(function () { return door('spirit.job.get', { key: id }).then(function (a) { job = a.body && (a.body.job || a.body); return !!(job && job.status && job.status !== 'running' && job.status !== 'pending'); }); }, 15000);
  return job;
};
const logText = function (job) { return JSON.stringify((job && job.log) || []); };
const start = async function (name) {
  await untilApp(J.node.base, name);
  const a = await door('spirit.job.create', { command: process.execPath, args: ['spirit/app/' + name + '/' + name + '.js'] });
  return a.status === 201 && a.body && a.body.id ? a.body.id : '';
};
// A process job that completes deletes itself (job.js:120), so each here ends with an exit code of its own and stays to be read.
const PUBLISH = 'const u = process.env.SPIRIT_CALLBACK_URL, id = process.env.SPIRIT_JOB_ID;'
  + 'fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call: "spirit.publish", args: { id: id, logMessage: "zzPublishedLine" } }) })';

// goal/G41.33: DEBUG off, a process's console goes nowhere, and what is structured stays
test.run('the scratch node\'s DEBUG is switched off', 0.2, async function () {
  noisy('zzNoisy', 'console.log("zzOutLine"); console.error("zzErrLine"); process.stdout.write("zzRawOut\\n"); process.stderr.write("zzRawErr\\n");'
    + PUBLISH + '.then(function () { process.exit(5); }, function () { process.exit(3); });');
  noisy('zzCrash', 'console.log("zzBeforeCrash"); throw new Error("zzCrashLine");');
  noisy('zzFlood', 'const line = "zzFlood".repeat(1000) + "\\n"; let n = 0; (function more() { while (n < 3000) { n++; if (!process.stdout.write(line)) { process.stdout.once("drain", more); return; } } process.exit(7); }());');
  return (await setDebug(false)) ? true : false;
}, test.limit.quick);
test.run('a process that writes to its console starts', 0.2, async function () {
  J.id1 = await start('zzNoisy');
  if (!J.id1) return false;
  J.j1 = await finished(J.id1);
  J.said1 = logText(J.j1);
  return true;
}, test.limit.quick);
const noisyLog = function () { return J.said1 !== undefined; };
test.run('with DEBUG off, zzOutLine is not in the job\'s log', 0.2, function () { return noisyLog() && (!!J.j1 && J.said1.indexOf('zzOutLine') === -1 ? true : false); }, test.limit.quick);
test.run('with DEBUG off, zzErrLine is not in the job\'s log', 0.2, function () { return noisyLog() && (!!J.j1 && J.said1.indexOf('zzErrLine') === -1 ? true : false); }, test.limit.quick);
test.run('with DEBUG off, zzRawOut is not in the job\'s log', 0.2, function () { return noisyLog() && (!!J.j1 && J.said1.indexOf('zzRawOut') === -1 ? true : false); }, test.limit.quick);
test.run('with DEBUG off, zzRawErr is not in the job\'s log', 0.2, function () { return noisyLog() && (!!J.j1 && J.said1.indexOf('zzRawErr') === -1 ? true : false); }, test.limit.quick);
test.run('with DEBUG off, the node\'s own line stays in the job\'s log', 0.2, function () { return noisyLog() && (J.said1.indexOf('job created') !== -1 ? true : false); }, test.limit.quick);
test.run('with DEBUG off, a line the process published stays in the job\'s log', 0.2, function () { return noisyLog() && (J.said1.indexOf('zzPublishedLine') !== -1 ? true : false); }, test.limit.quick);
test.run('a process that crashes starts', 0.2, async function () {
  J.id2 = await start('zzCrash');
  if (!J.id2) return false;
  J.j2 = await finished(J.id2);
  J.said2 = logText(J.j2);
  return true;
}, test.limit.quick);
test.run('a crashed process is no exception: its console is not in the log either', 0.2, function () {
  if (J.said2 === undefined) return false;
  return !!J.j2 && J.said2.indexOf('zzCrashLine') === -1 && J.said2.indexOf('zzBeforeCrash') === -1 ? true : false;
}, test.limit.quick);
test.run('the crashed process\'s job says its non-zero exit code', 0.2, function () {
  const j = J.j2;
  return !!j && j.data && typeof j.data.exitCode === 'number' && j.data.exitCode !== 0 ? true : false;
}, test.limit.quick);
// The attacker's way to hang it: a process that floods its console with nobody reading.
test.run('a process that floods its console starts', 0.2, async function () {
  J.id3 = await start('zzFlood');
  return J.id3 ? true : false;
}, test.limit.quick);
test.run('the flooding process does not hang: it writes 3 MB and ends with its own exit code', 0.2, async function () {
  if (!J.id3) return false;
  const j = await finished(J.id3);
  return !!j && j.data && j.data.exitCode === 7 ? true : false;
}, test.limit.quick);

// goal/G41.33: only DEBUG turns it on
test.run('the scratch node\'s DEBUG is switched on', 0.2, async function () {
  return (await setDebug(true)) ? true : false;
}, test.limit.quick);
test.run('the same console-writing process starts again with DEBUG on', 0.2, async function () {
  J.id4 = await start('zzNoisy');
  if (!J.id4) return false;
  J.said4 = logText(await finished(J.id4));
  return true;
}, test.limit.quick);
test.run('with DEBUG on, zzOutLine is in the job\'s log', 0.2, function () {
  if (J.said4 === undefined) return false;
  return J.said4.indexOf('zzOutLine') !== -1 ? true : false;
}, test.limit.quick);
test.run('with DEBUG on, zzErrLine is in the job\'s log', 0.2, function () {
  if (J.said4 === undefined) return false;
  return J.said4.indexOf('zzErrLine') !== -1 ? true : false;
}, test.limit.quick);

// ── ONE-SHOT APPS, REGISTERED BY THE NODE (goal/G43.19, box v16) ──
// The box, 2: "a one-shot app is an app with api.js and data.js at its top, node mount false or missing, and switched
// on. icons is the first."; 4: "the node registers each one-shot app where it reads the manifests and starts the
// permanent ones ... Switched off, its row goes, and a call to it answers app-not-served". Each thing that would run
// writes a marker, so "it ran" is read from the disc.
// the box, 4: a one-shot app switched on at boot is registered with the permanent ones
const branches = async function () { const t = await door('api', {}); return t.status === 200 && t.body ? Object.keys(t.body) : []; };
test.run('the one-shot app\'s api.js names its verbs', 0.2, function () {
  J.iconVerbs = [];
  try { J.iconVerbs = Object.keys(require(path.join(J.run, 'spirit', 'app', 'zzshot', 'api.js')).verbs || {}); } catch (e) { J.iconVerbs = []; }
  return J.iconVerbs.length >= 1 ? true : false;
}, test.limit.quick);
test.run('the one-shot app, on in its node.json at boot, is in the api tree with no app.active asked', 0.2, async function () {
  return (await branches()).indexOf(appId('zzshot')) !== -1 ? true : false;
}, test.limit.quick);
test.run('the planted server, a permanent one, is in the api tree beside the one-shot app', 0.2, async function () {
  return (await branches()).indexOf(appId('zzserve')) !== -1 ? true : false;
}, test.limit.quick);

// the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"; on again, it is back
test.run('the one-shot app is switched off', 0.2, async function () {
  return (await door('spirit.app.active', { key: appId('zzshot'), active: false })).status === 200 ? true : false;
}, test.limit.quick);
test.run('switched off, a call to the one-shot app answers app-not-served', 0.2, async function () {
  await sleep(WAIT_MS);
  const offCall = J.iconVerbs && J.iconVerbs.length ? await door(appId('zzshot') + '.' + J.iconVerbs[0], {}) : { text: '' };
  return /app-not-served/.test(offCall.text) ? true : false;
}, test.limit.slow);
test.run('switched off, the one-shot app is not in the api tree', 0.2, async function () {
  return (await branches()).indexOf(appId('zzshot')) === -1 ? true : false;
}, test.limit.quick);
test.run('the one-shot app is switched on again', 0.2, async function () {
  return (await door('spirit.app.active', { key: appId('zzshot'), active: true })).status === 200 ? true : false;
}, test.limit.quick);
test.run('switched on again, the one-shot app is back in the tree, no restart of the node', 0.2, async function () {
  return (await until(function () { return branches().then(function (b) { return b.indexOf(appId('zzshot')) !== -1; }); }, 10000)) ? true : false;
}, test.limit.quick);

// the box, 2: "node mount false or missing": a one-shot app's json with no node part is still one-shot
test.run('with node mount missing, the one-shot app is served', 0.2, async function () {
  const shotJson = path.join(J.run, 'spirit', 'app', 'zzshot', 'zzshot.json');
  const kept = fs.readFileSync(shotJson, 'utf8');
  const noNode = JSON.parse(kept); delete noNode.node;
  fs.writeFileSync(shotJson, JSON.stringify(noNode, null, 2));
  try {
    await door('spirit.app.active', { key: appId('zzshot'), active: false });
    await sleep(WAIT_MS);
    await door('spirit.app.active', { key: appId('zzshot'), active: true });
    return (await until(function () { return branches().then(function (b) { return b.indexOf(appId('zzshot')) !== -1; }); }, 10000)) ? true : false;
  } finally { fs.writeFileSync(shotJson, kept); }
}, test.limit.slow);

// the attacker: what is not a one-shot app is never run as one
const notOneShot = async function (name, files) {
  const dir = path.join(J.run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  plant('spirit/app/' + name + '/' + name + '.js', mark(name));
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { label: name, intrinsic: false }, shell: { true: false, mount: true, tile: true }, node: files.nodeMount === undefined ? { mount: false } : { mount: files.nodeMount } }));
  if (files.api) fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { zz: {} } };\n');
  if (files.data) fs.writeFileSync(path.join(dir, 'data.js'), '');
  await untilApp(J.node.base, name);
  if (files.on !== false) await door('spirit.app.active', { key: appId(name), active: true });
  await sleep(WAIT_MS);
  const c = await door(appId(name) + '.zz', {});
  await door('api', {});
  await sleep(WAIT_MS);
  const served = !/^2/.test(String(c.status)) && (await branches()).indexOf(appId(name)) === -1;
  return { notServed: served, neverRan: !fs.existsSync(mark(name)) };
};
const NO = {};
const notServed = function (k) { return NO[k] ? (NO[k].notServed ? true : false) : false; };
const scriptNeverRan = function (k) { return NO[k] ? (NO[k].neverRan ? true : false) : false; };
test.run('an app with api.js and no data.js is not served', 0.2, async function () {
  NO.noData = await notOneShot('zzNoData', { api: true, data: false });
  return notServed('noData');
}, test.limit.slow);
test.run('the script of an app with api.js and no data.js never ran', 0.8, function () { return scriptNeverRan('noData'); }, test.limit.quick);
test.run('an app with data.js and no api.js is not served', 0.2, async function () {
  NO.noApi = await notOneShot('zzNoApi', { api: false, data: true });
  return notServed('noApi');
}, test.limit.slow);
test.run('the script of an app with data.js and no api.js never ran', 0.8, function () { return scriptNeverRan('noApi'); }, test.limit.quick);
test.run('an app with both api.js and data.js, never switched on, is not served', 0.2, async function () {
  NO.off = await notOneShot('zzOff', { api: true, data: true, on: false });
  return notServed('off');
}, test.limit.slow);
test.run('the script of an app with both api.js and data.js, never switched on, never ran', 0.8, function () { return scriptNeverRan('off'); }, test.limit.quick);

// The sections below, each folded in from a file of its own, run in order after the checks above.

// ── THE ROUTES PART ──
// A JOB'S ID IS A ROUTE (goal/G43.20, its box; spec: ./script.md, its section). Andy: "they're
// supposed to identify a "route" in the spirit-tree, NOT some invented number.", "ALL job id's will be routes to either a
// node supplied api (spirit.fs, etc...) or an app supplied id (spirit.app.<name>)", "a job cannot start if it is already
// running", and "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". A real node on
// a scratch copy of the tracked files; throwaway apps are planted in that copy, nothing kept in the repo. Never a live node.
const ROUTE = /^spirit(\.[A-Za-z][A-Za-z0-9]*)*$/;
// The node's own jobs, once each (Q1, Q2 and the box): the node's events, its files, its apps, its contacts, and its auth
// tables, each a branch of its own since goal/G49.21 (box v24: the grant, bundle and branch tables each "a new branch", their
// news on spirit.grant, spirit.bundle and spirit.branch; spirit.auth is gone).
const OWN = ['spirit', 'spirit.app', 'spirit.branch', 'spirit.bundle', 'spirit.contact', 'spirit.fs', 'spirit.grant'];
// A throwaway app of spirit/app/<name>/: its script waits ms and ends; run true makes it a run app (node run true).
function plantApp(run, name, ms, nodeRun) {
  const dir = path.join(run, 'spirit', 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { icon: '🧪', label: name, intrinsic: false }, node: nodeRun ? { mount: false, run: true } : { mount: false } }));
  fs.writeFileSync(path.join(dir, name + '.js'), 'setTimeout(function () {}, ' + ms + ');\n');
}
const RT = {};
const rask = function (call, args) {
  return fetch(RT.node.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: asSent(call, args) }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function () { return { status: 0, body: null }; });
};

// routes: every job id is a route in the spirit tree, one job per id, and spirit.job.create starts only a run app (goal/G43.20)
test.run('the scratch node for the job routes comes up', 0.2, async function () {
  stop(J.node); J.node = null;
  RT.node = await H.scratchNode({ before: plantApps });
  if (!RT.node.up) return false;
  RT.run = path.join(RT.node.root, 'spirit', 'run');
  return true;
}, test.limit.slow);
test.after(function () { if (RT.node && RT.node.child) RT.node.child.kill(); });
test.run('the planted app server is switched on', 0.2, async function () {
  const on = await rask('spirit.app.active', { key: appId('zzserve'), active: true });
  await H.sleep(5000);
  return on.status === 200 ? true : false;
}, test.limit.slow);
test.run('the node lists five or more jobs', 0.2, async function () {
  const list = await rask('spirit.job.search', { q: '' });
  RT.ids = ((list.body && list.body.items) || []).map(function (i) { return String(i.key); });
  return RT.ids.length >= 5 ? true : false;
}, test.limit.quick);

// "ALL job id's will be routes": spirit.fs, spirit.app.<name>, never an invented number
test.run('no job id is a minted number such as job_<n>', 0.2, function () {
  const minted = (RT.ids || []).filter(function (id) { return /^job_\d+$/.test(id); });
  return !minted.length ? true : false;
}, test.limit.quick);
test.run('every job id is a route, spirit followed by names joined by dots', 0.2, function () {
  const ids = RT.ids || [];
  const notRoutes = ids.filter(function (id) { return !ROUTE.test(id); });
  return ids.length > 0 && !notRoutes.length ? true : false;
}, test.limit.quick);
test.run('the planted app server\'s job id is its route, spirit.app.zzserve', 0.2, function () {
  return (RT.ids || []).indexOf('spirit.app.zzserve') !== -1 ? true : false;
}, test.limit.quick);

// one job per family (Q1, Q2): the node's own jobs, OWN above
test.run('the node\'s own jobs are exactly spirit, spirit.app, spirit.branch, spirit.bundle, spirit.contact, spirit.fs and spirit.grant', 0.2, async function () {
  RT.own = [];
  for (const id of RT.ids || []) {
    const g = await rask('spirit.job.get', { key: id });
    const job = (g.body && g.body.job) || {};
    // The node's own: its permanent jobs, never a server's or a process's run.
    if (job.kind === 'permanent') RT.own.push({ id: id, job: job });
  }
  RT.ownIds = RT.own.map(function (o) { return o.id; }).sort();
  return JSON.stringify(RT.ownIds) === JSON.stringify(OWN) ? true : false;
}, test.limit.quick);
test.run('the node\'s own ids have at most two parts', 0.2, function () {
  const own = RT.own || [];
  return own.length > 0 && own.every(function (o) { return o.id.split('.').length <= 2; }) ? true : false;
}, test.limit.quick);
test.run('a job has no type field any more: the id says what it is', 0.2, function () {
  const own = RT.own || [];
  const typed = own.filter(function (o) { return Object.prototype.hasOwnProperty.call(o.job, 'type'); });
  return own.length > 0 && !typed.length ? true : false;
}, test.limit.quick);

// "only jobs in the app folder with node:run:true can be started with spirit.job.create"
test.run('another script, in no app folder, is refused', 0.8, async function () {
  plantApp(RT.run, 'zzRun', 4000, true);
  plantApp(RT.run, 'zzMount', 4000, false);
  fs.mkdirSync(path.join(RT.run, 'scratchScripts'), { recursive: true });
  fs.writeFileSync(path.join(RT.run, 'scratchScripts', 'zzOther.js'), 'setTimeout(function () {}, 100);\n');
  RT.runApp = path.join(RT.run, 'spirit', 'app', 'zzRun', 'zzRun.js');
  await untilApp(RT.node.base, 'zzRun'); await untilApp(RT.node.base, 'zzMount');
  const other = await rask('spirit.job.create', { command: process.execPath, args: [path.join(RT.run, 'scratchScripts', 'zzOther.js')] });
  return other.status >= 400 ? true : false;
}, test.limit.quick);
test.run('an app\'s script whose json has no node run is refused', 0.8, async function () {
  const mount = await rask('spirit.job.create', { command: process.execPath, args: [path.join(RT.run, 'spirit', 'app', 'zzMount', 'zzMount.js')] });
  return mount.status >= 400 ? true : false;
}, test.limit.quick);
test.run('another command is refused', 0.8, async function () {
  const command = await rask('spirit.job.create', { command: 'git', args: ['status'] });
  return command.status >= 400 ? true : false;
}, test.limit.quick);
test.run('a run app\'s own script starts, under its route spirit.app.zzRun', 0.2, async function () {
  const first = await rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] });
  const firstId = first.body && (first.body.id || first.body.key);
  return first.status >= 200 && first.status < 300 && firstId === 'spirit.app.zzRun' ? true : false;
}, test.limit.quick);

// "a job cannot start if it is already running" (Q3), pending counting as running
test.run('a second start while it runs is refused, "already running"', 0.2, async function () {
  const second = await rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] });
  return second.status >= 400 && /already running/.test(JSON.stringify(second.body || '')) ? true : false;
}, test.limit.quick);
test.run('two starts at once: one gets in, the other is refused (the pending one counts as running)', 0.2, async function () {
  await H.sleep(5000);
  const both = await Promise.all([rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] }), rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] })]);
  RT.taken = both.filter(function (r) { return r.status >= 200 && r.status < 300; });
  return RT.taken.length === 1 ? true : false;
}, test.limit.slow);

// "a new run takes the id over and runs on"
test.run('after its run ended, a new run is the same id, spirit.app.zzRun, running again', 0.2, async function () {
  const taken = RT.taken || [];
  const again = taken[0] ? (taken[0].body && (taken[0].body.id || taken[0].body.key)) : '';
  const g = await rask('spirit.job.get', { key: 'spirit.app.zzRun' });
  return again === 'spirit.app.zzRun' && ((g.body && g.body.job) || {}).status === 'running' ? true : false;
}, test.limit.quick);

// THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
// the attacker: ten starts at once, and a start right after a cancel
test.run('ten starts at the same moment: exactly one gets in', 0.2, async function () {
  await H.sleep(4500);
  const ten = await Promise.all(Array.from({ length: 10 }, function () { return rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] }); }));
  const tenIn = ten.filter(function (r) { return r.status >= 200 && r.status < 300; });
  return tenIn.length === 1 ? true : false;
}, test.limit.slow);
test.run('a cancelled run app\'s next start takes the same id over', 0.2, async function () {
  const cancelled = await rask('spirit.job.cancel', { id: 'spirit.app.zzRun' });
  await H.sleep(800);
  const afterCancel = await rask('spirit.job.create', { command: process.execPath, args: [RT.runApp] });
  await rask('spirit.job.cancel', { id: 'spirit.app.zzRun' });
  return cancelled.status >= 200 && cancelled.status < 300 && afterCancel.status >= 200 && afterCancel.status < 300 && (afterCancel.body || {}).id === 'spirit.app.zzRun' ? true : false;
}, test.limit.slow);

// the attacker: a run app's route reached by a crooked path, a link, a second script, a json that only looks right
test.run('every crooked way to a run app\'s route is refused', 0.8, async function () {
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
  await untilApp(RT.node.base, 'zzString');
  // A link outside every app folder pointing at the run app's script, and the mount app reached through the run app's folder.
  const link = path.join(run, 'scratchScripts', 'zzLink.js');
  try { fs.symlinkSync(runApp, link); } catch (e) { /* no links here: the case is judged as not made */ }
  // The mount app through the run app's folder (../), a second script in the run app's folder, an app whose json says
  // run "true", a string, an app script with no json, a link elsewhere to the run app's script, the run app's script with
  // a trailing slash, no script at all.
  const crooked = [
    [path.join(app('zzRun'), '..', 'zzMount', 'zzMount.js')],
    [path.join(app('zzRun'), 'other.js')],
    [path.join(app('zzString'), 'zzString.js')],
    [path.join(app('zzBare'), 'zzBare.js')],
    [link],
    [runApp + '/'],
    [],
  ];
  let gotIn = 0;
  for (const c of crooked) {
    const r = await rask('spirit.job.create', { command: process.execPath, args: c });
    if (!(r.status >= 400)) gotIn++;
    if (r.body && r.body.id) await rask('spirit.job.cancel', { id: String(r.body.id) });
  }
  return !gotIn ? true : false;
}, test.limit.quick);
test.run('the run app\'s script under another command (/bin/sh) is refused', 0.8, async function () {
  const shell = await rask('spirit.job.create', { command: '/bin/sh', args: [RT.runApp] });
  return shell.status >= 400 ? true : false;
}, test.limit.quick);

// the attacker: ids that are no route, asked of spirit.job.get and spirit.job.cancel
test.run('every id that is no route is answered as no job, with nothing found and nothing crashed', 0.2, async function () {
  const bad = ['..', '../spirit', '__proto__', 'constructor', 'spirit.app.', 'spirit..fs', 'spirit.fs/../..', '', 'job_1', 'spirit.app.zzRun.extra'];
  const crashed = [];
  for (const id of bad) {
    const a = await rask('spirit.job.get', { key: id });
    const b = await rask('spirit.job.cancel', { id: id });
    if (a.status === 0 || b.status === 0 || a.status >= 500 || b.status >= 500) crashed.push(id);
    else if (a.status < 300 && a.body && a.body.job) crashed.push(id);
  }
  return !crashed.length ? true : false;
}, test.limit.quick);
test.run('the node still answers after all the crooked starts and ids', 0.2, async function () {
  const still = await rask('api', {});
  return still.status === 200 ? true : false;
}, test.limit.quick);

// ── THE STATE LAYOUT PART ──
// WHAT spirit/state/<name>/ HOLDS (goal/G43.20, its box; spec: ./script.md, its section).
// job.js makes each app's folder and starts its server. Andy: "WSL, YOU BETTER MAKE FUCKING SURE YOU GUARD FUCKING
// spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not fucking cheat with
// the fucking tests!!!!!!!!!!!!!!!!!!!!", "put those in spirit/state/<name>/ since they belong to the node.", "cache, which is
// written by spirit/server/app/script.js was ALWAYS supposed to go into spirit/state/<name>/cache/", "app data, which is written by
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
  return fetch(SL.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
    .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function () { return { status: 0, body: null }; });
};
const answersApi = function (name) {
  return H.until(function () { return sask('api', { branch: appId(name) }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
};

// stateLayout: spirit/state/app/<name>/ (spirit.statePath, goal/G49.17) holds node.json, cache/, data/ and door.sock, and nothing else; no relay-state, no process (goal/G43.20)
test.run('the node starts on a tree with no run:/process folder', 0.2, async function () {
  if (RT.node) { LABH.freeTree(RT.node); RT.node = null; }
  SL.servers = fs.readdirSync(APPS).filter(function (n) {
    try { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return !!(j.node && j.node.mount === true); } catch (e) { return false; }
  });
  // A lab node's tree (goal/G47.3), its run:/process taken out before the node starts.
  SL.root = LABH.scratchTree().root;
  SL.run = path.join(SL.root, 'spirit', 'run');
  SL.state = path.join(SL.run, 'spirit', 'state');
  // The apps' state folders, by the formula (goal/G49.17): spirit.statePath('spirit/app/<name>') is spirit/state/app/<name>.
  SL.apps = path.join(SL.state, 'app');
  fs.rmSync(path.join(SL.run, 'process'), { recursive: true, force: true });
  fs.rmSync(path.join(SL.run, 'relay-state'), { recursive: true, force: true });
  SL.port = await H.freePort();
  SL.child = LABH.startNodeOn(SL.run, SL.port);
  SL.base = 'http://127.0.0.1:' + SL.port;
  const up = await H.until(function () { return sask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return up ? true : false;
}, test.limit.slow);
test.after(async function () {
  try { if (SL.child) SL.child.kill(); } catch (e) { /* gone */ }
  await H.sleep(500);
  try { if (SL.root) LABH.freeTree(SL); } catch (e) { /* scratch */ }
});

// the node starts its apps with no process/ folder
test.run('there are apps that say node.mount true', 0.2, async function () {
  for (const name of SL.servers) await sask('spirit.app.active', { key: appId(name), active: true });
  return SL.servers.length >= 1 ? true : false;
}, test.limit.quick);
// EACH APP SERVER STARTS AND ANSWERS ITS INTERFACE, AND ITS STATE FOLDER HOLDS ONLY WHAT IT MAY: rules about each app, so they
// are judged per app from its own manifest in spirit/test/app-child-browser.js (goal/G47.4; Andy: "you make bloody well sure
// that such stupid hard-coded tests move to app-child-* immediately"). This file keeps what is about the job system.

// spirit/state/app/<name>/ holds node.json, cache/, data/ and on Linux door.sock, nothing else
const stateFolders = function () { if (!fs.existsSync(SL.apps)) return []; return fs.readdirSync(SL.apps).filter(function (n) { return fs.statSync(path.join(SL.apps, n)).isDirectory(); }); };
test.run('each app switched on has its folder in spirit/state/app/', 0.2, function () {
  const folders = stateFolders();
  return SL.servers.every(function (n) { return folders.indexOf(n) !== -1; }) ? true : false;
}, test.limit.quick);
// each app server's door
// ONE RED PER APP SERVER (goal/G47.6, box: "the job test checks each app server's door inside test.forScript for that app
// server ... The key then names the item that failed; the title stays the same and greppable."): each app server's check
// is reported for its own script, spirit/app/<name>/<name>.js, so a red names the server whose door is missing. It waits
// for the socket (the review: "On a lab node the socket was missing at 0 ms and present at 1,000 ms").
// The servers are read here, as the suite loads, so each has its test before the run starts; SL.servers, read in the test
// above, is the same list.
const MOUNTED = fs.readdirSync(APPS).filter(function (n) {
  try { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return !!(j.node && j.node.mount === true); } catch (e) { return false; }
});
MOUNTED.forEach(function (n) {
  test.forScript('spirit/app/' + n + '/' + n + '.js', function () {
    test.run('each app server\'s door.sock is spirit/state/app/<name>/door.sock', 0.2, async function () {
      if (process.platform === 'win32') return true;
      if (!SL.state) return false;
      return (await H.until(function () { return Promise.resolve(fs.existsSync(path.join(SL.apps, n, 'door.sock'))); }, 10000)) ? true : false;
    }, test.limit.quick);
  });
});

// an app's data in spirit/state/app/<name>/data/: the folder the node hands it as --state
test.run('every server is handed spirit/state/app/<name>/data as its --state', 0.2, async function () {
  const handed = [];
  const list = await sask('spirit.job.search', { q: '' });
  for (const it of ((list.body && list.body.items) || [])) {
    const g = await sask('spirit.job.get', { key: it.key });
    const job = (g.body && g.body.job) || {};
    const args = (job.data && job.data.args) || job.args || [];
    const i = args.indexOf('--state');
    if (i !== -1) handed.push(path.relative(SL.run, String(args[i + 1])).split(path.sep).join('/'));
  }
  const wrong = handed.filter(function (p) { return !/^spirit\/state\/app\/[^/]+\/data$/.test(p); });
  return handed.length >= SL.servers.length && !wrong.length ? true : false;
}, test.limit.quick);

// no relay-state, no process: nothing of the node lives anywhere else
test.run('no spirit/run/relay-state/ is made', 0.2, function () {
  return !fs.existsSync(path.join(SL.run, 'relay-state')) ? true : false;
}, test.limit.quick);
test.run('no spirit/run/process/ is made', 0.2, function () {
  return !fs.existsSync(path.join(SL.run, 'process')) ? true : false;
}, test.limit.quick);

// THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code"): the
// layout must hold through what a node lives through, and no name may make a folder of the node's state elsewhere.
const layoutHolds = function () {
  let bad = 0;
  stateFolders().forEach(function (n) {
    bad += fs.readdirSync(path.join(SL.apps, n)).filter(function (e) { return MAY.indexOf(e) === -1; }).length;
  });
  // No app keeps a folder at the old place, spirit/state/<name>/ (goal/G49.17).
  SL.servers.forEach(function (n) { if (fs.existsSync(path.join(SL.state, n))) bad++; });
  if (fs.existsSync(path.join(SL.run, 'relay-state'))) bad++;
  if (fs.existsSync(path.join(SL.run, 'process'))) bad++;
  return !bad ? true : false;
};
// the attacker: an app switched off and on again
// The attacked server is the first the tree's manifests give (SL.servers), so no app is named here.
test.run('after an app server is switched off and on, the state layout holds with nothing out of place', 0.2, async function () {
  const one = SL.servers[0];
  if (!one) return false;
  await sask('spirit.app.active', { key: appId(one), active: false });
  await H.sleep(2000);
  await sask('spirit.app.active', { key: appId(one), active: true });
  await answersApi(one);
  return layoutHolds();
}, test.limit.slow);

// the attacker: the node killed and started again on the same tree
test.run('the node comes back after a kill', 0.2, async function () {
  try { SL.child.kill('SIGKILL'); } catch (e) { /* gone */ }
  await H.sleep(1500);
  SL.child = LABH.startNodeOn(SL.run, SL.port);
  const back = await H.until(function () { return sask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
  return back ? true : false;
}, test.limit.slow);
test.run('every switched-on app server starts again after the kill', 0.2, async function () {
  const again = [];
  for (const name of SL.servers) { if (await answersApi(name)) again.push(name); }
  return again.length === SL.servers.length ? true : false;
}, test.limit.quick);
test.run('after a kill and a restart, the state layout holds with nothing out of place', 0.2, function () { return layoutHolds(); }, test.limit.quick);

// the attacker: names that would put the node's state elsewhere
test.run('app.active refuses every name of no app', 0.2, async function () {
  const evil = ['..', '../..', 'relay-state', 'process', '../relay-state', 'zzserve/../../x', '.', '', 'con', 'zzserve/', 'a b', '__proto__'];
  const took = [];
  for (const k of evil) {
    const r = await sask('spirit.app.active', { key: k, active: true });
    if (r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false) took.push(k);
  }
  return !took.length ? true : false;
}, test.limit.quick);
test.run('no folder appeared at the run root after the bad names', 0.2, async function () {
  await H.sleep(2000);
  const outside = fs.readdirSync(SL.run).filter(function (n) { return ['relay-state', 'process', 'x'].indexOf(n) !== -1; });
  return !outside.length ? true : false;
}, test.limit.slow);
test.run('after the bad names, the state layout holds with nothing out of place', 0.2, function () { return layoutHolds(); }, test.limit.quick);

// the attacker: an app's folder taken away while it runs
test.run('the node still answers with an app server\'s folder gone under it', 0.2, async function () {
  if (!SL.servers[0]) return false;
  fs.rmSync(path.join(SL.run, 'spirit', 'app', SL.servers[0]), { recursive: true, force: true });
  await H.sleep(4000);
  const alive = await sask('api', {});
  return alive.status === 200 ? true : false;
}, test.limit.slow);
test.run('with backup\'s app folder gone, the state layout holds with nothing out of place', 0.2, function () { return layoutHolds(); }, test.limit.quick);

// ── THE VENDORED LIBRARIES PART ──
// THE FILE WATCHER AND THE VENDORED LIBRARIES left job for the fs branch (goal/G49.15, box v16): their tests are
// spirit/fs/server/test/script.js.

// 5. that no file names spirit/run/node_modules, and .gitignore keeps no exception for it, is the general test's,
// spirit/test/script-sibling-general.js (goal/G47.1): a rule of every file, not of job.js.

// THE MOUNT PART, once appServer-mount.js, then a part of ./appServer.js's test (moved here, goal/G47.1: the node starting
// a server from spirit/app/<name>/ is job.js's work; appServer.js is the router inside that server).
function mountPart() {
  // Once spirit/run/spirit/test/appServer-mount.js.
  // The tests of the node starting a server from spirit/app/<name>/ (spec: ./appServer.md; goal/G43.12). Andy: "JUST loading
  // functional server and associating the <name> as "familiy" name, in the new namespace". A real node on a scratch copy of the
  // tracked files gets throwaway apps planted in that copy (probe, quiet, always), nothing kept in the repo (Andy, Q10: "then write
  // the test"); the tree's own server app (agent, node.mount true) is not what it judges. Every server is an app
  // since goal/G43.20, run://process gone. Neither Andy's node nor an agent's is touched.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, spawnSync, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  // Required in the first test, once the real spirit object is back: under the verifier testReport.js loads spirit.js for
  // its records with the global put aside, and a server module required after that finds no global spirit.
  let answer, freePort, until, sleep, chromePage, findChrome;

  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
  const POSIX = process.platform !== 'win32';

  const NAME = 'probe';
  const MODULE = 'spirit.app.' + NAME;
  const NOTE = 'what the app folder holds';
  const INTERFACE = '// the interface at the top of the app folder';
  // The old family folder's name: the decoy below.
  const OLD_FOLDER = 'family';

  // THE THROWAWAY APP, written as the box describes one: one file, a split for the page and the node, its family at its top (goal/G43.27), its data.js
  // beside it, and a <name>.json without the old kind and operated. Its family/ is a decoy: no family has one any more.
  function plantApp(run, name, mount, intrinsic) {
    const dir = path.join(run, 'spirit', 'app', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, OLD_FOLDER), { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: Object.assign({ icon: '🧪', label: name }, intrinsic === undefined ? {} : { intrinsic: intrinsic }), mount: { [name + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: mount } }));
    fs.writeFileSync(path.join(dir, name + '.js'), [
      "'use strict';",
      "if (typeof window !== 'undefined') { window.__appOnPage = '" + name + "'; } else {",
      "  require('../../script.js');",
      "  const fs = require('fs'), path = require('path');",
      "  const STATE = process.argv[process.argv.indexOf('--state') + 1];",
      "  fs.mkdirSync(STATE, { recursive: true });",
      "  fs.writeFileSync(path.join(STATE, 'started.txt'), String(process.pid));",
      "  require('../../server/app/script.js').serve({ ping: { request: {}, reply: {}, handler: function () { return { pid: process.pid, state: STATE }; } } }, {});",
      '}',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'helper.js'), "require('fs').writeFileSync(process.argv[2], 'ran');\n");
    // Its api.js requires its companion data.js, the one script that does (goal/G47.1), on a page and in node.
    fs.writeFileSync(path.join(dir, 'api.js'), INTERFACE + "\nif (typeof window !== 'undefined') window.spirit.requireScript('spirit/app/" + name + "/data.js'); else require('../../script.js').requireScript('spirit/app/" + name + "/data.js');\nmodule.exports = { verbs: { ping: {} } };\n");
    fs.writeFileSync(path.join(dir, 'note.txt'), NOTE);
    fs.writeFileSync(path.join(dir, OLD_FOLDER, 'api.js'), '// the decoy\nmodule.exports = { verbs: { decoy: {} } };\n');
    fs.writeFileSync(path.join(dir, OLD_FOLDER, 'note.txt'), 'the decoy');
    fs.writeFileSync(path.join(dir, 'data.js'), [
      '(function family() {',
      // goal/G49.23: in node the store by its path, spirit/client/script.js, through the spirit object.
      "  var D = typeof window !== 'undefined' ? window.spirit.client : require('../../script.js').requireScript('spirit/client/script.js');",
      "  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(family); return; }",
      "  D.makeFamily('" + appId(name) + "');",
      "  (typeof window !== 'undefined' ? window : global).__appData = '" + name + "';",
      '}());',
    ].join('\n') + '\n');
  }
  function scratch() {
    const root = LABH.scratchTree().root;
    const run = path.join(root, 'spirit', 'run');
    plantApp(run, NAME, true);
    plantApp(run, 'quiet', false);
    // NEITHER KIND (goal/G43.19, box v16, 2: "a one-shot app is an app with api.js and data.js at its top, node mount false or
    // missing, and switched on"): with no data.js, quiet is no one-shot app either, so node.mount false still starts nothing.
    fs.rmSync(path.join(run, 'spirit', 'app', 'quiet', 'data.js'), { force: true });
    // goal/G43.14: a server app the development team made intrinsic.
    plantApp(run, 'always', true, true);
    // A follower of a sender's stream, with its cache on: what it kept comes back at its start only if the sender's family has a
    // data.js on this node (appServer.js, familyApi), and its translator says so by a file. Named by its own script, as a server is.
    const follow = path.join(run, 'spirit', 'app', NAME);
    fs.writeFileSync(path.join(follow, 'followerRows.js'), [
      // goal/G49.23: the store is spirit/client/script.js, required by its path through the spirit object.
      "const D = require('../../script.js').requireScript('spirit/client/script.js');",
      "D.addTranslator({ onJob: function (job) { if (job && job.app) require('fs').writeFileSync(process.env.ROW_SEEN, JSON.stringify(job.app)); } });",
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(follow, 'follower.js'), [
      "require('../../script.js');",
      "const path = require('path');",
      "require('../../server/app/script.js').serve({}, { stream: { translator: 'spirit/app/" + NAME + "/followerRows.js', cache: true, module: 'a.test' } });",
    ].join('\n') + '\n');
    plantFake(run);
    return { root: root, run: run };
  }
  // A FAKE APP OUTSIDE spirit/app/ (goal/G49.19, box v13; Andy: "ALL aspects of jobs/processes identify them by the full path
  // of their branch, whereever they may be mounted, a test should actually place a fake app at spirit.fake (a copy of icon
  // perhaps) and make sure the moved folder still streams with the proper new ID"; "all publishes on the wire ... MUST stream
  // under the proper job id, which is that dot path of the spirit.<branchPath>"): spirit/fake/, a server with one verb, which
  // publishes one row as it starts.
  function plantFake(run) {
    const dir = path.join(run, 'spirit', 'fake');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'fake.json'), JSON.stringify({ identity: { icon: '🧪', label: 'fake' }, mount: { 'fake.js': true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }));
    fs.writeFileSync(path.join(dir, 'fake.js'), [
      "'use strict';",
      "if (typeof window === 'undefined') {",
      "  require('../script.js');",
      "  require('../server/app/script.js').serve({ ping: { request: {}, reply: {}, handler: function () { return { pid: process.pid }; } } }, {});",
      // Published again and again: a job keeps its last payload, and the server's own announce replaces an earlier one.
      "  setInterval(function () { spirit.eventStream.publish({ fake: 'streamed' }); }, 300);",
      '}',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'api.js'), "if (typeof window !== 'undefined') window.spirit.requireScript('spirit/fake/data.js'); else require('../script.js').requireScript('spirit/fake/data.js');\nmodule.exports = { verbs: { ping: {} } };\n");
    fs.writeFileSync(path.join(dir, 'data.js'), "module.exports = {};\n");
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: asSent(verb, args) }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: '', body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = LABH.startNodeOn(run, port);
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }
  function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
  // Every job the node holds, as spirit.job.get answers it.
  async function jobsOf(base) {
    const found = await call(base, 'spirit.job.search', { q: '' });
    const items = (found.body && found.body.items) || [];
    const rows = await Promise.all(items.map(function (i) { return call(base, 'spirit.job.get', { key: i.key }); }));
    return rows.map(function (r) { return r.body && r.body.job; }).filter(Boolean);
  }
  async function liveJob(base, module) {
    return (await jobsOf(base)).filter(function (j) { return j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); })[0] || null;
  }
  async function rowOf(base, name) {
    const r = await call(base, 'spirit.app.search', { q: '' });
    const item = ((r.body && r.body.items) || []).filter(function (i) { return i.key === name; })[0];
    return item ? parsed(item.label) : null;
  }
  function pingOf(base, name) { return call(base, appId(name || NAME) + '.ping', {}); }
  function answers(r) { return r.status === 200 && !!r.body && Number(r.body.pid) > 0; }
  function upAgain(base) { return until(function () { return pingOf(base).then(answers); }, 30000); }

  // appServer-mount: appServerMount: the node starts a server from spirit/app/<name>/ (goal/G43.12).
  const live = [];
  let chrome = null;
  let s = null;
  let N = { up: false, base: 'http://127.0.0.1:0' };
  let ranHelper = '', ranElsewhere = '', elsewhere = '', first = {}, job = null, before = 0;
  const state = function () { return path.join(s.run, 'spirit', 'state', 'app', NAME); };
  const nodeJson = function () { return readJson(path.join(state(), 'node.json')); };
  const started = function () { return path.join(state(), 'data', 'started.txt'); };
  const startIt = function (script, arg) { return call(N.base, 'spirit.job.create', { command: 'node', args: [script].concat(arg ? [arg] : []), type: 'red' }); };
  const refused = function (r) { return r.status >= 400 && !!r.body && r.body.ok === false; };
  const noNode = function () { return !s || !N.up; };
  test.after(async function () {
    live.forEach(function (c) { try { c.kill(); } catch (e) { /* gone */ } });
    if (chrome && chrome.kid) { try { chrome.kid.kill(); } catch (e) { /* gone */ } }
    await new Promise(function (r) { setTimeout(r, 300); });
    if (s) { try { LABH.freeTree(s); } catch (e) { /* a door still closing; the temp folder keeps it */ } }
  });

  test.run('a scratch node comes up for the throwaway app', 0.2, async function () {
    ({ answer } = SPIRIT.requireScript('spirit/peer/door/script.js'));
    ({ freePort, until, sleep, chromePage, findChrome } = SPIRIT.requireScript('spirit/testicle/headLessChrome/script.js'));
    s = scratch();
    ranHelper = path.join(s.root, 'helper-ran.txt');
    ranElsewhere = path.join(s.root, 'elsewhere-ran.txt');
    elsewhere = path.join(s.root, 'other', 'spirit', 'app', NAME, NAME + '.js');
    N = await boot(s.run); live.push(N.child);
    return N.up || false;
  }, test.limit.slow);
  test.run('the throwaway app is a row of the app branch', 0.2, async function () {
    return (!noNode() && !!(await rowOf(N.base, MODULE))) || false;
  }, test.limit.quick);

  // the goal box: "An app server cannot be booted until a user activates it."
  test.run('an app that is not active has no server job', 0.2, async function () {
    if (noNode()) return false;
    await sleep(1500);
    return !(await liveJob(N.base, MODULE)) || false;
  }, test.limit.slow);
  test.run('the script of an app that is not active did not run', 0.2, function () {
    return (!noNode() && !fs.existsSync(started())) || false;
  }, test.limit.quick);
  test.run('the verb of an app that is not active is not answered', 0.2, async function () {
    return (!noNode() && !answers(await pingOf(N.base))) || false;
  }, test.limit.quick);

  // goal/G43.14, the box: "intrinsic true: the app is always active. It runs at boot with no Activate, and app.active does
  // not switch it off."
  test.run('an intrinsic server runs from the boot, with nothing pressed', 0.2, async function () {
    if (noNode()) return false;
    return (await until(function () { return pingOf(N.base, 'always').then(answers); }, 30000)) || false;
  }, test.limit.quick);
  // Its DEBUG state is the one thing written there, by the server itself (goal/G43.15); no active switch is.
  test.run('no active flag was written to the intrinsic server\'s node.json', 0.2, function () {
    if (noNode()) return false;
    return !('active' in (readJson(path.join(s.run, 'spirit', 'state', 'app', 'always', 'node.json')) || {})) || false;
  }, test.limit.quick);
  test.run('app.active false does not stop the intrinsic server', 0.2, async function () {
    if (noNode()) return false;
    const alwaysPid = Number(((await pingOf(N.base, 'always')).body || {}).pid);
    await call(N.base, 'spirit.app.active', { key: appId('always'), active: false });
    await sleep(3000);
    return (answers(await pingOf(N.base, 'always')) && alive(alwaysPid)) || false;
  }, test.limit.slow);

  // goal/G43.20, the box: "spirit.job.create starts only an app's own script, spirit/app/<name>/<name>.js, of an app whose
  // <name>.json says node run true; anything else is refused"
  test.run('a helper of an app is refused, and does not run', 0.8, async function () {
    if (noNode()) return false;
    const inactive = await startIt('spirit/app/' + NAME + '/helper.js', ranHelper);
    await sleep(1500);
    return (refused(inactive) && !fs.existsSync(ranHelper)) || false;
  }, test.limit.slow);
  test.run('its server script, its json saying node mount, not node run, is refused too, and does not run', 0.8, async function () {
    if (noNode()) return false;
    const inactiveMain = await startIt('spirit/app/' + NAME + '/' + NAME + '.js');
    await sleep(1500);
    return (refused(inactiveMain) && !fs.existsSync(started())) || false;
  }, test.limit.slow);
  // Outside the two places: a script of the shell, a file at the top of spirit/app, the same path in another tree, and a way out by dots.
  test.run('the scripts outside the two places are planted', 0.2, function () {
    if (!s) return false;
    fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
    fs.writeFileSync(elsewhere, "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    // shell/ is gone from the tree (goal/G43.30): the planted script outside the two places makes its folder.
    fs.mkdirSync(path.join(s.run, 'shell'), { recursive: true });
    fs.writeFileSync(path.join(s.run, 'shell', 'planted.js'), "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    fs.writeFileSync(path.join(s.run, 'spirit', 'app', 'planted.js'), "require('fs').writeFileSync(" + JSON.stringify(ranElsewhere) + ", 'ran');\n");
    return true;
  }, test.limit.quick);
  const outside = async function (script) {
    if (noNode()) return false;
    const r = await startIt(script);
    await sleep(1000);
    return (refused(r) && !fs.existsSync(ranElsewhere)) || false;
  };
  test.run('a script of the shell is refused, and does not run', 0.8, function () { return outside('shell/planted.js'); }, test.limit.slow);
  test.run('a file at the top of spirit/app is refused, and does not run', 0.8, function () { return outside('spirit/app/planted.js'); }, test.limit.slow);
  test.run('the same path in another tree is refused, and does not run', 0.8, function () { return outside(elsewhere); }, test.limit.slow);
  test.run('a way out of an app\'s folder is refused, and does not run', 0.8, function () { return outside('spirit/app/' + NAME + '/../../../shell/planted.js'); }, test.limit.slow);

  // the box: "It starts one only if its <name>.json says node.mount true and spirit/state/<name>/node.json says active true"
  test.run('an app with node.mount false is activated', 0.2, async function () {
    if (noNode()) return false;
    const quietOn = await call(N.base, 'spirit.app.active', { key: appId('quiet'), active: true });
    return quietOn.status === 200 || false;
  }, test.limit.quick);
  test.run('an active app with node.mount false and no data.js has no server job', 0.2, async function () {
    if (noNode()) return false;
    await sleep(3000);
    return !(await liveJob(N.base, 'spirit.app.quiet')) || false;
  }, test.limit.slow);
  test.run('the quiet app\'s verb is not answered', 0.2, async function () {
    return (!noNode() && !answers(await pingOf(N.base, 'quiet'))) || false;
  }, test.limit.quick);
  test.run('a script outside spirit/app is refused by name', 0.8, async function () {
    if (noNode()) return false;
    const otherPlace = await call(N.base, 'spirit.job.create', { command: 'node', args: ['shell/planted.js'], type: 'red' });
    return (otherPlace.status >= 400 && !!otherPlace.body && otherPlace.body.code === 'not-a-process') || false;
  }, test.limit.quick);

  // That a member without a grant is refused and one granted <name>.ping reaches it is apiDoor's gate: ./apiDoor.js.

  // the box: "data.js sits beside <name>.js ... and the lookups follow it": a client's cache
  // What a client kept of a sender comes back only when that sender's family has a data.js here.
  const SENDER = 'MCowBQYDK2VwAyEAgrEcBu0FkTzmGKs+oBS+OllzvZh+d/0Rr6fO/fXD+0c=';
  const kept = async function (family) {
    const folder = path.join(s.run, 'spirit', 'state', 'app', 'follower', 'cache');
    fs.rmSync(folder, { recursive: true, force: true });
    fs.mkdirSync(folder, { recursive: true });
    const id = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./spirit/client/script.js').nodeId(" + JSON.stringify(SENDER) + "))"], { cwd: s.run, encoding: 'utf8' }).stdout;
    fs.writeFileSync(path.join(folder, id + '.json'), JSON.stringify({ key: SENDER, family: family, run: 'r', n: 1, rows: [{ kept: family }] }));
    const seen = path.join(s.root, 'row-seen.json');
    fs.rmSync(seen, { force: true });
    const pipe = require(path.join(s.run, 'spirit', 'app', 'adapter', 'script.js')).pipePathFor(s.root, 'spirit/app/follower', process.platform);
    if (POSIX) fs.mkdirSync(path.dirname(pipe), { recursive: true });
    const kid = spawn(process.execPath, [path.join('spirit', 'app', NAME, 'follower.js'), '--pipe', pipe, '--state', path.join(s.run, 'spirit', 'state', 'app', 'follower', 'data')], { cwd: s.run, stdio: 'ignore', env: Object.assign({}, process.env, { ROW_SEEN: seen }) });
    live.push(kid);
    await until(function () { return Promise.resolve(fs.existsSync(seen)); }, 6000);
    await stop(kid);
    return readJson(seen);
  };
  test.run('a client gets back what it kept of a node branch', 0.2, async function () {
    if (!s) return false;
    // goal/G49.22: the contact branch is in the new shape, spirit.contact (was contact), its client spirit/contact/client/script.js.
    const keptOld = await kept('spirit.contact');
    return (!!keptOld && keptOld.kept === 'spirit.contact') || false;
  }, test.limit.quick);
  test.run('a client gets back nothing of a branch with no data.js here', 0.2, async function () {
    if (!s) return false;
    const keptNone = await kept('noSuchFamily');
    return !keptNone || false;
  }, test.limit.slow);
  test.run('a client gets back what it kept of the new branch', 0.2, async function () {
    if (!s) return false;
    // The new branch by its id, spirit.app.probe (goal/G49.19).
    const keptNew = await kept(MODULE);
    return (!!keptNew && keptNew.kept === MODULE) || false;
  }, test.limit.quick);

  // the box: "active in node.json starts and stops it while the node runs"
  test.run('the app is activated by the verb its element presses', 0.2, async function () {
    if (noNode()) return false;
    const on = await call(N.base, 'spirit.app.active', { key: MODULE, active: true });
    return on.status === 200 || false;
  }, test.limit.quick);
  test.run('activated, the server starts and answers its verb, with no restart of the node', 0.2, async function () {
    if (noNode()) return false;
    const up = await upAgain(N.base);
    first = (await pingOf(N.base)).body || {};
    return up || false;
  }, test.limit.quick);
  test.run('the pid the server gave is a live process', 0.2, function () {
    if (!first.pid) return false;
    return alive(Number(first.pid)) || false;
  }, test.limit.quick);

  // the box: "<name> is its family name in the node's flat table", its family at the top of the app folder, as
  // spirit/<family>/ has it (goal/G43.27)
  let tree = {};
  test.run('the flat table holds probe with its verb', 0.2, async function () {
    if (noNode()) return false;
    tree = (await call(N.base, 'api')).body || {};
    return (!!tree[MODULE] && !!tree[MODULE].ping) || false;
  }, test.limit.quick);
  test.run('its interface is the api.js at the top of the app folder', 0.2, async function () {
    if (noNode()) return false;
    const iface = (await call(N.base, 'api', { branch: MODULE })).body || {};
    return String(iface.interface || '').indexOf(INTERFACE) !== -1 || false;
  }, test.limit.quick);
  // No FS set (goal/G43.20; Andy: "those owner only FS verbs are no longer needed, because not the api ID ... ARE the path to
  // all those files"): the app folder's files are spirit.fs's, by the path its id names.
  test.run('its branch carries no FS set', 0.2, function () {
    if (!tree[MODULE]) return false;
    return !Object.keys(tree[MODULE] || {}).some(function (v) { return /^FS\./.test(v); }) || false;
  }, test.limit.quick);
  test.run('its folder is spirit/app/probe/, read through spirit.fs by that path', 0.2, async function () {
    if (noNode()) return false;
    const note = (await call(N.base, 'spirit.fs.load', { path: 'spirit/app/' + NAME + '/note.txt' })).body || {};
    return note.text === NOTE || false;
  }, test.limit.quick);

  // the box: "Its module id is spirit.app.<name>", "Jobs names it so."
  test.run('its server job has the module id spirit.app.probe', 0.2, async function () {
    if (noNode()) return false;
    job = await liveJob(N.base, MODULE);
    return !!job || false;
  }, test.limit.quick);

  // the box: "node.mount true means a server the node runs, with no arguments"
  test.run('the probe app\'s <name>.json has neither kind nor operated, and it runs', 0.2, function () {
    if (!s) return false;
    const own = readJson(path.join(s.run, 'spirit', 'app', NAME, NAME + '.json')) || {};
    return (own.node && own.node.mount === true && !('kind' in own) && !('operated' in own)) || false;
  }, test.limit.quick);
  test.run('the node operates the probe server', 0.2, function () {
    return (!!job && job.data && job.data.operated === 'node') || false;
  }, test.limit.quick);

  // the box: "Its door.sock lives in spirit/state/<name>/", and its state stays in data/
  if (POSIX) {
    // Where the door lies is the requirement here, so its path is read and never connected to: a call goes through the node.
    test.run('its door is a socket in spirit/state/app/probe/', 0.2, function () {
      if (!s) return false;
      const door = path.join(state(), 'door.sock');
      return (fs.existsSync(door) && fs.statSync(door).isSocket()) || false;
    }, test.limit.quick);
    test.run('there is no door socket in its data/ folder', 0.2, function () {
      if (!s) return false;
      return !fs.existsSync(path.join(state(), 'data', 'door.sock')) || false;
    }, test.limit.quick);
  }
  test.run('the node hands it spirit/state/app/probe/data as --state', 0.2, function () {
    if (!s) return false;
    return path.resolve(String(first.state)) === path.join(state(), 'data') || false;
  }, test.limit.quick);
  test.run('what it writes there is on disc', 0.2, function () {
    if (!s) return false;
    return fs.existsSync(started()) || false;
  }, test.limit.quick);

  // the box: "active is the one switch, with no separate running field"
  test.run('node.json says active true, and holds no running', 0.2, function () {
    if (!s) return false;
    const j1 = nodeJson() || {};
    return (j1.active === true && !('running' in j1)) || false;
  }, test.limit.quick);
  test.run('killed, the node starts it again', 0.2, async function () {
    if (noNode()) return false;
    if (!first.pid) return false;
    process.kill(Number(first.pid), 'SIGKILL');
    await until(function () { return Promise.resolve(!alive(Number(first.pid))); }, 5000);
    return (await until(function () { return pingOf(N.base).then(function (r) { return answers(r) && Number(r.body.pid) !== Number(first.pid); }); }, 30000)) || false;
  }, test.limit.slow);
  test.run('active stays true in node.json through the kill and restart', 0.2, function () {
    if (!s) return false;
    const j2 = nodeJson() || {};
    return (j2.active === true && !('running' in j2)) || false;
  }, test.limit.quick);

  // goal/G43.20, the box: "A second script in an app folder is therefore never started."
  test.run('a helper of an active app is refused, and does not run', 0.8, async function () {
    if (noNode()) return false;
    const activeHelper = await startIt('spirit/app/' + NAME + '/helper.js', ranHelper);
    await sleep(1500);
    return (refused(activeHelper) && !fs.existsSync(ranHelper)) || false;
  }, test.limit.slow);

  // a page binds it by its name, and its api.js loads its data.js, on a page and in a process (the box: "A page changes
  // nothing. It binds a family by its name, and the node finds the folder."; "data.js sits beside <name>.js ... and the
  // lookups follow it"; goal/G47.1: "every api.js requires it's companion data.js, and is the only script to require that
  // data.js")
  const onPage = function (expr) { return chrome.evaluate('Promise.resolve().then(function () { return ' + expr + '; }).then(function (v) { return JSON.stringify({ v: v }); }, function () { return \'{}\'; })').then(parsed); };
  const noPage = function () { return !chrome || !!chrome.error; };
  test.run('Chrome is here and opens the node\'s page', 0.2, async function () {
    if (noNode()) return false;
    const where = findChrome();
    if (!where) return false;
    chrome = await chromePage(where);
    if (chrome.error) return false;
    await chrome.send('Page.navigate', { url: N.base + '/' });
    return true;
  }, test.limit.quick);
  test.run('the page has its spirit object', 0.2, async function () {
    if (noPage()) return false;
    return (await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) || false;
  }, test.limit.quick);
  test.run('a page binds the new branch by its name, and its verb answers', 0.2, async function () {
    if (noPage()) return false;
    const pinged = await onPage("spirit.readyPromise.then(function () { return spirit.requireScript('spirit/app/" + NAME + "/api.js'); }).then(function (f) { return f.ping({}); })");
    return (!!pinged && !!pinged.v && Number(pinged.v.pid) > 0) || false;
  }, test.limit.quick);
  test.run('on a page, binding the branch by its api.js loads and runs the data.js beside <name>.js', 0.2, async function () {
    if (noPage()) return false;
    const managed = await onPage("spirit.readyPromise.then(function () { return spirit.requireScript('spirit/app/" + NAME + "/api.js'); }).then(function () { return window.__appData; })");
    return (!!managed && managed.v === NAME) || false;
  }, test.limit.quick);
  test.run('the one <name>.js also runs on a page, one file on the page and as the server', 0.2, async function () {
    if (noPage()) return false;
    const same = await onPage("spirit.requireScript('spirit/app/" + NAME + '/' + NAME + ".js').then(function () { return window.__appOnPage; })");
    return (!!same && same.v === NAME) || false;
  }, test.limit.quick);
  // The store at its place since goal/G49.23, spirit.client (no spirit.required).
  // A process requires the family's api.js alone, and says whether its data.js then stands at its path, spirit.app.<name>.data (a
  // client of the new shape at spirit.app.<name>.client; goal/G49.23: the store hands no family out by name), and what the planted
  // data.js marked.
  const inNode = function (family) {
    const r = spawnSync(process.execPath, ['-e', "require('./spirit/script.js'); require(" + JSON.stringify('./spirit/app/' + family + '/api.js') + "); console.log(JSON.stringify({ stands: !!(global.spirit.app && global.spirit.app[" + JSON.stringify(family) + "] && (global.spirit.app[" + JSON.stringify(family) + "].client || global.spirit.app[" + JSON.stringify(family) + "].data)), mark: global.__appData || '' }));"], { cwd: s.run, encoding: 'utf8', timeout: 30000 });
    return parsed(String(r.stdout || '').trim()) || {};
  };
  test.run('in a process, requiring a tree app\'s api.js loads its data.js', 0.2, function () {
    if (!s) return false;
    // A tree app with an api.js, the first found, never named (goal/G47.4).
    const apps = path.join(RUN, 'spirit', 'app');
    const one = fs.readdirSync(apps).filter(function (a) { return a !== 'test' && a !== NAME && fs.existsSync(path.join(apps, a, 'api.js')); })[0];
    if (!one) return false;
    return inNode(one).stands === true || false;
  }, test.limit.quick);
  test.run('in a process, requiring the new branch\'s api.js loads and runs its data.js', 0.2, function () {
    if (!s) return false;
    const found = inNode(NAME);
    return (found.stands === true && found.mark === NAME) || false;
  }, test.limit.quick);

  // the box: "turning "active" will NOT take the row out of the list"; and off stops it
  test.run('the app is deactivated', 0.2, async function () {
    if (noNode()) return false;
    before = Number(((await pingOf(N.base)).body || {}).pid);
    const off = await call(N.base, 'spirit.app.active', { key: MODULE, active: false });
    return off.status === 200 || false;
  }, test.limit.quick);
  test.run('deactivated, the server process stops', 0.2, async function () {
    if (noNode()) return false;
    return (await until(function () { return Promise.resolve(!alive(before)); }, 15000)) || false;
  }, test.limit.quick);
  test.run('deactivated, no server job of the app stays live', 0.2, async function () {
    if (noNode()) return false;
    return (await until(function () { return liveJob(N.base, MODULE).then(function (j) { return !j; }); }, 10000)) || false;
  }, test.limit.quick);
  test.run('deactivated, the app\'s verb is not answered', 0.2, async function () {
    return (!noNode() && !answers(await pingOf(N.base))) || false;
  }, test.limit.quick);
  test.run('deactivated, the server does not come back by itself', 0.2, async function () {
    if (noNode()) return false;
    await sleep(3000);
    return (!answers(await pingOf(N.base)) && !alive(before)) || false;
  }, test.limit.slow);
  test.run('its row stays in the list, active false', 0.2, async function () {
    if (noNode()) return false;
    const offRow = await rowOf(N.base, MODULE);
    return (!!offRow && offRow.active === false) || false;
  }, test.limit.quick);
  test.run('node.json says active false', 0.2, function () {
    if (!s) return false;
    return (nodeJson() || {}).active === false || false;
  }, test.limit.quick);
  test.run('activated again, it starts again', 0.2, async function () {
    if (noNode()) return false;
    await call(N.base, 'spirit.app.active', { key: MODULE, active: true });
    return (await upAgain(N.base)) || false;
  }, test.limit.quick);

  // the box: "true means the node runs it now and starts it at every boot"; Andy: "that's how the node knows, at re-boot
  // time, which servers it must autostart."
  test.run('a restarted node starts it', 0.2, async function () {
    if (!s) return false;
    await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    return (N.up && await upAgain(N.base)) || false;
  }, test.limit.slow);
  test.run('after the node restarts, active stays true', 0.2, function () {
    if (!s) return false;
    return (nodeJson() || {}).active === true || false;
  }, test.limit.quick);
  test.run('after the node restarts, its job is there under its module id', 0.2, async function () {
    if (noNode()) return false;
    return !!(await liveJob(N.base, MODULE)) || false;
  }, test.limit.quick);
  // A power cut: nothing gets to clean up, the node and the server go at once.
  test.run('after a power cut, its door left behind, the node starts it', 0.2, async function () {
    if (!s) return false;
    const cutPid = Number(((await pingOf(N.base)).body || {}).pid);
    N.child.kill('SIGKILL');
    try { process.kill(cutPid, 'SIGKILL'); } catch (e) { /* gone with the node */ }
    await until(function () { return Promise.resolve(N.child.exitCode !== null || N.child.signalCode !== null); }, 5000);
    N = await boot(s.run); live.push(N.child);
    return (N.up && await until(function () { return pingOf(N.base).then(function (r) { return answers(r) && Number(r.body.pid) !== cutPid; }); }, 30000)) || false;
  }, test.limit.slow);
  // THE FAKE APP AT spirit/fake/, KNOWN BY ITS PATH ALONE (goal/G49.19, box v13).
  const FAKE = 'spirit.fake';
  test.run('the app planted at spirit/fake/ is a row of the app branch under spirit.fake', 0.2, async function () {
    return (!noNode() && !!(await rowOf(N.base, FAKE))) || false;
  }, test.limit.quick);
  let fakeJob = null;
  test.run('app.active with the key spirit.fake starts its server under the job id spirit.fake', 0.4, async function () {
    if (noNode()) return false;
    await call(N.base, 'spirit.app.active', { key: FAKE, active: true });
    fakeJob = await until(function () { return liveJob(N.base, FAKE); }, 30000);
    return !!fakeJob || false;
  }, test.limit.slow);
  test.run('its verb is answered as spirit.fake.ping', 0.2, async function () {
    if (noNode()) return false;
    // A server that just started answers once it listens, as the probe's checks wait for theirs (upAgain).
    return (await until(function () { return call(N.base, FAKE + '.ping', {}).then(answers); }, 30000)) || false;
  }, test.limit.quick);
  test.run('what it publishes streams under the job id spirit.fake', 0.2, async function () {
    if (!fakeJob) return false;
    // Read from the node's job list, as liveJob reads it, until the payload it publishes again and again is the job's.
    const heard = await until(function () { return jobsOf(N.base).then(function (all) { return all.some(function (j) { return j.id === FAKE && !!j.app && j.app.fake === 'streamed'; }); }); }, 15000);
    return !!heard || false;
  }, test.limit.slow);
  test.run('nothing of it goes by a name: no job spirit.app.fake, and spirit.job.get of fake finds none', 0.2, async function () {
    if (!fakeJob) return false;
    const bare = await call(N.base, 'spirit.job.get', { key: 'fake' });
    return (!(await liveJob(N.base, 'spirit.app.fake')) && !(bare.body && bare.body.job)) || false;
  }, test.limit.quick);
  test.run('its switch is kept at spirit/state/fake/node.json', 0.2, function () {
    if (!s) return false;
    return (readJson(path.join(s.run, 'spirit', 'state', 'fake', 'node.json')) || {}).active === true || false;
  }, test.limit.quick);

  test.run('deactivated, a restarted node does not start it', 0.2, async function () {
    if (!s) return false;
    await call(N.base, 'spirit.app.active', { key: MODULE, active: false });
    await until(function () { return liveJob(N.base, MODULE).then(function (j) { return !j; }); }, 15000);
    await stop(N.child);
    fs.rmSync(started(), { force: true });
    N = await boot(s.run); live.push(N.child);
    await sleep(3000);
    const notStarted = N.up && !fs.existsSync(started()) && !(await liveJob(N.base, MODULE));
    await stop(N.child);
    return notStarted || false;
  }, test.limit.slow);
}
mountPart();

// A script's code, its comments left out.
function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }

// ── job.js's app checks read the common file/folder cache (goal/G49.2) ──
// Andy: "portion to use the common file/folder cache?", "fix job.js"; G49.1's box: "job.js's manifest and api.js checks"
// move onto spirit/fs/dataset/script.js, and "each disc scan goes in the same commit that moves its client onto spirit/fs/dataset/script.js". job.js's
// code, comments left out, asks the dataset whether an app's files are there and which folders spirit/app/ holds: no
// readdirSync of spirit/app/ and no existsSync of an app's <name>.js, api.js or data.js. Its statSync stays: it is the
// watcher's own, which feeds the dataset. A manifest's or a node.json's content is no row of the cache, so those reads stay.
const JOB_CODE = (function () { try { return code(fs.readFileSync(path.join(RUN, 'spirit', 'job', 'engine', 'script.js'), 'utf8')); } catch (e) { return ''; } })();
test.run('spirit/job/engine/script.js lists no folder on disc: no readdirSync', 0.2, function () {
  return (JOB_CODE.length > 0 && !/\breaddirSync\b|\breaddir\(/.test(JOB_CODE)) || false;
}, test.limit.quick);
test.run('spirit/job/engine/script.js asks the disc for no file: no existsSync', 0.2, function () {
  return (JOB_CODE.length > 0 && !/\bexistsSync\b/.test(JOB_CODE)) || false;
}, test.limit.quick);

// ── job.js keeps no file tree of its own for others (goal/G49.2; Andy: "go on the five!") ──
// G49.1's box: "Once every client reads spirit/fs/dataset/script.js, job.js's fsTreeCommands and fsTreeEntries go, and event.js,
// faceHome.js and nodeSearches.js read spirit.required.spirit.data.fs". job.js's code holds neither, and each of the three reaches the
// dataset through spirit/fs/dataset/script.js, naming neither. The two names are written in pieces, so this check does not count itself.
const TREE_NAMES = ['fsTree' + 'Commands', 'fsTree' + 'Entries'];
function codeOf(rel) { try { return code(fs.readFileSync(path.join(RUN, rel), 'utf8')); } catch (e) { return ''; } }
test.run('spirit/job/engine/script.js holds neither of its old tree reads', 0.2, function () {
  const c = codeOf('spirit/job/engine/script.js');
  return (c.length > 0 && TREE_NAMES.every(function (n) { return c.indexOf(n) === -1; })) || false;
}, test.limit.quick);
['spirit/eventEngine/script.js', 'spirit/contact/faceHome/script.js', 'spirit/nodeSearches/script.js'].forEach(function (rel) {
  test.run(rel + ' reads the tree through spirit/fs/dataset/script.js, not through job.js', 0.2, function () {
    const c = codeOf(rel);
    return (c.length > 0 && /require(?:Script)?\(\s*['"][^'"]*spirit\/fs\/dataset\/script\.js['"]\s*\)/.test(c) && TREE_NAMES.every(function (n) { return c.indexOf(n) === -1; })) || false;
  }, test.limit.quick);
});
