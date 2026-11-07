'use strict';

// Starts real child processes through jobs.js's startProcessJob with a
// hand-written stub of POST /api/spirit (verb jobs.update) on an
// OS-assigned port; it does not boot server.js. The node publishes a
// job's updates through events.publish now, so the stub stands in for a
// route that no longer exists.
const http = require('http');
const path = require('path');
const spirit = require('../run/spirit/kernel.js');
const test = require('./testSupport.js');

test.startTest('Job report/complete/fail over the callback URL');

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 5000;

// A COMPLETED JOB IS GONE AT ONCE (goal/G29.16: a transient job removes itself unless it failed), so the job as its last
// update carried it is read from the job-updated events, the way every page sees it.
const lastSeen = Object.create(null);
function waitForTerminal(jobs, jobId) {
  return new Promise(function (resolve) {
    const startedAt = Date.now();
    const poll = setInterval(function () {
      const job = jobs.getJob(jobId) || lastSeen[jobId];
      const isTerminal = job && (job.status === 'completed' || job.status === 'failed');
      if (isTerminal || Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(poll);
        resolve(job);
      }
    }, POLL_INTERVAL_MS);
  });
}

function withJobsServer(fn) {
  return new Promise(function (resolve, reject) {
    // THE DOOR THIS STANDS IN FOR: SPIRIT_CALLBACK_URL is
    // `http://localhost:<port>/api/spirit` (jobs.js, launch), and the job
    // id travels as a field beside the verb. A hand-written copy, since
    // the suite does not boot server.js (see the header); it can fall out
    // of step with the node, and it has: the node publishes a job's
    // updates through events.publish now, not a jobs.update handler.
    const callbackServer = http.createServer(function (req, res) {
      const onDoor = req.url === '/api/spirit';
      let body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('end', function () {
        let sent = {};
        try { sent = body ? JSON.parse(body) : {}; } catch (e) { /* malformed — treat as empty */ }

        // The verb and the id are the envelope; everything else is the
        // patch handed to updateJob.
        const patch = Object.assign({}, sent);
        const id = String(patch.id || '');
        delete patch.id;
        delete patch.verb;

        const job = (onDoor && sent.verb === 'jobs.update' && id)
          ? jobs.updateJob(id, patch) : null;
        res.writeHead(job ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(job));
      });
    });

    var jobs; // set once we know the port we're actually listening on
    callbackServer.listen(0, '127.0.0.1', function () {
      const port = callbackServer.address().port;
      jobs = require('../run/spirit/jobs.js')(port);
      jobs.events.on('job-updated', function (j) { lastSeen[j.id] = JSON.parse(JSON.stringify(j)); });
      fn(jobs)
        .then(function (result) { callbackServer.close(); resolve(result); })
        .catch(function (err) { callbackServer.close(); reject(err); });
    });
  });
}

withJobsServer(function (jobs) {
  return Promise.resolve()
    // ---- a child that never calls report()/complete()/fail() at all — the
    // exit-code fallback in jobs.js's own child.on('exit') handler must
    // still resolve the job, so a script that forgets to report doesn't
    // hang forever in "running".
    .then(function () {
      const job = jobs.startProcessJob('node', ['-e', 'process.exit(1)'], { type: 'test-crash-fallback' });
      return waitForTerminal(jobs, job.id).then(function (finalJob) {
        if (finalJob.status === 'failed' && finalJob.data && finalJob.data.exitCode === 1) {
          test.check('a process that exits nonzero without reporting still resolves via the exit-code fallback');
        } else {
          test.fail('exit-code fallback did not resolve as expected: ' + JSON.stringify(finalJob));
        }
      });
    });
}).then(function () {
  // desk/G2.2's checks need this door too; they live in launcherChecks.js.
  const launcher = require('./launcherChecks.js');
  return withJobsServer(function (jobs) { return launcher.withDoor(test, jobs); })
    .then(function () { return launcher.withoutDoor(test); });
}).then(function () {
  // desk/G2.3's process half needs this door too; it lives in publishChecks.js.
  const publish = require('./publishChecks.js');
  return withJobsServer(function (jobs) { return publish.withDoor(test, jobs); });
}).then(function () {
  test.reportSuccessFailureCount();
}).catch(function (err) {
  test.fail('unexpected error running the job-callback test: ' + (err && err.stack || err));
  test.reportSuccessFailureCount();
});
