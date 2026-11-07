'use strict';

// spirit/run/spirit/test/jobs.js
// The tests of spirit/jobs.js, and of no other module (spec: ./jobs.md). This file holds goal/G41.30, the review's RH1:
// "jobs.create still spawns any program"; its fix: "in startJob, refuse unless command is process.execPath and args[0]
// resolves to an included process/js/<name>/<name>.js"; Andy, Q3: "yes.". Raw calls over http to a scratch node's door,
// no spirit object; neither Andy's node nor an agent's is touched. Each thing asked to run would write a marker of its
// own, so "it ran" is read from the disk, not from the answer.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode, sleep, until } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 200); }
const WAIT_MS = 1500;

test.startTest('jobs.js: jobs.create starts this node\'s processes, and no other program (goal/G41.30, RH1)');

(async function () {
  const marks = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-jobs-marks-'));
  const node = await scratchNode({ servers: ['desk'] });
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const run = path.join(node.root, 'spirit', 'run');
    const call = async function (args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'jobs.create', args: args }) });
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
    await refusedCase('a script outside process/js', mark('outside'), { command: process.execPath, args: [outside] });
    plant('zz-climbed.js', mark('climbed'));
    await refusedCase('a path climbing out of process/js', mark('climbed'), { command: process.execPath, args: ['process/js/desk/../../../zz-climbed.js'] });
    plant('process/js/zzNotIncluded/zzNotIncluded.js', mark('notIncluded'));
    fs.writeFileSync(path.join(run, 'process/js/zzNotIncluded/zzNotIncluded.json'), JSON.stringify({ label: 'zz' }));
    await refusedCase('a process this node does not include', mark('notIncluded'), { command: process.execPath, args: ['process/js/zzNotIncluded/zzNotIncluded.js'] });

    test.subHeading('what this node may start still starts');
    // A fix that closes these closes the node: the review's own wording names <name>/<name>.js; the desk starts a helper
    // beside it the same way (goalShare.js, desk.js:2624), by this node's executable and its whole path. deskClient
    // starts no helper any more; the check's text below still names its old line.
    plant('process/js/zzIncluded/zzIncluded.js', mark('included'));
    fs.writeFileSync(path.join(run, 'process/js/zzIncluded/zzIncluded.json'), JSON.stringify({ label: 'zz' }));
    const state = path.join(run, 'relay-state', 'process', 'zzIncluded');
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, 'zzIncluded.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
    const inc = await call({ command: process.execPath, args: ['process/js/zzIncluded/zzIncluded.js'] });
    await sleep(WAIT_MS);
    ok(inc.status === 201 && fs.existsSync(mark('included')), 'an included process/js/<name>/<name>.js starts', 'an included process: answered ' + inc.status + ' ' + short(inc.text) + ', ran ' + fs.existsSync(mark('included')));
    const helper = plant('process/js/desk/zzHelper.js', mark('helper'));
    // A PAGE SENDS PLAIN node (the app detail's run, spirit/app/appSelector/detailElement.js:68; the file viewer that sent it
    // too, spirit/element/textViewer.js, is deleted): jobs.js reads it as this node's own executable.
    const plainNode = await call({ command: 'node', args: ['process/js/zzIncluded/zzIncluded.js'] });
    ok(plainNode.status >= 200 && plainNode.status < 300, 'plain node with an included process starts, as Start Job sends it', 'node with an included process answered ' + plainNode.status + ' ' + String(plainNode.text || '').slice(0, 160));
    const help = await call({ command: process.execPath, args: [helper] });
    await sleep(WAIT_MS);
    ok(help.status === 201 && fs.existsSync(mark('helper')), 'a helper in an included process\'s folder starts, as desk.js:2589 and deskClient.js:535 start theirs', 'a helper of an included process: answered ' + help.status + ' ' + short(help.text) + ', ran ' + fs.existsSync(mark('helper')));

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
      const f = path.join(run, 'process/js', name, name + '.js');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, tail);
      fs.writeFileSync(path.join(run, 'process/js', name, name + '.json'), JSON.stringify({ label: 'zz' }));
      const st = path.join(run, 'relay-state', 'process', name);
      fs.mkdirSync(st, { recursive: true });
      fs.writeFileSync(path.join(st, name + '.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
    };
    const finished = async function (id) {
      let job = null;
      await until(function () { return door('jobs.get', { key: id }).then(function (a) { job = a.body && (a.body.job || a.body); return !!(job && job.status && job.status !== 'running' && job.status !== 'pending'); }); }, 15000);
      return job;
    };
    const logText = function (job) { return JSON.stringify((job && job.log) || []); };
    const start = async function (name) {
      const a = await door('jobs.create', { command: process.execPath, args: ['process/js/' + name + '/' + name + '.js'] });
      return a.status === 201 && a.body && a.body.id ? a.body.id : '';
    };
    // A process job that completes deletes itself (jobs.js:120), so each here ends with an exit code of its own and stays to be read.
    const PUBLISH = 'const u = process.env.SPIRIT_CALLBACK_URL, id = process.env.SPIRIT_JOB_ID;'
      + 'fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ call: "events.publish", args: { id: id, logMessage: "zzPublishedLine" } }) })';
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
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
