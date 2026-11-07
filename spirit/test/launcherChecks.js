'use strict';

// desk/G2.2: one launcher for every process. A helper, not a suite: jobCallback.js runs these, withDoor through its
// stand-in door (oneDoor.js counts that door once, there), withoutDoor with a door of its own (below).
// Andy: "if a server is a process, it should get the perks of a process, that's no stretch."
// "can those not collapse into one interface, that can't drift?" "the one shots should have that too, who wants dangeling processes"
// The contract: spirit/run/spirit/jobs.js spawns every process in one place; every process gets SPIRIT_JOB_ID,
// SPIRIT_CALLBACK_URL and an IPC channel; a process exits when its node goes, a one-shot as much as a server;
// restart with backoff stays an option for servers; a process's own log, complete and fail drive its job.
// Output only in DEBUG (desk/G2.5) is jobs.js's, not asserted here.
//
// goal/G43.23: the checks 885f1ab5 cut with the old fixtures (the contract, cancel ends the process, no process
// outlives its node) and jobCallback.js's complete() and fail(), restored from 885f1ab5^ on today's API. A process
// loads spirit.js now, not kernel.js, and reports on its job through spirit.jobs, the events family's publish to the
// port in its run root's spirit/state/environment.json (goal/G40.6), not to SPIRIT_CALLBACK_URL. So those checks run
// in a scratch copy of the run tree whose environment.json names this suite's own door: the node's real
// events.handlePublish (spirit/events/events.js) on a jobs module of this suite's own. Never a live node's port.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const OWED = 'OWED by desk/G2.2: ';
const FIXTURE = path.join(__dirname, 'fixtures', 'launcherFixture.js');
const JOBS = path.join(__dirname, '..', 'run', 'spirit', 'jobs.js');
const EVENTS = path.join(__dirname, '..', 'run', 'spirit', 'events', 'events.js');
const REPO = path.join(__dirname, '..', '..');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100); } return fn(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }

async function withDoor(test, jobs) {
  test.subHeading('desk/G2.2: a server still restarts when it exits');
  const flaky = jobs.startServerJob(process.execPath, [FIXTURE, JSON.stringify({ mode: 'once', code: 1 })], { type: 'launcher-flaky' });
  const restarted = await until(function () { const j = jobs.getJob(flaky.id); return j && j.data && j.data.restarts >= 1; }, 6000);
  if (restarted) test.check('a node-operated server that exits is started again');
  else test.fail('a node-operated server was not restarted: ' + JSON.stringify(jobs.getJob(flaky.id)));
  try { jobs.cancelJob(flaky.id); } catch (e) { /* gone */ }
}

