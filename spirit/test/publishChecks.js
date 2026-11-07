'use strict';

// desk/G2.3: publishing. A helper, not a suite: jobCallback.js runs these through its stand-in door
// (oneDoor.js counts that door once, there).
// Andy: "the servers should send explicit messages via an appServerFunction, so the ui gets structured
// information." "it calls with a js object. let the appServer to the work." "no pulling".
// What it checks:
//   updateJob keeps an `app` object on the job and emits 'job-updated' with it.

const OWED = 'OWED by desk/G2.3: ';

async function withDoor(test, jobs) {
  const updates = [];
  const onUpdate = function (job) { updates.push(JSON.parse(JSON.stringify(job))); };
  jobs.events.on('job-updated', onUpdate);
  const started = [];
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
  } finally {
    jobs.events.removeListener('job-updated', onUpdate);
    started.forEach(function (job) { try { jobs.cancelJob(job.id); } catch (e) { /* gone */ } });
  }
}

module.exports = { withDoor: withDoor };
