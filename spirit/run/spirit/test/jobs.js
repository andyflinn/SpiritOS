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
const { scratchNode, sleep } = require(path.join(RUN, 'test', 'headLessChrome.js'));

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
    // A fix that closes these closes the node: the review's own wording names <name>/<name>.js; desk.js:2589 and
    // deskClient.js:535 start a helper beside it the same way, by this node's executable and its whole path.
    plant('process/js/zzIncluded/zzIncluded.js', mark('included'));
    fs.writeFileSync(path.join(run, 'process/js/zzIncluded/zzIncluded.json'), JSON.stringify({ label: 'zz' }));
    const state = path.join(run, 'relay-state', 'process', 'zzIncluded');
    fs.mkdirSync(state, { recursive: true });
    fs.writeFileSync(path.join(state, 'zzIncluded.js.sidecar.json'), JSON.stringify({ face: { home: true } }));
    const inc = await call({ command: process.execPath, args: ['process/js/zzIncluded/zzIncluded.js'] });
    await sleep(WAIT_MS);
    ok(inc.status === 201 && fs.existsSync(mark('included')), 'an included process/js/<name>/<name>.js starts', 'an included process: answered ' + inc.status + ' ' + short(inc.text) + ', ran ' + fs.existsSync(mark('included')));
    const helper = plant('process/js/desk/zzHelper.js', mark('helper'));
    // THE FILE VIEWER'S START JOB SENDS PLAIN node (shell/js/textViewer.js:55): it names this node's own executable.
    const plainNode = await call({ command: 'node', args: ['process/js/zzIncluded/zzIncluded.js'] });
    ok(plainNode.status >= 200 && plainNode.status < 300, 'plain node with an included process starts, as Start Job sends it', 'node with an included process answered ' + plainNode.status + ' ' + String(plainNode.text || '').slice(0, 160));
    const help = await call({ command: process.execPath, args: [helper] });
    await sleep(WAIT_MS);
    ok(help.status === 201 && fs.existsSync(mark('helper')), 'a helper in an included process\'s folder starts, as desk.js:2589 and deskClient.js:535 start theirs', 'a helper of an included process: answered ' + help.status + ' ' + short(help.text) + ', ran ' + fs.existsSync(mark('helper')));
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