// THE WORLD OF THE RESTORED CHECKS: a scratch copy of the tracked files of spirit/run (as headLessChrome.js's scratchNode
// makes one) with the two fixtures beside it at their own relative place, its environment.json naming the door here, and
// a jobs module of the checkout's spirit/jobs.js whose jobs that door changes.
async function scratchWorld(test) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-launcher-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const fixtures = path.join(root, 'spirit', 'test', 'fixtures');
  fs.mkdirSync(fixtures, { recursive: true });
  ['jobCallbackFixture.js', 'launcherParent.js'].forEach(function (f) { fs.copyFileSync(path.join(__dirname, 'fixtures', f), path.join(fixtures, f)); });
  let jobs = null;
  let events = null;
  const door = http.createServer(function (req, res) {
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      let b = null; try { b = JSON.parse(raw); } catch (e) { b = null; }
      // The door's one envelope (goal/G41.15): {call, args}; events.publish's args are the body the node hands on.
      if (b && b.call === 'events.publish' && b.args && typeof b.args === 'object') {
        return events.handlePublish({ args: b.args }, res);
      }
      const na = test.nodeApi(b);
      res.writeHead(na ? na.status : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(na ? na.body : { ok: false, code: 'no-such-verb', error: 'this door answers events.publish alone' }));
    });
  });
  await new Promise(function (r) { door.listen(0, '127.0.0.1', r); });
  const port = door.address().port;
  fs.mkdirSync(path.join(root, 'spirit', 'run', 'spirit', 'state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'spirit', 'run', 'spirit', 'state', 'environment.json'), JSON.stringify({ PORT: port }));
  // The fixtures start only where this port is named (jobCallbackFixture.js): every job inherits this.
  process.env.SPIRIT_FIXTURE_PORT = String(port);
  jobs = require(JOBS)(port);
  events = require(EVENTS).createEvents({
    jobs: jobs,
    readJsonBody: function (req) { return Promise.resolve(req.args); },
    bodyRefused: function (req, res, e) { res.writeHead(400); res.end(String(e && e.message || e)); },
  });
  // A COMPLETED JOB IS GONE AT ONCE (goal/G29.16), so the job as its last update carried it is read from the events.
  const lastSeen = Object.create(null);
  jobs.events.on('job-updated', function (j) { lastSeen[j.id] = JSON.parse(JSON.stringify(j)); });
  const pipe = function (tag) {
    return process.platform === 'win32' ? require('../run/spirit/appClient.js').pipePathFor(path.join(root, tag), 'jobCallbackFixture', 'win32', 'process') : path.join(root, tag + '.sock');
  };
  return {
    root: root, port: port, jobs: jobs, pipe: pipe,
    fixture: path.join(fixtures, 'jobCallbackFixture.js'), parent: path.join(fixtures, 'launcherParent.js'),
    job: function (id) { return jobs.getJob(id) || lastSeen[id] || null; },
    close: function () { try { door.close(); } catch (e) { /* closed */ } try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy */ } },
  };
}

