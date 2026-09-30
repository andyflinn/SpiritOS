'use strict';

// desk/G2.2: one launcher for every process. A helper, not a suite: jobCallback.js runs these through its
// stand-in door (oneDoor.js counts that door once, there).
// Andy: "if a server is a process, it should get the perks of a process, that's no stretch."
// "can those not collapse into one interface, that can't drift?" "the one shots should have that too, who wants dangeling processes"
// The contract: js/jobs.js spawns every process in one place; every process gets SPIRIT_JOB_ID,
// SPIRIT_CALLBACK_URL and an IPC channel; a process that loads the kernel exits when its node goes;
// restart with backoff stays an option for servers. stdout only in DEBUG waits for desk/G2.5.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const OWED = 'OWED by desk/G2.2: ';
const FIXTURE = path.join(__dirname, 'fixtures', 'launcherFixture.js');
const PARENT = path.join(__dirname, 'fixtures', 'launcherParent.js');
const JOBS = path.join(__dirname, '..', 'run', 'js', 'jobs.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100); } return fn(); }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }

async function withDoor(test, jobs) {
  const seen = function (job) { const j = jobs.getJob(job.id); return j && j.data && 'hasIpc' in j.data ? j.data : null; };

  test.subHeading('desk/G2.2: a server job gets the same contract as a one-shot');
  const server = jobs.startServerJob(process.execPath, [FIXTURE, '{}'], { type: 'launcher-server', operated: 'user' });
  const s = await until(function () { return seen(server); }, 5000);
  if (s && s.sawJobId === server.id && s.sawCallback) test.check('the server saw SPIRIT_JOB_ID and SPIRIT_CALLBACK_URL, and reported through them');
  else test.fail(OWED + 'a server job reported nothing, or without its job id: ' + JSON.stringify(s));
  if (s && s.hasIpc) test.check('the server has an IPC channel');
  else test.fail(OWED + 'the server has no IPC channel: ' + JSON.stringify(s));

  test.subHeading('desk/G2.2: a one-shot job gets an IPC channel too');
  const oneshot = jobs.startProcessJob(process.execPath, [FIXTURE, '{}'], { type: 'launcher-oneshot' });
  const o = await until(function () { return seen(oneshot); }, 5000);
  if (o && o.sawJobId === oneshot.id) test.check('the one-shot reported through its job id');
  else test.fail('the one-shot reported nothing: ' + JSON.stringify(o));
  if (o && o.hasIpc) test.check('the one-shot has an IPC channel');
  else test.fail(OWED + 'the one-shot has no IPC channel');

  test.subHeading('desk/G2.2: stopping a job ends its process');
  const pids = [server, oneshot].map(function (job) { return (jobs.getJob(job.id).data || {}).pid; });
  [server, oneshot].forEach(function (job) { try { jobs.cancelJob(job.id); } catch (e) { /* named by the build */ } });
  const gone = await until(function () { return pids.every(function (p) { return p && !alive(p); }); }, 5000);
  if (gone) test.check('after cancel, neither process is running');
  else test.fail('after cancel, still running: ' + JSON.stringify(pids.filter(alive)));

  test.subHeading('desk/G2.2: a server still restarts when it exits');
  const flaky = jobs.startServerJob(process.execPath, [FIXTURE, JSON.stringify({ mode: 'once', code: 1 })], { type: 'launcher-flaky' });
  const restarted = await until(function () { const j = jobs.getJob(flaky.id); return j && j.data && j.data.restarts >= 1; }, 6000);
  if (restarted) test.check('a node-operated server that exits is started again');
  else test.fail('a node-operated server was not restarted: ' + JSON.stringify(jobs.getJob(flaky.id)));
  try { jobs.cancelJob(flaky.id); } catch (e) { /* gone */ }
}

async function withoutDoor(test) {
  test.subHeading('desk/G2.2: no process outlives its node');
  for (const kind of ['oneshot', 'server']) {
    const pidFile = path.join(os.tmpdir(), 'spirit-launcher-' + kind + '-' + process.pid + '.pid');
    try { fs.unlinkSync(pidFile); } catch (e) { /* none */ }
    const parent = spawn(process.execPath, [PARENT, kind, pidFile], { stdio: 'ignore' });
    const pid = await until(function () { try { return Number(fs.readFileSync(pidFile, 'utf8')) || 0; } catch (e) { return 0; } }, 5000);
    parent.kill('SIGKILL');
    const ended = pid ? await until(function () { return !alive(pid); }, 5000) : false;
    if (ended) test.check('the ' + kind + ' process ended when its node was killed');
    else {
      test.fail(OWED + 'the ' + kind + ' process ' + (pid ? pid + ' outlived its node' : 'never started'));
      if (pid) { try { process.kill(pid); } catch (e) { /* gone */ } }
    }
    try { fs.unlinkSync(pidFile); } catch (e) { /* gone */ }
  }

  test.subHeading('desk/G2.2: one launcher, jobs.js spawns in one place');
  const spawns = (code(JOBS).match(/\bspawn\s*\(/g) || []).length;
  if (spawns === 1) test.check('js/jobs.js has one spawn call');
  else test.fail(OWED + 'js/jobs.js has ' + spawns + ' spawn calls, one per kind of job');
}

module.exports = { withDoor: withDoor, withoutDoor: withoutDoor };
