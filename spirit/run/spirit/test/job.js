'use strict';

// spirit/run/spirit/test/job.js
// The tests of spirit/job.js, and of no other module, in this one file (spec: ./job.md). Its sections, after its own
// checks: a job's id is a route, what spirit/state/<name>/ holds, and the vendored libraries. Since goal/G43.19 it holds the one-shot apps the node
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
      return { refused: a.status >= 400 && a.status < 500 && typeof a.code === 'string' && !!a.code, refusedWhy: name + ': answered ' + a.status + ' ' + short(a.text), ran: ran, ranWhy: name + ': IT RAN, its marker is on the disk' };
    };
    let rc;

    test.subHeading('another program is refused, and never runs');
    rc = await refusedCase('/bin/sh with a command line', mark('sh'), { command: '/bin/sh', args: ['-c', 'echo pwned > ' + mark('sh')] }); ok(rc.refused, 'refused with a code: /bin/sh with a command line', rc.refusedWhy); ok(!rc.ran, 'and it never ran: /bin/sh with a command line', rc.ranWhy);
    rc = await refusedCase('sh, found on the path', mark('sh2'), { command: 'sh', args: ['-c', 'echo pwned > ' + mark('sh2')] }); ok(rc.refused, 'refused with a code: sh, found on the path', rc.refusedWhy); ok(!rc.ran, 'and it never ran: sh, found on the path', rc.ranWhy);
    rc = await refusedCase('this node\'s own executable given code to run (-e)', mark('dashE'), { command: process.execPath, args: ['-e', script(mark('dashE'))] }); ok(rc.refused, 'refused with a code: this node\'s own executable given code to run (-e)', rc.refusedWhy); ok(!rc.ran, 'and it never ran: this node\'s own executable given code to run (-e)', rc.ranWhy);

    test.subHeading('this node\'s executable, on a script that is not its process, is refused');
    const outside = path.join(marks, 'outside.js');
    fs.writeFileSync(outside, script(mark('outside')));
    rc = await refusedCase('a script outside spirit/app', mark('outside'), { command: process.execPath, args: [outside] }); ok(rc.refused, 'refused with a code: a script outside spirit/app', rc.refusedWhy); ok(!rc.ran, 'and it never ran: a script outside spirit/app', rc.ranWhy);
    plant('zz-climbed.js', mark('climbed'));
    rc = await refusedCase('a path climbing out of spirit/app', mark('climbed'), { command: process.execPath, args: ['spirit/app/desk/../../../zz-climbed.js'] }); ok(rc.refused, 'refused with a code: a path climbing out of spirit/app', rc.refusedWhy); ok(!rc.ran, 'and it never ran: a path climbing out of spirit/app', rc.ranWhy);
    plant('spirit/app/zzNotRun/zzNotRun.js', mark('notRun'));
    fs.writeFileSync(path.join(run, 'spirit/app/zzNotRun/zzNotRun.json'), JSON.stringify({ identity: { label: 'zz' } }));
    rc = await refusedCase('an app whose json does not say node run true', mark('notRun'), { command: process.execPath, args: ['spirit/app/zzNotRun/zzNotRun.js'] }); ok(rc.refused, 'refused with a code: an app whose json does not say node run true', rc.refusedWhy); ok(!rc.ran, 'and it never ran: an app whose json does not say node run true', rc.ranWhy);

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
    rc = await refusedCase("a second script in a node run app's folder", mark('helper'), { command: process.execPath, args: [helper] }); ok(rc.refused, 'refused with a code: a second script in a node run app\'s folder', rc.refusedWhy); ok(!rc.ran, 'and it never ran: a second script in a node run app\'s folder', rc.ranWhy);

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
      ok(!!j && said1.indexOf('zzOutLine') === -1, 'not in the job\'s log: zzOutLine', 'zzOutLine is in the job\'s log with DEBUG off: ' + short(said1));
      ok(!!j && said1.indexOf('zzErrLine') === -1, 'not in the job\'s log: zzErrLine', 'zzErrLine is in the job\'s log with DEBUG off: ' + short(said1));
      ok(!!j && said1.indexOf('zzRawOut') === -1, 'not in the job\'s log: zzRawOut', 'zzRawOut is in the job\'s log with DEBUG off: ' + short(said1));
      ok(!!j && said1.indexOf('zzRawErr') === -1, 'not in the job\'s log: zzRawErr', 'zzRawErr is in the job\'s log with DEBUG off: ' + short(said1));
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
      ok(said4.indexOf('zzOutLine') !== -1, 'with DEBUG on, in the log: zzOutLine', 'with DEBUG on, zzOutLine is not in the job\'s log: ' + short(said4));
      ok(said4.indexOf('zzErrLine') !== -1, 'with DEBUG on, in the log: zzErrLine', 'with DEBUG on, zzErrLine is not in the job\'s log: ' + short(said4));
    }

    // ── ONE-SHOT APPS, REGISTERED BY THE NODE (goal/G43.19, box v16) ──
    // The box, 2: "a one-shot app is an app with api.js and data.js at its top, node mount false or missing, and switched
    // on. icons is the first."; 4: "the node registers each one-shot app where it reads the manifests and starts the
    // permanent ones ... Switched off, its row goes, and a call to it answers app-not-served". Each thing that would run
    // writes a marker, so "it ran" is read from the disc.
    test.subHeading('the box, 4: a one-shot app switched on at boot is registered with the permanent ones');
    let iconVerbs = [];
    try { iconVerbs = Object.keys(require(path.join(run, 'spirit', 'app', 'icons', 'api.js')).verbs || {}); } catch (e) { iconVerbs = []; }
    ok(iconVerbs.length >= 1, 'the world: icons\'s api.js names its verbs', 'icons has no api.js with verbs: no one-shot app to judge');
    const branches = async function () { const t = await door('api', {}); return t.status === 200 && t.body ? Object.keys(t.body) : []; };
    ok((await branches()).indexOf('icons') !== -1, 'icons, on in its node.json at boot, is in the api tree with no app.active asked', 'the tree at boot: ' + short(await branches()));
    ok((await branches()).indexOf('desk') !== -1, 'and desk, a permanent server, beside it', 'the tree lost desk: ' + short(await branches()));

    test.subHeading('the box, 4: "Switched off, its row goes, and a call to it answers app-not-served"; on again, it is back');
    ok((await door('app.active', { key: 'icons', active: false })).status === 200, 'the world: icons switched off', 'app.active icons false was refused');
    await sleep(WAIT_MS);
    const offCall = iconVerbs.length ? await door('icons.' + iconVerbs[0], {}) : { text: '' };
    ok(/app-not-served/.test(offCall.text), 'switched off, icons.icon answers app-not-served', 'switched off, it answered ' + offCall.status + ' ' + short(offCall.text));
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
      const served = !/^2/.test(String(c.status)) && (await branches()).indexOf(name) === -1;
      return { notServed: served, notServedWhy: why + ': ' + name + '.zz answered ' + c.status + ' ' + short(c.text), neverRan: !fs.existsSync(mark(name)), neverRanWhy: why + ': ITS SCRIPT RAN, its marker is on the disc' };
    };
    let no;
    no = await notOneShot('zzNoData', { api: true, data: false }, 'an app with api.js and no data.js'); ok(no.notServed, 'an app with api.js and no data.js: it is not served', no.notServedWhy); ok(no.neverRan, 'an app with api.js and no data.js: and its script never ran', no.neverRanWhy);
    no = await notOneShot('zzNoApi', { api: false, data: true }, 'an app with data.js and no api.js'); ok(no.notServed, 'an app with data.js and no api.js: it is not served', no.notServedWhy); ok(no.neverRan, 'an app with data.js and no api.js: and its script never ran', no.neverRanWhy);
    no = await notOneShot('zzOff', { api: true, data: true, on: false }, 'an app with both, never switched on'); ok(no.notServed, 'an app with both, never switched on: it is not served', no.notServedWhy); ok(no.neverRan, 'an app with both, never switched on: and its script never ran', no.neverRanWhy);
  } finally {
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { fs.rmSync(marks, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(null, function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  .then(runParts)
  .then(function () { test.reportSuccessFailureCount(); process.exit(0); });

// The sections below, each folded in from a file of its own, run in order after the checks above.
async function runParts() {
  const parts = [['routes', routesPart], ['stateLayout', stateLayoutPart], ['vendoredLibraries', vendoredLibrariesPart]];
  for (const p of parts) {
    try { await p[1](); } catch (e) { test.fail('the ' + p[0] + ' part threw ' + (e && e.stack || e)); }
  }
}

async function routesPart() {
  // ── THE ROUTES PART ──
  // A JOB'S ID IS A ROUTE (goal/G43.20, its box; spec: ./job.md, its section). Andy: "they're
  // supposed to identify a "route" in the spirit-tree, NOT some invented number.", "ALL job id's will be routes to either a
  // node supplied api (spirit.fs, etc...) or an app supplied id (spirit.app.<name>)", "a job cannot start if it is already
  // running", and "cw, box that only jobs in the app folder with node:run:true can be started with jobs.create". A real node on
  // a scratch copy of the tracked files; throwaway apps are planted in that copy, nothing kept in the repo. Never a live node.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  const ROUTE = /^spirit(\.[A-Za-z][A-Za-z0-9]*)*$/;
  // The node's own jobs, once each (Q1, Q2 and the box): the node's events, its files, its apps, its contacts, its auth.
  const OWN = ['spirit', 'spirit.app', 'spirit.auth', 'spirit.contact', 'spirit.fs'];

  // A throwaway app of spirit/app/<name>/: its script waits ms and ends; run true makes it a run app (node run true).
  function plant(run, name, ms, nodeRun) {
    const dir = path.join(run, 'spirit', 'app', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ identity: { icon: '🧪', label: name, intrinsic: false }, node: nodeRun ? { mount: false, run: true } : { mount: false } }));
    fs.writeFileSync(path.join(dir, name + '.js'), 'setTimeout(function () {}, ' + ms + ');\n');
  }

  test.subHeading('routes: every job id is a route in the spirit tree, one job per id, and job.create starts only a run app (goal/G43.20)');

  await (async function () {
    const node = await H.scratchNode();
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const ask = function (call, args) {
      return fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
        .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
    };
    const run = path.join(node.root, 'spirit', 'run');
    try {
      const on = await ask('app.active', { key: 'desk', active: true });
      ok(on.status === 200, 'the world: desk, an app server, is switched on', 'app.active desk: ' + short(on));
      await H.sleep(5000);
      const list = await ask('job.search', { q: '' });
      const ids = ((list.body && list.body.items) || []).map(function (i) { return String(i.key); });
      ok(ids.length >= 5, 'the world: the node lists five or more jobs', 'job.search: ' + short(list));

      test.subHeading('"ALL job id\'s will be routes": spirit.fs, spirit.app.<name>, never an invented number');
      const minted = ids.filter(function (id) { return /^job_\d+$/.test(id); });
      ok(!minted.length, 'no job id is a minted number, job_<n>', minted.length + ' are: ' + short(minted));
      const notRoutes = ids.filter(function (id) { return !ROUTE.test(id); });
      ok(ids.length > 0 && !notRoutes.length, 'every job id is a route: spirit, then names, dot by dot', 'not a route: ' + short(notRoutes));
      ok(ids.indexOf('spirit.app.desk') !== -1, 'an app server\'s job is its route, spirit.app.desk', 'ids: ' + short(ids));

      test.subHeading('one job per family (Q1, Q2): the node\'s own jobs are spirit, spirit.fs, spirit.app, spirit.contact, spirit.auth');
      const own = [];
      for (const id of ids) {
        const g = await ask('job.get', { key: id });
        const job = (g.body && g.body.job) || {};
        // The node's own: its permanent jobs, never a server's or a process's run.
        if (job.kind === 'permanent') own.push({ id: id, job: job });
      }
      const ownIds = own.map(function (o) { return o.id; }).sort();
      ok(JSON.stringify(ownIds) === JSON.stringify(OWN), 'the node\'s own jobs are exactly spirit, spirit.app, spirit.auth, spirit.contact and spirit.fs: contacts, presence and peer search in one, the app list and app faces in one, stats and join steps under spirit',
        'the node\'s own jobs: ' + short(ownIds));
      ok(own.length > 0 && own.every(function (o) { return o.id.split('.').length <= 2; }), 'the node\'s own ids have at most two parts', 'own: ' + short(ownIds));
      const typed = own.filter(function (o) { return Object.prototype.hasOwnProperty.call(o.job, 'type'); });
      ok(own.length > 0 && !typed.length, 'a job has no type field any more: the id says what it is', typed.length + ' still carry a type: ' + short(typed.map(function (o) { return o.id + ':' + o.job.type; })));

      test.subHeading('"only jobs in the app folder with node:run:true can be started with job.create"');
      plant(run, 'zzRun', 4000, true);
      plant(run, 'zzMount', 4000, false);
      fs.mkdirSync(path.join(run, 'scratchScripts'), { recursive: true });
      fs.writeFileSync(path.join(run, 'scratchScripts', 'zzOther.js'), 'setTimeout(function () {}, 100);\n');
      const other = await ask('job.create', { command: process.execPath, args: [path.join(run, 'scratchScripts', 'zzOther.js')] });
      ok(other.status >= 400, 'another script, in no app folder, is refused', 'job.create answered ' + short(other));
      const mount = await ask('job.create', { command: process.execPath, args: [path.join(run, 'spirit', 'app', 'zzMount', 'zzMount.js')] });
      ok(mount.status >= 400, 'an app\'s script whose json has no node run is refused', 'job.create answered ' + short(mount));
      const command = await ask('job.create', { command: 'git', args: ['status'] });
      ok(command.status >= 400, 'another command is refused', 'job.create answered ' + short(command));
      const runApp = path.join(run, 'spirit', 'app', 'zzRun', 'zzRun.js');
      const first = await ask('job.create', { command: process.execPath, args: [runApp] });
      const firstId = first.body && (first.body.id || first.body.key);
      ok(first.status >= 200 && first.status < 300 && firstId === 'spirit.app.zzRun', 'a run app\'s own script starts, under its route spirit.app.zzRun', 'job.create answered ' + short(first));

      test.subHeading('"a job cannot start if it is already running" (Q3), pending counting as running');
      const second = await ask('job.create', { command: process.execPath, args: [runApp] });
      ok(second.status >= 400 && /already running/.test(JSON.stringify(second.body || '')), 'a second start while it runs is refused, "already running"', 'job.create answered ' + short(second));
      await H.sleep(5000);
      const both = await Promise.all([ask('job.create', { command: process.execPath, args: [runApp] }), ask('job.create', { command: process.execPath, args: [runApp] })]);
      const taken = both.filter(function (r) { return r.status >= 200 && r.status < 300; });
      ok(taken.length === 1, 'two starts at once: one gets in, the other is refused (the pending one counts as running)', 'answers: ' + short(both.map(function (r) { return r.status; })));

      test.subHeading('"a new run takes the id over and runs on"');
      const again = taken[0] ? (taken[0].body && (taken[0].body.id || taken[0].body.key)) : '';
      const g = await ask('job.get', { key: 'spirit.app.zzRun' });
      ok(again === 'spirit.app.zzRun' && ((g.body && g.body.job) || {}).status === 'running', 'after its run ended, a new run is the same id, spirit.app.zzRun, running again', 'id ' + short(again) + ', job ' + short(g.body));

      // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code").
      test.subHeading('the attacker: ten starts at once, and a start right after a cancel');
      await H.sleep(4500);
      const ten = await Promise.all(Array.from({ length: 10 }, function () { return ask('job.create', { command: process.execPath, args: [runApp] }); }));
      const tenIn = ten.filter(function (r) { return r.status >= 200 && r.status < 300; });
      ok(tenIn.length === 1, 'ten starts at the same moment: exactly one gets in', tenIn.length + ' got in: ' + short(ten.map(function (r) { return r.status; })));
      const cancelled = await ask('job.cancel', { id: 'spirit.app.zzRun' });
      await H.sleep(800);
      const afterCancel = await ask('job.create', { command: process.execPath, args: [runApp] });
      ok(cancelled.status >= 200 && cancelled.status < 300 && afterCancel.status >= 200 && afterCancel.status < 300 && (afterCancel.body || {}).id === 'spirit.app.zzRun',
        'cancelled, its next start takes the same id over', 'cancel ' + short(cancelled) + ', start ' + short(afterCancel));
      await ask('job.cancel', { id: 'spirit.app.zzRun' });

      test.subHeading('the attacker: a run app\'s route reached by a crooked path, a link, a second script, a json that only looks right');
      const app = function (n) { return path.join(run, 'spirit', 'app', n); };
      // A second script in the run app's own folder (the box: "A second script in an app folder is therefore never started").
      fs.writeFileSync(path.join(app('zzRun'), 'other.js'), 'setTimeout(function () {}, 100);\n');
      // "run": "true", a string, not true.
      plant(run, 'zzString', 4000, false);
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
        const r = await ask('job.create', { command: process.execPath, args: c[1] });
        if (!(r.status >= 400)) gotIn.push(c[0] + ': ' + r.status + ' ' + short((r.body || {}).id));
        if (r.body && r.body.id) await ask('job.cancel', { id: String(r.body.id) });
      }
      ok(!gotIn.length, 'all the crooked ones are refused', gotIn.length + ' got in: ' + short(gotIn));
      const shell = await ask('job.create', { command: '/bin/sh', args: [runApp] });
      ok(shell.status >= 400, 'the run app\'s script under another command (/bin/sh) is refused', 'job.create answered ' + short(shell));

      test.subHeading('the attacker: ids that are no route, asked of job.get and job.cancel');
      const bad = ['..', '../spirit', '__proto__', 'constructor', 'spirit.app.', 'spirit..fs', 'spirit.fs/../..', '', 'job_1', 'spirit.app.zzRun.extra'];
      const crashed = [];
      for (const id of bad) {
        const a = await ask('job.get', { key: id });
        const b = await ask('job.cancel', { id: id });
        if (a.status === 0 || b.status === 0 || a.status >= 500 || b.status >= 500) crashed.push(id + ' ' + a.status + '/' + b.status);
        else if (a.status < 300 && a.body && a.body.job) crashed.push(id + ' found a job');
      }
      ok(!crashed.length, 'each is answered as no job, nothing found, nothing crashed', short(crashed));
      const still = await ask('api', {});
      ok(still.status === 200, 'and the node still answers after all of it', 'api answered ' + still.status);
    } catch (e) {
      test.fail('the suite threw ' + (e && e.stack || e));
    } finally {
      if (node.child) node.child.kill();
    }
  }());
}

async function stateLayoutPart() {
  // ── THE STATE LAYOUT PART ──
  // WHAT spirit/state/<name>/ HOLDS (goal/G43.20, its box; spec: ./job.md, its section).
  // job.js makes each app's folder and starts its server. Andy: "WSL, YOU BETTER MAKE FUCKING SURE YOU GUARD FUCKING
  // spirit/state/<name>/ and the rules relating to where things belong in that folder, AND you better not fucking cheat with
  // the fucking tests!!!!!!!!!!!!!!!!!!!!", "put those in spirit/state/<name>/ since they belong to the node.", "cache, which is
  // written by spirit/appServer.js was ALWAYS supposed to go into spirit/state/<name>/cache/", "app data, which is written by
  // the app, was ALWAYS supposed to go into spirit/state/<name>/data/". A real node on a scratch copy of the tracked files,
  // with no run:/process folder in it, the tree's app servers switched on. Never a live node.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  // What an app's folder of the node's state may hold (the box, "spirit/state/<name>/ holds node.json, cache/, data/, and on
  // Linux door.sock"; Andy: "so far, so good.").
  const MAY = ['node.json', 'cache', 'data'].concat(process.platform === 'win32' ? [] : ['door.sock']);
  // The tree's app servers, each switched on: every app folder whose <name>.json says node.mount true, read from the folders
  // (Andy: "where is the test that verifies that an app who claims to be mountable, ACTUALLY can be mounted?"), so a new one
  // is judged the day it lands.
  const APPS = path.join(REPO, 'spirit', 'run', 'spirit', 'app');
  const SERVERS = fs.readdirSync(APPS).filter(function (n) {
    try { const j = JSON.parse(fs.readFileSync(path.join(APPS, n, n + '.json'), 'utf8')); return !!(j.node && j.node.mount === true); } catch (e) { return false; }
  });

  test.subHeading('stateLayout: spirit/state/<name>/ holds node.json, cache/, data/ and door.sock, and nothing else; no relay-state, no process (goal/G43.20)');

  await (async function () {
    // A scratch copy of the tracked files, its run:/process taken out before the node starts.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-state-layout-'));
    execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
      .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    const run = path.join(root, 'spirit', 'run');
    fs.rmSync(path.join(run, 'process'), { recursive: true, force: true });
    fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
    const port = await H.freePort();
    let child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const ask = function (call, args) {
      return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: call, args: args || {} }) })
        .then(function (r) { return r.json().then(function (b) { return { status: r.status, body: b }; }, function () { return { status: r.status, body: null }; }); }, function (e) { return { status: 0, body: String(e) }; });
    };
    try {
      const up = await H.until(function () { return ask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
      ok(!!up, 'the world: the node starts on a tree with no run:/process folder', 'the node did not come up with no run:/process');
      if (!up) return;

      test.subHeading('the node starts its apps with no process/ folder');
      for (const name of SERVERS) await ask('app.active', { key: name, active: true });
      ok(SERVERS.length >= 1, 'the world: there are apps that say node.mount true', 'no app folder says node.mount true: nothing to judge');
      for (const name of SERVERS) {
        const a = await H.until(function () { return ask('api', { family: name }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
        const answersWhy = name + ' says node.mount true and never answered its api: ' + short(await ask('api', { family: name }));
        if (name === 'agent') ok(!!a, 'agent says node.mount true, starts, and answers its api', answersWhy);
        else if (name === 'backup') ok(!!a, 'backup says node.mount true, starts, and answers its api', answersWhy);
        else if (name === 'chat') ok(!!a, 'chat says node.mount true, starts, and answers its api', answersWhy);
        else if (name === 'desk') ok(!!a, 'desk says node.mount true, starts, and answers its api', answersWhy);
        else if (name === 'deskClient') ok(!!a, 'deskClient says node.mount true, starts, and answers its api', answersWhy);
        else if (name === 'deskVerify') ok(!!a, 'deskVerify says node.mount true, starts, and answers its api', answersWhy);
      }
      await H.sleep(3000);

      test.subHeading('spirit/state/<name>/ holds node.json, cache/, data/ and on Linux door.sock, nothing else');
      const state = path.join(run, 'spirit', 'state');
      const folders = fs.readdirSync(state).filter(function (n) { return fs.statSync(path.join(state, n)).isDirectory(); });
      ok(SERVERS.every(function (n) { return folders.indexOf(n) !== -1; }), 'the world: each app switched on has its folder in spirit/state/', 'folders: ' + short(folders));
      folders.forEach(function (n) {
        const extra = fs.readdirSync(path.join(state, n)).filter(function (e) { return MAY.indexOf(e) === -1; });
        test.subHeading('spirit/state/' + n + '/');
        ok(!extra.length, 'it holds only node.json, cache/, data/ and on Linux door.sock', 'spirit/state/' + n + '/ also holds ' + short(extra));
      });
      test.subHeading('each app server\'s door');
      if (process.platform !== 'win32') {
        const sockets = SERVERS.filter(function (n) { return fs.existsSync(path.join(state, n, 'door.sock')); });
        ok(sockets.length === SERVERS.length, 'each app server\'s door.sock is spirit/state/<name>/door.sock', 'sockets there: ' + short(sockets));
      }

      test.subHeading('an app\'s data in spirit/state/<name>/data/: the folder the node hands it as --state');
      const handed = [];
      const list = await ask('job.search', { q: '' });
      for (const it of ((list.body && list.body.items) || [])) {
        const g = await ask('job.get', { key: it.key });
        const job = (g.body && g.body.job) || {};
        const args = (job.data && job.data.args) || job.args || [];
        const i = args.indexOf('--state');
        if (i !== -1) handed.push(path.relative(run, String(args[i + 1])).split(path.sep).join('/'));
      }
      const wrong = handed.filter(function (p) { return !/^spirit\/state\/[^/]+\/data$/.test(p); });
      ok(handed.length >= SERVERS.length && !wrong.length, 'every server is handed spirit/state/<name>/data as its --state', 'handed: ' + short(handed));

      test.subHeading('no relay-state, no process: nothing of the node lives anywhere else');
      ok(!fs.existsSync(path.join(run, 'relay-state')), 'no spirit/run/relay-state/ is made', 'the node made spirit/run/relay-state/: ' + short(fs.existsSync(path.join(run, 'relay-state')) ? fs.readdirSync(path.join(run, 'relay-state')) : []));
      ok(!fs.existsSync(path.join(run, 'process')), 'no spirit/run/process/ is made', 'the node made spirit/run/process/');

      // THE ATTACKER (rule/27: "tests MUST be "the enemy, the attacker" an try everything conceivable to break the code"): the
      // layout must hold through what a node lives through, and no name may make a folder of the node's state elsewhere.
      let lh;
      const layoutHolds = function (when) {
        const bad = [];
        fs.readdirSync(state).filter(function (n) { return fs.statSync(path.join(state, n)).isDirectory(); }).forEach(function (n) {
          fs.readdirSync(path.join(state, n)).filter(function (e) { return MAY.indexOf(e) === -1; }).forEach(function (e) { bad.push(n + '/' + e); });
        });
        if (fs.existsSync(path.join(run, 'relay-state'))) bad.push('run:/relay-state');
        if (fs.existsSync(path.join(run, 'process'))) bad.push('run:/process');
        return { holds: !bad.length, why: when + ': out of place: ' + short(bad) };
      };
      test.subHeading('the attacker: an app switched off and on again');
      await ask('app.active', { key: 'backup', active: false });
      await H.sleep(2000);
      await ask('app.active', { key: 'backup', active: true });
      await H.until(function () { return ask('api', { family: 'backup' }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
      lh = layoutHolds('backup switched off and on'); ok(lh.holds, 'backup switched off and on: the layout holds, nothing out of place', lh.why);

      test.subHeading('the attacker: the node killed and started again on the same tree');
      try { child.kill('SIGKILL'); } catch (e) { /* gone */ }
      await H.sleep(1500);
      child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
      const back = await H.until(function () { return ask('api', {}).then(function (r) { return r.status === 200; }); }, 60000);
      ok(!!back, 'the node comes back after a kill', 'the node did not come back');
      const again = [];
      for (const name of SERVERS) {
        const a = await H.until(function () { return ask('api', { family: name }).then(function (r) { return r.status === 200 && !!r.body && typeof r.body.interface === 'string'; }); }, 30000);
        if (a) again.push(name);
      }
      ok(again.length === SERVERS.length, 'and every app server switched on starts again', 'answering after the restart: ' + short(again));
      lh = layoutHolds('after a kill and a restart'); ok(lh.holds, 'after a kill and a restart: the layout holds, nothing out of place', lh.why);

      test.subHeading('the attacker: names that would put the node\'s state elsewhere');
      const evil = ['..', '../..', 'relay-state', 'process', '../relay-state', 'desk/../../x', '.', '', 'con', 'desk/', 'a b', '__proto__'];
      const took = [];
      for (const k of evil) {
        const r = await ask('app.active', { key: k, active: true });
        if (r.status >= 200 && r.status < 300 && r.body && r.body.ok !== false) took.push(k);
      }
      ok(!took.length, 'app.active refuses every name of no app', 'taken: ' + short(took));
      await H.sleep(2000);
      const outside = fs.readdirSync(run).filter(function (n) { return ['relay-state', 'process', 'x'].indexOf(n) !== -1; });
      ok(!outside.length, 'and no folder appeared at the run root', 'made: ' + short(outside));
      lh = layoutHolds('after the bad names'); ok(lh.holds, 'after the bad names: the layout holds, nothing out of place', lh.why);

      test.subHeading('the attacker: an app\'s folder taken away while it runs');
      fs.rmSync(path.join(run, 'spirit', 'app', 'backup'), { recursive: true, force: true });
      await H.sleep(4000);
      const alive = await ask('api', {});
      ok(alive.status === 200, 'the node still answers with backup\'s folder gone under it', 'api answered ' + alive.status);
      lh = layoutHolds('backup\'s app folder gone'); ok(lh.holds, 'backup\'s app folder gone: the layout holds, nothing out of place', lh.why);
    } catch (e) {
      test.fail('the suite threw ' + (e && e.stack || e));
    } finally {
      try { child.kill(); } catch (e) { /* gone */ }
      await H.sleep(500);
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

async function vendoredLibrariesPart() {
  // ── THE VENDORED LIBRARIES PART ──
  // NO run://node_modules/: chokidar and readdirp in spirit/job/ (goal/G43.25; spec: ./job.md, its section). Andy: "can we
  // hide those suckers in spirit/jobs/ for now? without the damn node_modules container?". The two libraries sit in spirit/job/,
  // job.js's own folder, and job.js is the user that brings them: they move whole, chokidar finds readdirp by path, job.js
  // requires it by path, its fs-watcher job works as before, nothing names spirit/run/node_modules. deskClient's use is
  // spirit/app/deskClient/test/deskClient.js, its chokidar part; fileSystem.js's one list of vendored folders is
  // ./fileSystem.js, its vendoredFolders part. The tree read as it is; the watcher run in a child process on a scratch folder.

  const fs = require('fs');
  const path = require('path');
  const { execSync, spawnSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  // The tree before the move: the commit the red was written on, which holds spirit/run/node_modules/.
  const BASE = '2fb29140';
  const OLD = 'spirit/run/node_modules/';
  const NEW = 'spirit/run/spirit/job/';
  const VENDORED = ['spirit/job/chokidar', 'spirit/job/readdirp', 'spirit/element/codeMirror'];
  // The suites that name the old folder on purpose, left out of the scan (5): this one, job.js, and fileSystem's and
  // deskClient's, by the names they had and the one test file each is folded into.
  const SELF = /spirit\/run\/spirit\/test\/(job|job-vendoredLibraries|fileSystem|fileSystem-vendoredFolders)\.(js|md)$|spirit\/run\/spirit\/app\/deskClient\/test\/(deskClient|deskClient-chokidar)\.(js|md)$/;

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  function git(args) { return execSync('git ' + args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  function code(text) { return String(text).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1'); }
  function trim(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '').replace(/\/+$/, ''); }

  test.subHeading('vendoredLibraries: chokidar and readdirp in spirit/job/, no run://node_modules (goal/G43.25)');

  test.subHeading('the world');
  const before = git('ls-tree -r --name-only ' + BASE + ' -- ' + OLD).split('\n').filter(Boolean);
  ok(before.length === 12 && before.indexOf(OLD + 'chokidar/index.js') !== -1 && before.indexOf(OLD + 'readdirp/index.js') !== -1,
    'the world: the base commit holds the 12 files of spirit/run/node_modules/ (chokidar and readdirp)', BASE + ' holds ' + before.length + ' files there: nothing to compare with');
  const tracked = git('ls-files').split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
  ok(tracked.length > 100, 'the world: more than a hundred tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');

  test.subHeading('1. both folders move whole to spirit/job/, spirit/run/node_modules/ is gone');
  // Each of the twelve written out, so that each check has a plain title of its own.
  const movedWhole = function (rel) {
    const f = OLD + rel;
    const to = NEW + f.slice(OLD.length);
    const there = fs.existsSync(path.join(REPO, to)) && tracked.indexOf(to) !== -1;
    if (!there || rel === 'chokidar/index.js') return { there: there, to: to };
      const same = fs.readFileSync(path.join(REPO, to), 'latin1').replace(/\r\n/g, '\n') === execSync('git show ' + BASE + ':' + f, { cwd: REPO, maxBuffer: 1 << 26 }).toString('latin1').replace(/\r\n/g, '\n');
    return { there: true, to: to, same: same, why: to + ' differs from ' + f + ' at ' + BASE };
  };
  let mw;
  mw = movedWhole('chokidar/LICENSE'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/LICENSE is there, in git, as it was', mw.why);
  mw = movedWhole('chokidar/README.md'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/README.md is there, in git, as it was', mw.why);
  mw = movedWhole('chokidar/handler.d.ts'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/handler.d.ts is there, in git, as it was', mw.why);
  mw = movedWhole('chokidar/handler.js'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/handler.js is there, in git, as it was', mw.why);
  mw = movedWhole('chokidar/index.d.ts'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/index.d.ts is there, in git, as it was', mw.why);
  mw = movedWhole('chokidar/index.js'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else test.check('spirit/run/spirit/job/chokidar/index.js is there, in git (its one changed line judged under 2)');
  mw = movedWhole('chokidar/package.json'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/chokidar/package.json is there, in git, as it was', mw.why);
  mw = movedWhole('readdirp/LICENSE'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/readdirp/LICENSE is there, in git, as it was', mw.why);
  mw = movedWhole('readdirp/README.md'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/readdirp/README.md is there, in git, as it was', mw.why);
  mw = movedWhole('readdirp/index.d.ts'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/readdirp/index.d.ts is there, in git, as it was', mw.why);
  mw = movedWhole('readdirp/index.js'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/readdirp/index.js is there, in git, as it was', mw.why);
  mw = movedWhole('readdirp/package.json'); if (!mw.there) test.fail(mw.to + ' is not there, in git'); else ok(mw.same, 'spirit/run/spirit/job/readdirp/package.json is there, in git, as it was', mw.why);
  const keeps = function (n) {
    const dir = path.join(REPO, NEW, n);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    return { fine: files.indexOf('package.json') !== -1 && files.some(function (x) { return /^licen[cs]e/i.test(x); }), why: 'spirit/job/' + n + '/ holds ' + short(files) };
  };
  let kp = keeps('chokidar'); ok(kp.fine, 'spirit/job/chokidar/ keeps its package.json and licence', kp.why);
  kp = keeps('readdirp'); ok(kp.fine, 'spirit/job/readdirp/ keeps its package.json and licence', kp.why);
  ok(!fs.existsSync(path.join(RUN, 'node_modules')), 'spirit/run/node_modules/ is gone from the disk', 'spirit/run/node_modules/ is still on the disk');
  const stillTracked = tracked.filter(function (f) { return f.indexOf(OLD) === 0; });
  ok(!stillTracked.length, 'no tracked file is left under spirit/run/node_modules/', stillTracked.length + ' still are: ' + short(stillTracked));

  test.subHeading('2. chokidar finds readdirp by path, the one line changed in the library');
  const idxNew = path.join(REPO, NEW, 'chokidar', 'index.js');
  const now = fs.existsSync(idxNew) ? fs.readFileSync(idxNew, 'utf8').split(/\r?\n/) : [];
  const was = execSync('git show ' + BASE + ':' + OLD + 'chokidar/index.js', { cwd: REPO, encoding: 'utf8' }).split(/\r?\n/);
  ok(/from\s+['"]readdirp['"]/.test(was[5] || ''), 'the world: index.js:6 at the base commit imports readdirp by name', 'index.js:6 at ' + BASE + ' reads ' + short(was[5]));
  ok(/from\s+['"]\.\.\/readdirp\/index\.js['"]/.test(now[5] || ''), 'spirit/job/chokidar/index.js:6 imports from "../readdirp/index.js"', 'index.js:6 reads ' + short(now[5] || '(no file)'));
  const differ = now.length ? was.map(function (l, i) { return l === now[i] ? -1 : i + 1; }).filter(function (i) { return i !== -1; }) : ['no file'];
  ok(now.length === was.length && differ.length === 1 && differ[0] === 6, 'no other line of index.js changed', 'lines changed: ' + short(differ) + ' (' + now.length + ' lines, were ' + was.length + ')');
  ok(now.length && !now.some(function (l) { return /from\s+['"]readdirp['"]|require\(\s*['"]readdirp['"]\s*\)/.test(l); }), 'index.js names readdirp by name nowhere', now.length ? 'index.js still imports readdirp by name' : 'no spirit/job/chokidar/index.js to judge');

  test.subHeading('3. the two users require it by path: job.js here, deskClient.js in its own test');
  const users = ['spirit/run/spirit/job.js'];
  users.forEach(function (u) {
    const c = code(fs.readFileSync(path.join(REPO, u), 'utf8'));
    const specs = (c.match(/require\(\s*['"][^'"]*chokidar[^'"]*['"]\s*\)/g) || []).map(function (r) { return r.replace(/^require\(\s*['"]|['"]\s*\)$/g, ''); });
    let to = '';
    // goal/G43.32: loaded by spirit.require, by its run-root path ("spirit/jobs/chokidar/index.js"); a relative path is the old way.
    try { to = specs.length === 1 ? require.resolve(specs[0].charAt(0) === '.' ? path.resolve(path.dirname(path.join(REPO, u)), specs[0]) : path.join(RUN, specs[0])) : ''; } catch (e) { to = ''; }
    ok(to === idxNew, u + ' requires ' + specs[0] + ', which is spirit/job/chokidar/index.js', u + ' requires ' + short(specs) + ' (resolves to ' + short(to || 'nothing') + ')');
  });
  const byName = tracked.filter(function (f) { return /\.(js|mjs|cjs|html)$/.test(f) && !SELF.test(f) && f.indexOf(NEW + 'chokidar/') !== 0; })
    .filter(function (f) { return /require\(\s*['"]chokidar['"]\s*\)|from\s+['"]chokidar['"]|import\(\s*['"]chokidar['"]\s*\)/.test(code(fs.readFileSync(path.join(REPO, f), 'utf8'))); });
  ok(!byName.length, 'nothing does require("chokidar") by name', byName.length + ' still do: ' + short(byName));

  test.subHeading('4. the file watcher works as before');
  // Scratch folders inside spirit/run (scanFolder refuses anything outside it, as fsWatcherCommands.js says), removed after.
  function child(src, dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync(process.execPath, ['-e', src, dir], { cwd: RUN, encoding: 'utf8', timeout: 30000 });
    fs.rmSync(dir, { recursive: true, force: true });
    return String(r.stdout || '').trim() + (r.stderr ? ' | ' + String(r.stderr).trim().slice(0, 300) : '');
  }
  // The node's fs-watcher job (the Files tree and the spirit.fs events): a file made in its folder comes as a createFile.
  const jobsOut = child([
    "const fs = require('fs'), path = require('path'), dir = process.argv[1];",
    "const jobs = require(" + JSON.stringify(path.join(RUN, 'spirit', 'job.js')) + ")(1);",
    "let job = null; jobs.events.on('job-updated', function (u) {",
    "  if (job && u.id === job.id && u.data && u.data.command && u.data.command.op === 'createFile' && u.data.command.path === 'made.txt') { console.log('HEARD'); process.exit(0); } });",
    "job = jobs.startFsWatcherJob(dir);",
    "setTimeout(function () { fs.writeFileSync(path.join(dir, 'made.txt'), 'x'); }, 1500);",
    "setTimeout(function () { console.log('DEAF'); process.exit(0); }, 12000);",
  ].join('\n'), path.join(RUN, 'vendoredFolders-jobs-test'));
  ok(/^HEARD/.test(jobsOut), 'the fs-watcher job hears a file made in its folder (createFile made.txt)', 'the fs-watcher job: ' + short(jobsOut));

  test.subHeading('5. no file names spirit/run/node_modules any more');
  const naming = tracked.filter(function (f) { return !SELF.test(f) && f.indexOf('spirit/run/brains/') !== 0 && !/\.(png|jpe?g|gif|ico|woff2?|ttf|zip|db)$/i.test(f); })
    .filter(function (f) { return /spirit\/run\/node_modules|!\/spirit\/run\/node_modules/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  ok(!naming.length, 'no tracked file names spirit/run/node_modules', naming.length + ' still do: ' + short(naming));
  const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8');
  ok(!/run\/node_modules/.test(gi), '.gitignore holds no exception for spirit/run/node_modules', '.gitignore still names it');
  const namesNoMore = function (f) { return { fine: naming.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)), why: f + (fs.existsSync(path.join(REPO, f)) ? ' still names it' : ' is not there to judge') }; };
  let nm = namesNoMore('install/microscopic/create.js'); ok(nm.fine, 'install/microscopic/create.js names spirit/run/node_modules no more', nm.why);
  nm = namesNoMore('install/chat-windows/create.js'); ok(nm.fine, 'install/chat-windows/create.js names spirit/run/node_modules no more', nm.why);
}
