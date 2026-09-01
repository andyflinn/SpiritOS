'use strict';

// Exercises the actual SPIRIT_JOB_ID / SPIRIT_CALLBACK_URL contract
// end-to-end: a real child process (fixtures/jobCallbackFixture.js) calling
// spirit.core.jobs.log/complete/fail (kernel.js), POSTing over real HTTP to
// a callback route that forwards straight into jobs.js's updateJob — the
// same wiring server.js's handleJobUpdate uses for POST /api/jobs/:id. Runs
// its own throwaway HTTP server on an OS-assigned port rather than booting
// the real server.js, so it can't collide with an already-running dev
// server and carries none of that file's other startup side effects
// (fs-watcher, stats job, static serving).
const http = require('http');
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

test.startTest('Job report/complete/fail over the callback URL');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'jobCallbackFixture.js');
const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 5000;

function waitForTerminal(jobs, jobId) {
  return new Promise(function (resolve) {
    const startedAt = Date.now();
    const poll = setInterval(function () {
      const job = jobs.getJob(jobId);
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
    const callbackServer = http.createServer(function (req, res) {
      const match = req.url.match(/^\/api\/jobs\/(.+)$/);
      let body = '';
      req.on('data', function (chunk) { body += chunk; });
      req.on('end', function () {
        let patch = {};
        try { patch = body ? JSON.parse(body) : {}; } catch (e) { /* malformed — treat as empty patch */ }
        const job = match ? jobs.updateJob(match[1], patch) : null;
        res.writeHead(job ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(job));
      });
    });

    var jobs; // set once we know the port we're actually listening on
    callbackServer.listen(0, '127.0.0.1', function () {
      const port = callbackServer.address().port;
      jobs = require('../run/js/jobs.js')(spirit, port);
      fn(jobs)
        .then(function (result) { callbackServer.close(); resolve(result); })
        .catch(function (err) { callbackServer.close(); reject(err); });
    });
  });
}

withJobsServer(function (jobs) {
  return Promise.resolve()
    // ---- complete() ----
    .then(function () {
      const job = jobs.startProcessJob('node', [FIXTURE_PATH, JSON.stringify({ outcome: 'complete', data: { sample: 42 } })], { type: 'test-complete' });
      return waitForTerminal(jobs, job.id).then(function (finalJob) {
        if (finalJob.status === 'completed') {
          test.check('complete() drives the job to status "completed"');
        } else {
          test.fail('complete() should have reached "completed" but status is ' + JSON.stringify(finalJob && finalJob.status));
        }
        if (finalJob.data && finalJob.data.sample === 42) {
          test.check('complete()\'s data payload is merged into the job');
        } else {
          test.fail('complete()\'s data payload was not merged correctly: ' + JSON.stringify(finalJob && finalJob.data));
        }
        if (finalJob.log.some(function (entry) { return entry.message === 'fixture running'; })) {
          test.check('log() entries sent before complete() are preserved in job.log');
        } else {
          test.fail('expected log entry "fixture running" is missing from job.log');
        }
      });
    })
    // ---- fail() ----
    .then(function () {
      const job = jobs.startProcessJob('node', [FIXTURE_PATH, JSON.stringify({ outcome: 'fail', message: 'boom' })], { type: 'test-fail' });
      return waitForTerminal(jobs, job.id).then(function (finalJob) {
        if (finalJob.status === 'failed') {
          test.check('fail() drives the job to status "failed"');
        } else {
          test.fail('fail() should have reached "failed" but status is ' + JSON.stringify(finalJob && finalJob.status));
        }
        if (finalJob.data && finalJob.data.error === 'boom') {
          test.check('fail()\'s error message is recorded in job.data.error');
        } else {
          test.fail('fail()\'s error message was not recorded correctly: ' + JSON.stringify(finalJob && finalJob.data));
        }
      });
    })
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
  test.reportSuccessFailureCount();
}).catch(function (err) {
  test.fail('unexpected error running the job-callback test: ' + (err && err.stack || err));
  test.reportSuccessFailureCount();
});
