'use strict';

// desk/G2.3: publishing. A helper, not a suite: jobCallback.js runs these through its stand-in door
// (oneDoor.js counts that door once, there). The shell's half is shellPublish.js.
// Andy: "the servers should send explicit messages via an appServerFunction, so the ui gets structured
// information." "it calls with a js object. let the appServer to the work." "no pulling".
// The contract the builder follows:
//   jobs.update takes one small app object, `app`, beside status and log; updateJob keeps it on the job
//   and emits 'job-updated' with it.
//   appServer.publish(object) reports it through spirit.core.jobs.report. It caps size (a 1 MB object never
//   arrives) and rate (a burst arrives as fewer updates, and the last object published is the one that stays).
//   appServer's announce is published the same way, not written to stdout.

const os = require('os');
const path = require('path');

const OWED = 'OWED by desk/G2.3: ';
const FIXTURE = path.join(__dirname, 'fixtures', 'publishFixture.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100); } return fn(); }
function pipeFor(tag) {
  const name = 'spirit-publish-' + tag + '-' + process.pid;
  return process.platform === 'win32' ? '\\\\.\\pipe\\' + name : path.join(os.tmpdir(), name + '.sock');
}

async function withDoor(test, jobs) {
  const updates = [];
  const onUpdate = function (job) { updates.push(JSON.parse(JSON.stringify(job))); };
  jobs.events.on('job-updated', onUpdate);
  const started = [];
  const start = function (mode) {
    const job = jobs.startServerJob(process.execPath, [FIXTURE, mode, '--pipe', pipeFor(mode)], { type: 'publish-' + mode, operated: 'user' });
    started.push(job);
    return job;
  };
  const appsOf = function (job) { return updates.filter(function (u) { return u.id === job.id && u.app; }).map(function (u) { return u.app; }); };

  try {
    test.subHeading('desk/G2.3: jobs.update carries an app object');
    const plain = jobs.startServerJob(process.execPath, ['-e', 'setInterval(function(){},1000)'], { type: 'publish-plain', operated: 'user' });
    started.push(plain);
    const after = jobs.updateJob(plain.id, { app: { shown: 'yes' } });
    if (after && after.app && after.app.shown === 'yes') test.check('updateJob keeps the app object on the job');
    else test.fail(OWED + 'updateJob dropped the app object: ' + JSON.stringify(after && after.app));
    if (appsOf(plain).some(function (a) { return a.shown === 'yes'; })) test.check('job-updated carries the app object');
    else test.fail(OWED + 'no job-updated carried the app object');

    test.subHeading('desk/G2.3: appServer.publish reaches the job');
    const small = start('small');
    const got = await until(function () { return appsOf(small).filter(function (a) { return a.hello === 'page'; })[0]; }, 5000);
    if (got && got.n === 1) test.check('a published JS object arrives on the job as it was sent');
    else test.fail(OWED + 'the published object never arrived: ' + JSON.stringify(appsOf(small)));

    test.subHeading('desk/G2.3: the announce is published, not printed');
    const announced = await until(function () { return appsOf(small).some(function (a) { return /ping/.test(JSON.stringify(a)); }); }, 5000);
    if (announced) test.check('the server\'s verbs arrive as a published object');
    else test.fail(OWED + 'no published object names the verb ping');
    const logged = (jobs.getJob(small.id).log || []).some(function (l) { return /listening on/.test(l.message); });
    if (!logged) test.check('the announce is not in the job\'s log');
    else test.fail(OWED + 'the announce still goes to stdout, and so to the log');

    test.subHeading('desk/G2.3: size is capped');
    const big = start('big');
    await until(function () { return (jobs.getJob(big.id).data || {}).pid; }, 5000);
    await sleep(1500);
    // Not vacuous: the same server's announce must have come through, so publish works there.
    const bigAlive = appsOf(big).some(function (a) { return /ping/.test(JSON.stringify(a)); });
    if (bigAlive && !appsOf(big).some(function (a) { return a.blob; })) test.check('a 1 MB object does not arrive, while its announce did');
    else test.fail(OWED + (bigAlive ? 'a 1 MB object was published whole' : 'the server publishing 1 MB published nothing at all'));

    test.subHeading('desk/G2.3: rate is capped, the last object stays');
    const burst = start('burst');
    const last = await until(function () { const j = jobs.getJob(burst.id); return j && j.app && j.app.n === 199; }, 6000);
    if (last) test.check('after a burst of 200, the job holds the last object');
    else test.fail(OWED + 'after a burst the job holds ' + JSON.stringify(jobs.getJob(burst.id).app));
    const count = appsOf(burst).filter(function (a) { return typeof a.n === 'number'; }).length;
    if (count > 0 && count < 200) test.check('the burst arrived as ' + count + ' updates, fewer than 200');
    else test.fail(OWED + 'the burst arrived as ' + count + ' updates');
  } finally {
    jobs.events.removeListener('job-updated', onUpdate);
    started.forEach(function (job) { try { jobs.cancelJob(job.id); } catch (e) { /* gone */ } });
  }
}

module.exports = { withDoor: withDoor };
