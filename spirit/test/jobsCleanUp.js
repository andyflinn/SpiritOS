'use strict';

// spirit/test/jobsCleanUp.js
// goal/G29.16: transient jobs remove themselves; only failed ones stay. Red on today's tree; claude-windows writes it
// and builds it (one agent). The item's box:
//   Automatic, never opt-in per caller: every transient job is removed from the job system when it ends, unless it
//   failed. A job the owner cancels is removed too. A failed job stays until the next node restart. The removeWhenDone
//   argument goes from jobs.create, and with it the opt-in of goal/G4.34.
//   THE JOBS LIST: the status toggles go; in their place one last filter, failed, that shows the failed jobs alone.
// It replaces goal/G4.34's jobsRemoveWhenDone.js, whose opt-in it removes.
// NAMED HERE where the box names none: a transient job is kind 'process'; the failed filter is the last choice of the
// kind filter (all, node, servers, transient, failed), drawn in jobsSearch.js.
// rule/11: through testSupport only.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by goal/G29.16: ';
const RUN = path.join(__dirname, '..', 'run');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 8000);
  return (function poll() {
    return Promise.resolve().then(fn).catch(function () { return false; }).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return sleep(150).then(poll);
    });
  }());
}
function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}

test.startTest('goal/G29.16: transient jobs remove themselves; only failed ones stay');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cleanup-'));
const ok = path.join(scratch, 'ok.js');
const bad = path.join(scratch, 'bad.js');
const long = path.join(scratch, 'long.js');
fs.writeFileSync(ok, 'setTimeout(function () { process.exit(0); }, 100);');
fs.writeFileSync(bad, 'setTimeout(function () { process.exit(3); }, 100);');
fs.writeFileSync(long, 'setInterval(function () {}, 1000);');
const kids = [];