async function withoutDoor(test) {
  test.subHeading('desk/G2.2: one launcher, jobs.js spawns in one place');
  const spawns = (code(JOBS).match(/\bspawn\s*\(/g) || []).length;
  if (spawns === 1) test.check('spirit/jobs.js has one spawn call');
  else test.fail(OWED + 'spirit/jobs.js has ' + spawns + ' spawn calls, one per kind of job');

  const w = await scratchWorld(test);
  const started = [];
  try {
    const terminal = function (id) { const j = w.job(id); return j && (j.status === 'completed' || j.status === 'failed') ? j : null; };

    test.subHeading('a process\'s own complete() and fail() drive its job');
    const done = w.jobs.startProcessJob(process.execPath, [w.fixture, JSON.stringify({ outcome: 'complete', data: { sample: 42 } })], { type: 'test-complete' });
    const d = await until(function () { return terminal(done.id); }, 8000) || w.job(done.id) || {};
    if (d.status === 'completed') test.check('complete() drives the job to status "completed"');
    else test.fail('complete() should have reached "completed" but status is ' + JSON.stringify(d.status) + ', exit ' + JSON.stringify(d.data && d.data.exitCode));
    if (d.data && d.data.sample === 42) test.check('complete()\'s data payload is merged into the job');
    else test.fail('complete()\'s data payload was not merged: ' + JSON.stringify(d.data));
    if ((d.log || []).some(function (e) { return e.message === 'fixture running'; })) test.check('log() entries sent before complete() are kept in job.log');
    else test.fail('the log entry "fixture running" is missing from job.log: ' + JSON.stringify(d.log || []).slice(0, 300));
    const bad = w.jobs.startProcessJob(process.execPath, [w.fixture, JSON.stringify({ outcome: 'fail', message: 'boom' })], { type: 'test-fail' });
    const f = await until(function () { return terminal(bad.id); }, 8000) || w.job(bad.id) || {};
    // A process that exits 0 after its own fail() is failed by its word, not completed by its exit code.
    if (f.status === 'failed' && f.data && f.data.exitCode !== 1) test.check('fail() drives the job to status "failed"');
    else test.fail('fail() should have reached "failed" by its own word but status is ' + JSON.stringify(f.status) + ', exit ' + JSON.stringify(f.data && f.data.exitCode));
    if (f.data && f.data.error === 'boom') test.check('fail()\'s error message is recorded in job.data.error');
    else test.fail('fail()\'s error message was not recorded: ' + JSON.stringify(f.data));

    const seen = function (job) { const j = w.jobs.getJob(job.id); return j && j.data && 'hasIpc' in j.data ? j.data : null; };
    test.subHeading('desk/G2.2: a server job gets the same contract as a one-shot');
    const server = w.jobs.startServerJob(process.execPath, [w.fixture, JSON.stringify({ mode: 'serve' }), '--pipe', w.pipe('cancel')], { type: 'launcher-server', operated: 'user' });
    started.push(server);
    const s = await until(function () { return seen(server); }, 8000);
    const callback = 'http://localhost:' + w.port + '/api/spirit';
    if (s && s.sawJobId === server.id && s.sawCallback === callback) test.check('the server saw SPIRIT_JOB_ID and SPIRIT_CALLBACK_URL, and reported on its job');
    else test.fail(OWED + 'a server job reported nothing, or without its job id or callback: ' + JSON.stringify(s));
    if (s && s.hasIpc) test.check('the server has an IPC channel');
    else test.fail(OWED + 'the server has no IPC channel: ' + JSON.stringify(s));

    test.subHeading('desk/G2.2: a one-shot job gets an IPC channel too');
    const oneshot = w.jobs.startProcessJob(process.execPath, [w.fixture, JSON.stringify({ mode: 'wait' })], { type: 'launcher-oneshot' });
    started.push(oneshot);
    const o = await until(function () { return seen(oneshot); }, 8000);
    if (o && o.sawJobId === oneshot.id && o.sawCallback === callback) test.check('the one-shot reported on its job, with its job id and callback');
    else test.fail('the one-shot reported nothing, or without its job id or callback: ' + JSON.stringify(o));
    if (o && o.hasIpc) test.check('the one-shot has an IPC channel');
    else test.fail(OWED + 'the one-shot has no IPC channel');

    test.subHeading('desk/G2.2: stopping a job ends its process');
    const pids = [server, oneshot].map(function (job) { return ((w.jobs.getJob(job.id) || {}).data || {}).pid; });
    [server, oneshot].forEach(function (job) { try { w.jobs.cancelJob(job.id); } catch (e) { /* named by the build */ } });
    const gone = await until(function () { return pids.every(function (p) { return p && !alive(p); }); }, 5000);
    if (gone) test.check('after cancel, neither process is running');
    else test.fail('after cancel, still running: ' + JSON.stringify(pids.filter(function (p) { return p && alive(p); })));
    pids.forEach(function (p) { if (p && alive(p)) { try { process.kill(p); } catch (e) { /* gone */ } } });

    test.subHeading('desk/G2.2: no process outlives its node');
    for (const kind of ['oneshot', 'server']) {
      const pidFile = path.join(w.root, 'launcher-' + kind + '.pid');
      const parent = spawn(process.execPath, [w.parent, kind, pidFile, String(w.port), w.pipe('outlive-' + kind)], { stdio: 'ignore' });
      const pid = await until(function () { try { return Number(fs.readFileSync(pidFile, 'utf8')) || 0; } catch (e) { return 0; } }, 8000);
      // Up a moment, so a server is listening (its disconnect handler is set as appServer.serve starts).
      await sleep(500);
      const running = !!pid && alive(pid);
      parent.kill('SIGKILL');
      const ended = running ? await until(function () { return !alive(pid); }, 5000) : false;
      if (ended) test.check('the ' + kind + ' process ended when its node was killed');
      else {
        test.fail(OWED + 'the ' + kind + ' process ' + (running ? pid + ' outlived its node' : 'never started'));
        if (pid) { try { process.kill(pid); } catch (e) { /* gone */ } }
      }
    }
  } finally {
    started.forEach(function (job) { try { w.jobs.cancelJob(job.id); } catch (e) { /* gone */ } });
    await sleep(300);
    w.close();
  }
}

module.exports = { withDoor: withDoor, withoutDoor: withoutDoor };
