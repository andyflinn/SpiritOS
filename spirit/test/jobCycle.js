'use strict';

// spirit/test/jobCycle.js
// goal/G29.15: one progress protocol, the job cycle in spirit.core.jobs. Red on today's tree; claude-windows writes it
// and builds it (one agent). The item's box:
//   THE JOB CYCLE: a job is start, then progress and app-specific messages, then end. No process runs more than one
//   job at a time; an appServer may run many over its life, one after another. A transient process IS its job.
//   THE CALLS, in spirit.core.jobs: start(name), progress(done, total, text), end(result or error), each published.
//   total 0 means unknown. A start while a job is open is refused by name. A transient process only calls progress.
//   WHERE IT LIVES: spirit.core.jobs (kernel.js) holds report, log, complete, fail, publish, start, progress, end;
//   publish moves out of appServer.js, size check with it; appServer.js keeps only what serving needs.
//   THE SHELL: one shared bar element draws a process's open job (built with the Jobs list, goal/G29.14).
// Named here before building, as promised in the item's chat: the servers that publish switch to
// spirit.core.jobs.publish (desk with its plugins' publish, deskVerify, deskAgent, fileServer, chatClerver), and
// deskVerify wraps each run in start/end, its suites counted with progress (since goal/G33.3 a run is handed to it
// with run {suites, commit}, one at a time).
// rule/11: through testSupport only.

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const limits = require('../run/js/limits.js');

const OWED = 'OWED by goal/G29.15: ';
const RUN = path.join(__dirname, '..', 'run');
const KERNEL = path.join(RUN, 'js', 'kernel.js');
const read = function (rel) { return fs.readFileSync(path.join(RUN, rel), 'utf8'); };

test.startTest('goal/G29.15: the job cycle, one progress protocol in spirit.core.jobs');

