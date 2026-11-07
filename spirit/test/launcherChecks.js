'use strict';

// desk/G2.2: one launcher for every process. A helper, not a suite: jobCallback.js runs these through its
// stand-in door (oneDoor.js counts that door once, there).
// Andy: "if a server is a process, it should get the perks of a process, that's no stretch."
// "can those not collapse into one interface, that can't drift?" "the one shots should have that too, who wants dangeling processes"
// The contract: spirit/run/spirit/jobs.js spawns every process in one place; every process gets SPIRIT_JOB_ID,
// SPIRIT_CALLBACK_URL and an IPC channel; a process that loads the kernel exits when its node goes;
// restart with backoff stays an option for servers. Output only in DEBUG (desk/G2.5) is jobs.js's, not asserted here.

const fs = require('fs');
const path = require('path');

const OWED = 'OWED by desk/G2.2: ';
const FIXTURE = path.join(__dirname, 'fixtures', 'launcherFixture.js');
const JOBS = path.join(__dirname, '..', 'run', 'spirit', 'jobs.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
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

async function withoutDoor(test) {
  test.subHeading('desk/G2.2: one launcher, jobs.js spawns in one place');
  const spawns = (code(JOBS).match(/\bspawn\s*\(/g) || []).length;
  if (spawns === 1) test.check('spirit/jobs.js has one spawn call');
  else test.fail(OWED + 'spirit/jobs.js has ' + spawns + ' spawn calls, one per kind of job');
}

module.exports = { withDoor: withDoor, withoutDoor: withoutDoor };
