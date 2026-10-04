'use strict';

// goal/G4.34: the utility process — a job that is removed from Jobs once its process exits cleanly. Red on today's
// tree; wsl-claude wrote it, claude-ubuntu or claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.33: "make a stub. process-send-and-delivery, very usefull...."; "to build now,
//   so that that stuff isn't roll-your-own every single time you need a utility process."; "used by publishData
//   first and by goalShare also now."; "do that first. item."; to the verb (Q11, claude-windows): "verb granted.";
//   to Q12 (wsl-claude's review: remove on a clean exit, keep a failed one): "granted. ask for the official grant
//   with red button"; the grants for js/jobs.js, js/server.js and the verb (G1-G3) and his Go on goal/G4.34.
//   In the tree: jobs.delete refuses a job that is not finished (jobs.js 133), so no process can remove its own;
//   jobs.create's handler passes only command, args and type to jobs.startJob (server.js 326); the desk's goal share
//   starts goalShare.js with jobs.create and nothing removes the finished job (desk.js 787), so they pile up.
//
// THE SHAPES (agreed under goal/G4.33/G4.34; the builder may argue details in Desk first):
//   1  jobs.startJob(command, args, { removeWhenDone: true }): when the process exits with code 0 the job is deleted
//      (getJob answers nothing, a job-deleted event fires); an exit with any other code leaves it, status failed.
//      Without the option nothing changes: a finished job stays.
//   2  jobs.create carries it: { command, args, type, removeWhenDone } on the loopback verb reaches startJob.
//   3  The desk's goal share asks with removeWhenDone: true.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const plantRun = require('./plantRun.js');
const { relayRequest } = require('../run/js/relayRequest.js');

const OWED = 'OWED by goal/G4.34: ';
const DESK = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');

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

test.startTest('goal/G4.34: a job removed from Jobs once its process exits cleanly');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-removewhendone-'));
const ok = path.join(scratch, 'ok.js');
const bad = path.join(scratch, 'bad.js');
fs.writeFileSync(ok, 'setTimeout(function () { process.exit(0); }, 100);');
fs.writeFileSync(bad, 'setTimeout(function () { process.exit(3); }, 100);');
const kids = [];

(async function () {
  test.subHeading('1. jobs.startJob with removeWhenDone');
  const jobs = require('../run/js/jobs.js')(spirit, 65432);
  const deleted = [];
  jobs.events.on('job-deleted', function (id) { deleted.push(id); });

  const clean = jobs.startJob(process.execPath, [ok], { type: 'utility', removeWhenDone: true });
  const gone = await waitFor(function () { return !jobs.getJob(clean.id); }, 8000);
  if (gone && deleted.indexOf(clean.id) !== -1) test.check('a clean exit removes the job, and job-deleted fires');
  else test.fail(OWED + 'after a clean exit the job reads ' + JSON.stringify(jobs.getJob(clean.id) && jobs.getJob(clean.id).status) + ', job-deleted ' + (deleted.indexOf(clean.id) !== -1));

  const failed = jobs.startJob(process.execPath, [bad], { type: 'utility', removeWhenDone: true });
  await waitFor(function () { const j = jobs.getJob(failed.id); return j && j.status === 'failed'; }, 8000);
  await sleep(500);
  const f = jobs.getJob(failed.id);
  if (f && f.status === 'failed') test.check('a failed exit keeps the job, status failed, so a broken run is seen');
  else test.fail('a failed exit with removeWhenDone left ' + JSON.stringify(f && f.status));

  const plain = jobs.startJob(process.execPath, [ok], { type: 'utility' });
  await waitFor(function () { const j = jobs.getJob(plain.id); return j && j.status === 'completed'; }, 8000);
  await sleep(500);
  const p = jobs.getJob(plain.id);
  if (p && p.status === 'completed') test.check('without the option a finished job stays, as today');
  else test.fail('a plain finished job reads ' + JSON.stringify(p && p.status));

  test.subHeading('2. jobs.create carries it, on a real node');
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
  await waitFor(function () { return ask({ verb: 'device.info' }).then(function (r) { return r.status === 200; }); }, 15000);
  // A SECOND, SLOWER SCRIPT, so the job can be seen before it ends. AND jobs.get, not jobs.list: this node has no
  // jobs.list verb, and the first version of this section asked it, read an empty answer as "gone", and passed vacuously
  // (wsl-claude, found 2026-10-05 writing the red of goal/G4.33). jobs.get {key} answers 200 while the job exists, 404 once
  // it does not.
  const slow = path.join(scratch, 'slow.js');
  fs.writeFileSync(slow, 'setTimeout(function () { process.exit(0); }, 1500);');
  const made = await ask({ verb: 'jobs.create', command: process.execPath, args: [slow], type: 'utility', removeWhenDone: true });
  const id = (made.body && (made.body.id || (made.body.job && made.body.job.id))) || '';
  const seen = id ? (await ask({ verb: 'jobs.get', key: id })).status : 0;
  const removed = id && await waitFor(function () { return ask({ verb: 'jobs.get', key: id }).then(function (r) { return r.status === 404; }); }, 10000);
  if (made.status >= 200 && made.status < 300 && seen === 200 && removed) test.check('jobs.create with removeWhenDone: jobs.get finds the job while it runs, and answers 404 once it exited');
  else test.fail(OWED + 'jobs.create answered ' + made.status + '; jobs.get while running ' + seen + '; gone after ' + !!removed);

  test.subHeading('3. the desk\'s goal share asks for it');
  const src = fs.readFileSync(DESK, 'utf8');
  const call = (/core\.ask\('jobs\.create',\s*\{[\s\S]*?goalShare\.js[\s\S]*?\}\s*,\s*base\)/.exec(src) || [''])[0];
  if (call && /removeWhenDone:\s*true/.test(call)) test.check('desk.js starts goalShare.js with removeWhenDone: true');
  else test.fail(OWED + 'desk.js\'s jobs.create for goalShare.js reads ' + JSON.stringify(call.slice(0, 200)));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