// One spawned process with a job id and a callback door, as the node starts it; every body it posts is kept.
function asProcess(script) {
  return new Promise(function (resolve) {
    const bodies = [];
    const door = http.createServer(function (req, res) {
      const chunks = [];
      req.on('data', function (c) { chunks.push(c); });
      req.on('end', function () {
        try { bodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { bodies.push(null); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    door.listen(0, '127.0.0.1', function () {
      const url = 'http://127.0.0.1:' + door.address().port + '/api/spirit';
      const kid = spawn(process.execPath, ['-e', 'const spirit = require(' + JSON.stringify(KERNEL) + ');\n' + script], {
        env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'job_7', SPIRIT_CALLBACK_URL: url }),
      });
      let out = '';
      let err = '';
      kid.stdout.on('data', function (d) { out += d; });
      kid.stderr.on('data', function (d) { err += d; });
      const timer = setTimeout(function () { try { kid.kill(); } catch (e) { /* gone */ } }, 15000);
      kid.on('exit', function () {
        clearTimeout(timer);
        door.close();
        let said = null;
        try { said = JSON.parse(out.trim().split('\n').pop()); } catch (e) { said = null; }
        resolve({ bodies: bodies, said: said, err: err });
      });
    });
  });
}
const appsOf = function (r) { return r.bodies.filter(function (b) { return b && b.app; }).map(function (b) { return b.app; }); };
const cycleOf = function (r) { return appsOf(r).filter(function (a) { return a.job; }).map(function (a) { return a.job; }); };

(async function () {
  // ── 1. the calls ─────────────────────────────────────────────────────
  test.subHeading('1. spirit.core.jobs holds what every spawned process shares');
  const spirit = require('../run/js/kernel.js');
  const want = ['report', 'log', 'complete', 'fail', 'publish', 'start', 'progress', 'end'];
  const lacking = want.filter(function (n) { return typeof (spirit.core.jobs || {})[n] !== 'function'; });
  if (!lacking.length) test.check('spirit.core.jobs has ' + want.join(', '));
  else test.fail(OWED + 'spirit.core.jobs lacks ' + lacking.join(', '));

  // ── 2. the cycle, as a server runs it ────────────────────────────────
  test.subHeading('2. a server: start, progress, end, each published; a second start while open is refused by name');
  const server = await asProcess([
    'const j = spirit.core.jobs;',
    'const said = {};',
    'const refusal = function (f) { try { return Promise.resolve(f()).then(function () { return null; }, function (e) { return (e && e.code) || String(e); }); } catch (e) { return Promise.resolve((e && e.code) || String(e)); } };',
    '(async function () {',
    '  await j.start("check goal/G1.2");',
    '  said.second = await refusal(function () { return j.start("another"); });',
    '  await j.progress(2, 5, "suite b");',
    '  await j.progress(1, 0, "counting");',
    '  await j.end({ outcome: "passed" });',
    '  said.after = await refusal(function () { return j.start("the next one"); });',
    '  await j.end({ outcome: "rejected" });',
    '  process.stdout.write(JSON.stringify(said) + "\\n");',
    '})().catch(function (e) { process.stdout.write(JSON.stringify({ broke: String(e && e.message || e) }) + "\\n"); });',
  ].join('\n'));
  const c = cycleOf(server);
  const at = function (i) { return c[i] || {}; };
  if (at(0).state === 'start' && at(0).name === 'check goal/G1.2') test.check('start(name) publishes {job: {state: "start", name}}');
  else test.fail(OWED + 'start published ' + JSON.stringify(c[0]) + (server.err ? ', stderr ' + server.err.slice(0, 160) : ''));
  if (server.said && server.said.second === 'job-open') test.check('a start while a job is open is refused as job-open');
  else test.fail(OWED + 'a second start answered ' + JSON.stringify(server.said));
  if (c.filter(function (x) { return x.state === 'start'; }).length === 2) test.check('the refused start published nothing');
  else test.fail(OWED + 'starts published: ' + JSON.stringify(c.filter(function (x) { return x.state === 'start'; })));
  const p = c.filter(function (x) { return x.state === 'progress'; });
  if (p[0] && p[0].name === 'check goal/G1.2' && p[0].done === 2 && p[0].total === 5 && p[0].text === 'suite b') test.check('progress(done, total, text) publishes them under the open job\'s name');
  else test.fail(OWED + 'progress published ' + JSON.stringify(p[0]));
  if (p[1] && p[1].done === 1 && p[1].total === 0) test.check('total 0 travels as 0: unknown, an indeterminate bar');
  else test.fail(OWED + 'progress with total 0 published ' + JSON.stringify(p[1]));
  const e = c.filter(function (x) { return x.state === 'end'; });
  if (e[0] && e[0].name === 'check goal/G1.2' && e[0].result && e[0].result.outcome === 'passed') test.check('end(result) publishes {job: {state: "end", name, result}}');
  else test.fail(OWED + 'end published ' + JSON.stringify(e[0]));
  if (server.said && server.said.after === null && e[1] && e[1].name === 'the next one') test.check('after its end the next job starts: many jobs over a server\'s life, one at a time');
  else test.fail(OWED + 'the start after an end answered ' + JSON.stringify(server.said) + ', ends ' + JSON.stringify(e));
  if (server.bodies.length && server.bodies.every(function (b) { return b && b.verb === 'jobs.update' && b.id === 'job_7'; })) test.check('every call goes through report, the one door, as job_7');
  else test.fail(OWED + 'bodies posted: ' + JSON.stringify(server.bodies).slice(0, 200));

  // ── 3. a transient process ───────────────────────────────────────────
  test.subHeading('3. a transient process IS its job: it only calls progress');
  const transient = await asProcess([
    'spirit.core.jobs.progress(3, 10, "image 3").then(function () { process.stdout.write("{}\\n"); },',
    '  function (e) { process.stdout.write(JSON.stringify({ refused: (e && e.code) || String(e) }) + "\\n"); });',
  ].join('\n'));
  const t = cycleOf(transient);
  if (t.length === 1 && t[0].state === 'progress' && t[0].done === 3 && t[0].total === 10 && t[0].text === 'image 3') test.check('progress with no start is published: the node marked the start at spawn');
  else test.fail(OWED + 'a transient progress published ' + JSON.stringify(t) + ', said ' + JSON.stringify(transient.said));

  // ── 4. publish, moved with its size check ────────────────────────────
  test.subHeading('4. spirit.core.jobs.publish: every object as handed in, one over MAX_PAYLOAD said, not sent');
  const pub = await asProcess([
    'const a = spirit.core.jobs.publish({ hello: "page", n: 1 });',
    'const b = spirit.core.jobs.publish({ big: "m".repeat(' + (limits.PAYLOAD_MAX + 2048) + ') });',
    'setTimeout(function () { process.stdout.write(JSON.stringify({ a: a, b: b }) + "\\n"); }, 500);',
  ].join('\n'));
  const pa = appsOf(pub);
  if (pub.said && pub.said.a === true && pa.some(function (x) { return x.hello === 'page' && x.n === 1; })) test.check('a small object is published as it was handed in, and publish answers true');
  else test.fail(OWED + 'publish answered ' + JSON.stringify(pub.said) + ', posted ' + JSON.stringify(pa).slice(0, 160));
  if (pub.said && pub.said.b === false && !pa.some(function (x) { return x.big; }) && pa.some(function (x) { return x.dropped && x.dropped.max === limits.PAYLOAD_MAX; }) && /publish-too-large/.test(pub.err)) {
    test.check('an object over MAX_PAYLOAD is not sent; every page hears {dropped: {bytes, max}} and stderr names it');
  } else {
    test.fail(OWED + 'oversize publish answered ' + JSON.stringify(pub.said) + ', stderr ' + JSON.stringify(pub.err.slice(0, 120)));
  }

  // ── 5. appServer keeps only what serving needs ───────────────────────
  test.subHeading('5. publish is gone from appServer.js');
  const appServer = read('js/appServer.js');
  if (!/function publish\s*\(/.test(appServer) && !/\bpublish:\s*publish\b/.test(appServer) && !/PUBLISH_MAX/.test(appServer)) test.check('appServer.js defines and exports no publish, and holds no publish cap');
  else test.fail(OWED + 'appServer.js still holds publish');

  // ── 6. the servers ───────────────────────────────────────────────────
  test.subHeading('6. the servers publish through spirit.core.jobs');
  const SERVERS = ['process/js/desk/desk.js', 'process/js/deskVerify/deskVerify.js', 'process/js/deskAgent/deskAgent.js',
    'process/js/fileServer/fileServer.js', 'process/js/chatClerver/chatClerver.js'];
  const still = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (en) {
      if (en.name === 'node_modules') return;
      const full = path.join(dir, en.name);
      if (en.isDirectory()) walk(full);
      else if (/\.js$/.test(en.name) && /appServer\.publish\s*\(/.test(fs.readFileSync(full, 'utf8'))) still.push(path.relative(RUN, full).split(path.sep).join('/'));
    });
  })(path.join(RUN, 'process'));
  if (!still.length) test.check('no file under process/ calls appServer.publish');
  else test.fail(OWED + 'appServer.publish still called in ' + still.join(', '));
  const notSwitched = SERVERS.filter(function (rel) { return !/\.core\.jobs\.publish\s*\(/.test(read(rel)); });
  if (!notSwitched.length) test.check('desk, deskVerify, deskAgent, fileServer and chatClerver call spirit.core.jobs.publish');
  else test.fail(OWED + 'not switched: ' + notSwitched.join(', '));

  // ── 7. deskVerify runs each run as a job ─────────────────────────────
  test.subHeading('7. deskVerify: each run is one job, its suites counted');
  const dv = read('process/js/deskVerify/deskVerify.js');
  // A checkout may end its lines with \r\n (his tree on Windows does), so the bodies are cut either way.
  const startFn = (/function startRun\([\s\S]*?\r?\n\}\r?\n/.exec(dv) || [''])[0];
  if (/\.core\.jobs\.start\(/.test(startFn) && /\.core\.jobs\.end\(/.test(startFn)) test.check('startRun starts a job for each run and ends it however the run ended');
  else test.fail(OWED + 'startRun does not run start/end');
  const sayFn = (/function say\(o\) \{[\s\S]*?\r?\n\}\r?\n/.exec(dv) || [''])[0];
  if (/\.core\.jobs\.progress\(/.test(sayFn)) test.check('what it says while running carries the suite count as progress');
  else test.fail(OWED + 'say() reports no progress');
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