(async function () {
  test.subHeading('1. the job system: no option, the rule itself');
  const jobs = require('../run/js/jobs.js')(spirit, 65432);
  const deleted = [];
  jobs.events.on('job-deleted', function (id) { deleted.push(id); });

  const clean = jobs.startJob(process.execPath, [ok], { type: 'utility' });
  const gone = await waitFor(function () { return !jobs.getJob(clean.id); }, 8000);
  if (gone && deleted.indexOf(clean.id) !== -1) test.check('a transient job that ends cleanly is removed, with no option asked, and job-deleted fires');
  else test.fail(OWED + 'after a clean exit the job reads ' + JSON.stringify(jobs.getJob(clean.id) && jobs.getJob(clean.id).status));

  const failed = jobs.startJob(process.execPath, [bad], { type: 'utility' });
  await waitFor(function () { const j = jobs.getJob(failed.id); return j && j.status === 'failed'; }, 8000);
  await sleep(500);
  const f = jobs.getJob(failed.id);
  if (f && f.status === 'failed') test.check('a failed one stays, status failed, to be looked at');
  else test.fail('a failed exit left ' + JSON.stringify(f && f.status));

  const running = jobs.startJob(process.execPath, [long], { type: 'utility' });
  await waitFor(function () { const j = jobs.getJob(running.id); return j && j.status === 'running'; }, 8000);
  jobs.cancelJob(running.id);
  const cancelledGone = await waitFor(function () { return !jobs.getJob(running.id); }, 8000);
  if (cancelledGone && deleted.indexOf(running.id) !== -1) test.check('a transient job the owner cancels is removed too');
  else test.fail(OWED + 'a cancelled transient job reads ' + JSON.stringify(jobs.getJob(running.id) && jobs.getJob(running.id).status));

  const server = jobs.startServerJob(process.execPath, [long], { type: 'cleanup-server', operated: 'user' });
  await waitFor(function () { const j = jobs.getJob(server.id); return j && j.status === 'running'; }, 8000);
  jobs.cancelJob(server.id);
  await sleep(500);
  const s = jobs.getJob(server.id);
  if (s && s.status === 'cancelled') test.check('a server is no transient job: cancelled, it stays listed');
  else test.fail('a cancelled server reads ' + JSON.stringify(s && s.status));
  try { jobs.cancelJob(failed.id); } catch (e) { /* finished */ }

  test.subHeading('2. on a real node: jobs.create without the option, and a job that reports complete()');
  const home = path.join(scratch, 'node', 'spirit', 'run');
  plantRun.plantRunTree(home);
  const port = await freePort();
  const node = spawn(process.execPath, ['js/server.js', '--port', String(port)], { cwd: home, stdio: ['ignore', 'ignore', 'ignore'] });
  kids.push(node);
  const ask = function (body) {
    return relayRequest('http://127.0.0.1:' + port, 'POST', '/api/spirit', body).then(function (r) {
      let b = {}; try { b = JSON.parse(r.text); } catch (e) { b = {}; }
      return { status: r.status, body: b };
    }, function () { return { status: 0, body: {} }; });
  };
  await waitFor(function () { return ask({ verb: 'node.debug', debug: {} }).then(function (r) { return r.status === 200; }); }, 15000);
  const slow = path.join(scratch, 'slow.js');
  fs.writeFileSync(slow, 'setTimeout(function () { process.exit(0); }, 1500);');
  const made = await ask({ verb: 'jobs.create', command: process.execPath, args: [slow], type: 'utility' });
  const id = (made.body && (made.body.id || (made.body.job && made.body.job.id))) || '';
  const seen = id ? (await ask({ verb: 'jobs.get', key: id })).status : 0;
  const removed = id && await waitFor(function () { return ask({ verb: 'jobs.get', key: id }).then(function (r) { return r.status === 404; }); }, 10000);
  if (made.status >= 200 && made.status < 300 && seen === 200 && removed) test.check('jobs.create {command, args, type}: jobs.get finds the job while it runs, 404 once it ended');
  else test.fail(OWED + 'jobs.create answered ' + made.status + '; jobs.get while running ' + seen + '; gone after ' + !!removed);
  // A job that says complete() and is still alive: removed on its word, not only on its exit.
  const says = path.join(scratch, 'says.js');
  fs.writeFileSync(says, 'const spirit = require(' + JSON.stringify(path.join(RUN, 'js', 'kernel.js')) + ');\n' +
    'spirit.core.jobs.complete({ done: true }).then(function () { setTimeout(function () { process.exit(0); }, 4000); });');
  const told = await ask({ verb: 'jobs.create', command: process.execPath, args: [says], type: 'utility' });
  const tid = (told.body && (told.body.id || (told.body.job && told.body.job.id))) || '';
  const tGone = tid && await waitFor(function () { return ask({ verb: 'jobs.get', key: tid }).then(function (r) { return r.status === 404; }); }, 3000);
  if (tGone) test.check('a job that reports complete() is removed at its word, before its process exits');
  else test.fail(OWED + 'a job that reported complete() is still listed 3 s later (' + (tid || 'no id') + ')');

  test.subHeading('3. the opt-in is gone');
  const naming = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (e.name === 'node_modules' || e.name === 'relay-state' || e.name === '.git') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.js$/.test(e.name) && /removeWhenDone/.test(fs.readFileSync(full, 'utf8'))) naming.push(path.relative(RUN, full).split(path.sep).join('/'));
    });
  })(RUN);
  if (!naming.length) test.check('no file under spirit/run names removeWhenDone: not jobs.js, not the jobs.create verb, not desk or deskClient');
  else test.fail(OWED + 'removeWhenDone still in ' + naming.join(', '));
  if (!fs.existsSync(path.join(__dirname, 'jobsRemoveWhenDone.js'))) test.check('goal/G4.34\'s jobsRemoveWhenDone.js is retired; this suite holds its checks');
  else test.fail(OWED + 'spirit/test/jobsRemoveWhenDone.js still asserts the opt-in');

  test.subHeading('4. the Jobs list: the failed filter in place of the status toggles');
  const src = fs.readFileSync(path.join(RUN, 'shell', 'jobs', 'jobs.js'), 'utf8');
  if (!/name:\s*'status'/.test(src)) test.check('no status toggles any more');
  else test.fail(OWED + 'shell/jobs/jobs.js still declares the status filter');
  if (/value:\s*'transient'[^\]]*\{\s*value:\s*'failed',\s*word:\s*'failed'\s*\}\s*\]/.test(src)) test.check('failed is the last choice of the kind filter (jobsSearch.js shows it pick the failed alone)');
  else test.fail(OWED + 'no failed choice at the end of the kind filter');
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
