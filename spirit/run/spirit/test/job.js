'use strict';

// spirit/run/spirit/test/job.js
// The tests of spirit/job.js, and of no other module (spec: ./job.md). Since goal/G43.19 it holds the one-shot apps the node
// registers (the box, 2 and 4). This file holds goal/G41.30, the review's RH1:
// "jobs.create still spawns any program". Since goal/G43.20 (box: "jobs.create starts only an app's own script,
// spirit/app/<name>/<name>.js, of an app whose <name>.json says node run true; anything else is refused"). Raw calls over http to a scratch node's door,
// no spirit object; neither Andy's node nor an agent's is touched. Each thing asked to run would write a marker of its
// own, so "it ran" is read from the disk, not from the answer.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
const WAIT_MS = 1500;

test.startTest('job.js: job.create starts this node\'s processes, and no other program (goal/G41.30, RH1)');

(async function () {
  const marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-jobs-marks-'));
  // Icons, the first one-shot app (goal/G43.19), switched on at boot beside desk.
  const node = await scratchNode({ servers: ['desk', 'icons'] });
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const call = async function (args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'job.create', args: args }) });
      const text = await r.text();
      let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, code: body && body.code, text: text };
    };
    const script = function (mark) { return 'require("fs").writeFileSync(' + JSON.stringify(mark) + ',"ran");'; };
    const plant = function (rel, mark) { const f = path.join(run, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, script(mark)); return f; };
    const mark = function (n) { return path.join(marks, n); };
    const refusedCase = async function (name, m, args) {
      const a = await call(args);
      await sleep(WAIT_MS);
      const ran = fs.existsSync(m);
      ok(a.status >= 400 && a.status < 500 && typeof a.code === 'string' && !!a.code, 'refused with a code: ' + name, name + ': answered ' + a.status + ' ' + short(a.text));
      ok(!ran, 'and it never ran: ' + name, name + ': IT RAN, its marker is on the disk');
    };

    test.subHeading('another program is refused, and never runs');
    await refusedCase('/bin/sh with a command line', mark('sh'), { command: '/bin/sh', args: ['-c', 'echo pwned > ' + mark('sh')] });
    await refusedCase('sh, found on the path', mark('sh2'), { command: 'sh', args: ['-c', 'echo pwned > ' + mark('sh2')] });
    await refusedCase('this node\'s own executable given code to run (-e)', mark('dashE'), { command: process.execPath, args: ['-e', script(mark('dashE'))] });

    test.subHeading('this node\'s executable, on a script that is not its process, is refused');
    const outside = path.join(marks, 'outside.js');
    fs.writeFileSync(outside, script(mark('outside')));
    await refusedCase('a script outside spirit/app', mark('outside'), { command: process.execPath, args: [outside] });
    plant('zz-climbed.js', mark('climbed'));
    await refusedCase('a path climbing out of spirit/app', mark('climbed'), { command: process.execPath, args: ['spirit/app/desk/../../../zz-climbed.js'] });
    plant('spirit/app/zzNotRun/zzNotRun.js', mark('notRun'));
    fs.writeFileSync(path.join(run, 'spirit/app/zzNotRun/zzNotRun.json'), JSON.stringify({ identity: { label: 'zz' } }));
    await refusedCase('an app whose json does not say node run true', mark('notRun'), { command: process.execPath, args: ['spirit/app/zzNotRun/zzNotRun.js'] });

    test.subHeading('what this node may start still starts');
    // An app's own script, of an app whose json says node run true: its job is its route, spirit.app.<name>.
    plant('spirit/app/zzRun/zzRun.js', mark('run'));
    fs.writeFileSync(path.join(run, 'spirit/app/zzRun/zzRun.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
    const inc = await call({ command: process.execPath, args: ['spirit/app/zzRun/zzRun.js'] });
    await sleep(WAIT_MS);
    ok(inc.status === 201 && fs.existsSync(mark('run')), "an app's own spirit/app/<name>/<name>.js, its json saying node run true, starts", 'a node run app: answered ' + inc.status + ' ' + short(inc.text) + ', ran ' + fs.existsSync(mark('run')));
    // A PAGE SENDS PLAIN node (the app detail's run, spirit/element/search/app/detailElement.js:68): job.js reads it as this
    // node's own executable. The run before has ended, so the id is free again.
    const plainNode = await call({ command: 'node', args: ['spirit/app/zzRun/zzRun.js'] });
    ok(plainNode.status >= 200 && plainNode.status < 300, 'plain node with a node run app starts, as Run sends it', 'node with a node run app answered ' + plainNode.status + ' ' + String(plainNode.text || '').slice(0, 160));
    await sleep(WAIT_MS);
    // A SECOND SCRIPT IN AN APP FOLDER IS NEVER STARTED (goal/G43.20, the box).
    const helper = plant('spirit/app/zzRun/zzHelper.js', mark('helper'));
    await refusedCase("a second script in a node run app's folder", mark('helper'), { command: process.execPath, args: [helper] });

    // GOAL/G41.33. THE BOX: "Console output goes to null by default, at the source, for every process. Only DEBUG turns it
    // on. A crash is no exception: the exit code is enough to tell us to fix it, and we debug it by hand." Andy: "an
    // appServer's should only write to stderr/stdout in DEBUG mode", "I WANT JUST THE structured json events." A job's log
    // keeps what the node and the process's own published lines say. Andy, Q8, of the node and the relay themselves: "NOT the
    // servers.", so only what they start is judged. scratchNode leaves DEBUG on, so each part sets it.
    const door = async function (verb, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, body: body, text: text };
    };
    const setDebug = async function (on) { const a = await door('node.debug', { debug: { on: on } }); return !!(a.body && a.body.debug === on); };
    const noisy = function (name, tail) {
      const f = path.join(run, 'spirit', 'app', name, name + '.js');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, tail);
      fs.writeFileSync(path.join(run, 'spirit', 'app', name, name + '.json'), JSON.stringify({ identity: { label: 'zz' }, node: { run: true } }));
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
    noisy('zzNoisy', 'console.log("zzOutLine"); console.error("zzErrLine"); process.stdout.write("zzRawOut\\n"); process.stderr.write("zzRawErr\\n");'
      + PUBLISH + '.then(function () { process.exit(5); }, function () { process.exit(3); });');
    noisy('zzCrash', 'console.log("zzBeforeCrash"); throw new Error("zzCrashLine");');
    noisy('zzFlood', 'const line = "zzFlood".repeat(1000) + "\\n"; let n = 0; (function more() { while (n < 3000) { n++; if (!process.stdout.write(line)) { process.stdout.once("drain", more); return; } } process.exit(7); }());');

    test.subHeading('goal/G41.33: DEBUG off, a process\'s console goes nowhere, and what is structured stays');
    ok(await setDebug(false), 'DEBUG is off', 'node.debug would not go off: nothing judged');
    const id1 = await start('zzNoisy');
    ok(!!id1, 'a process that writes to its console starts', 'the process did not start: nothing judged');
    if (id1) {
      const j = await finished(id1);
      const said1 = logText(j);
      ['zzOutLine', 'zzErrLine', 'zzRawOut', 'zzRawErr'].forEach(function (w) { ok(!!j && said1.indexOf(w) === -1, 'not in the job\'s log: ' + w, w + ' is in the job\'s log with DEBUG off: ' + short(said1)); });
      ok(said1.indexOf('job created') !== -1, 'the node\'s own line stays', 'the node\'s own lines went too: ' + short(said1));
      ok(said1.indexOf('zzPublishedLine') !== -1, 'a line the process published stays', 'a published line is gone: ' + short(said1));
    }
    const id2 = await start('zzCrash');
    ok(!!id2, 'a process that crashes starts', 'the crash did not start: nothing judged');
    if (id2) {
      const j = await finished(id2);
      const said2 = logText(j);
      ok(!!j && said2.indexOf('zzCrashLine') === -1 && said2.indexOf('zzBeforeCrash') === -1, 'a crash is no exception: its console is not in the log', 'a crash\'s console is in the job\'s log with DEBUG off: ' + short(said2));
      ok(!!j && j.data && typeof j.data.exitCode === 'number' && j.data.exitCode !== 0, 'and the job says the exit code', 'a crash left no exit code on the job: ' + short(j && j.data));
    }
    // The attacker's way to hang it: a process that floods its console with nobody reading.
    const id3 = await start('zzFlood');
    ok(!!id3, 'a process that floods its console starts', 'the flood did not start: nothing judged');
    if (id3) {
      const j = await finished(id3);
      ok(!!j && j.data && j.data.exitCode === 7, 'it does not hang: 3 MB written and it ends, by its own exit code', 'the flood did not end with its own exit code: ' + short(j && { status: j.status, data: j.data }));
    }

    test.subHeading('goal/G41.33: only DEBUG turns it on');
    ok(await setDebug(true), 'DEBUG is on', 'node.debug would not go on: nothing judged');
    const id4 = await start('zzNoisy');
    ok(!!id4, 'the same process starts', 'the process did not start: nothing judged');
    if (id4) {
      const said4 = logText(await finished(id4));
      ['zzOutLine', 'zzErrLine'].forEach(function (w) { ok(said4.indexOf(w) !== -1, 'with DEBUG on, in the log: ' + w, 'with DEBUG on, ' + w + ' is not in the job\'s log: ' + short(said4)); });
    }

    // ── ONE-SHOT APPS, REGISTERED BY THE NODE (goal/G43.19, box v16) ──
    // The box, 2: "a one-shot app is an app with api.js and data.js at its top, node mount false or missing, and switched
    // on. icons is the first."; 4: "the node registers each one-shot app where it reads the manifests and starts the
    // permanent ones ... Switched off, its row goes, and a call to it answers app-not-served". Each thing that would run
    // writes a marker, so "it ran" is read from the disc.
    test.subHeading('the box, 4: a one-shot app switched on at boot is registered with the permanent ones');
    let iconVerbs = [];
    try { iconVerbs = Object.keys(require(path.join(run, 'spirit', 'app', 'icons', 'api.js')).verbs || {}); } catch (e) { iconVerbs = []; }
    ok(iconVerbs.length >= 1, 'the world: icons\'s api.js names its verbs: ' + iconVerbs.join(', '), 'icons has no api.js with verbs: no one-shot app to judge');
    const branches = async function () { const t = await door('api', {}); return t.status === 200 && t.body ? Object.keys(t.body) : []; };
    ok((await branches()).indexOf('icons') !== -1, 'icons, on in its node.json at boot, is in the api tree with no app.active asked', 'the tree at boot: ' + short(await branches()));
    ok((await branches()).indexOf('desk') !== -1, 'and desk, a permanent server, beside it', 'the tree lost desk: ' + short(await branches()));

    test.subHeading('the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"; on again, it is back');
    ok((await door('app.active', { key: 'icons', active: false })).status === 200, 'the world: icons switched off', 'app.active icons false was refused');
    await sleep(WAIT_MS);
    const offCall = iconVerbs.length ? await door('icons.' + iconVerbs[0], {}) : { text: '' };
    ok(/app-not-served/.test(offCall.text), 'icons.' + (iconVerbs[0] || '<verb>') + ' answers app-not-served', 'switched off, it answered ' + offCall.status + ' ' + short(offCall.text));
    ok((await branches()).indexOf('icons') === -1, 'and the tree holds no icons', 'switched off, the tree holds icons');
    ok((await door('app.active', { key: 'icons', active: true })).status === 200, 'the world: icons switched on again', 'app.active icons true was refused');
    ok(await until(function () { return branches().then(function (b) { return b.indexOf('icons') !== -1; }); }, 10000), 'switched on again, icons is back in the tree, no restart of the node', 'switched on again, the tree holds no icons');

    test.subHeading('the box, 2: "node mount false or missing": an icons.json with no node part is still one-shot');
    const iconsJson = path.join(run, 'spirit', 'app', 'icons', 'icons.json');
    const kept = fs.readFileSync(iconsJson, 'utf8');
    const noNode = JSON.parse(kept); delete noNode.node;
    fs.writeFileSync(iconsJson, JSON.stringify(noNode, null, 2));
    await door('app.active', { key: 'icons', active: false });
    await sleep(WAIT_MS);
    await door('app.active', { key: 'icons', active: true });
    ok(await until(function () { return branches().then(function (b) { return b.indexOf('icons') !== -1; }); }, 10000), 'with node mount missing, icons is served', 'with node mount missing, the tree holds no icons: ' + short(await branches()));
    fs.writeFileSync(iconsJson, kept);

    test.subHeading('the attacker: what is not a one-shot app is never run as one');
    const notOneShot = async function (name, files, why) {
      const dir = path.join(run, 'spirit', 'app', name);
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
      ok(!/^2/.test(String(c.status)) && (await branches()).indexOf(name) === -1, why + ': it is not served', why + ': ' + name + '.zz answered ' + c.status + ' ' + short(c.text));
      ok(!fs.existsSync(mark(name)), why + ': and its script never ran', why + ': ITS SCRIPT RAN, its marker is on the disc');
    };
    await notOneShot('zzNoData', { api: true, data: false }, 'an app with api.js and no data.js');
    await notOneShot('zzNoApi', { api: false, data: true }, 'an app with data.js and no api.js');
    await notOneShot('zzOff', { api: true, data: true, on: false }, 'an app with both, never switched on');
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
