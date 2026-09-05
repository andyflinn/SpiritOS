'use strict';

// Exercises two places where the jobs registry's own vocabulary doesn't
// line up with itself (jobs.js):
//
//   1. startFsWatcherJob's error handler sets status 'error', which is not
//      in TERMINAL_STATUSES. deleteJob refuses every non-terminal job, so a
//      watcher that dies leaves a row in Jobs that can never be cleared —
//      cancelJob won't finish it either, because it calls _stop() on an
//      already-closed watcher and then updates to 'stopped' anyway;
//   2. every SSE connection adds two listeners to jobs.events
//      (job-updated + job-deleted) and nothing raises the emitter's limit,
//      so Node's default of 10 turns the sixth open tab into a
//      MaxListenersExceededWarning that reads like a leak.
//
// EXPECTED TO FAIL until both are fixed. The terminal-status cases in
// between already pass and are asserted so a fix can't regress them.
//
// Pure in-memory registry work: installJobs() only defines the registry,
// and nothing here calls startFsWatcherJob or startStatsJob, so no watcher,
// no interval and no child process is ever created. Safe against a live
// checkout.
const fs = require('fs');
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

const SSE_LISTENERS_PER_CONNECTION = 2;
const PLAUSIBLE_OPEN_TABS = 16;

test.startTest('Jobs registry lifecycle (jobs.js)');

const jobs = require('../run/js/jobs.js')(spirit, 65432);

// ---- 1. a job that failed must be removable ----
test.subHeading('Terminal states can be deleted');

// Baseline first: the statuses that ARE in TERMINAL_STATUSES behave, so
// the failure below is specifically about 'error' and not about deleteJob.
['completed', 'failed', 'cancelled', 'stopped'].forEach(function (status) {
  const job = jobs.createJob('process', 'lifecycle-probe', {});
  jobs.updateJob(job.id, { status: status });
  if (jobs.deleteJob(job.id) === true) {
    test.check("a '" + status + "' job can be deleted");
  } else {
    test.fail("a '" + status + "' job could not be deleted");
  }
});

// The gap, stated as the invariant rather than as one status name: every
// status jobs.js can actually put a job into has to be one the rest of the
// file agrees exists. startFsWatcherJob used to set 'error', which is in
// neither TERMINAL_STATUSES nor the running/pending pair createJob starts
// from — so a watcher that died was permanently undeletable, deleteJob
// refusing it forever. Asserted against the source because the only
// producer is an fs.watch 'error' event, which a test can't provoke
// reliably; a hand-set status would only be testing this test.
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'jobs.js'), 'utf8');
  const KNOWN_STATUSES = new Set(['completed', 'failed', 'cancelled', 'stopped', 'running', 'pending']);

  const assigned = new Set();
  const pattern = /status:\s*'([a-z]+)'/g;
  let match;
  while ((match = pattern.exec(source)) !== null) assigned.add(match[1]);

  const unknown = Array.from(assigned).filter(function (s) { return !KNOWN_STATUSES.has(s); });
  if (unknown.length === 0) {
    test.check('jobs.js assigns only known statuses (' + Array.from(assigned).sort().join(', ') + ')');
  } else {
    test.fail('jobs.js assigns status ' + unknown.map(JSON.stringify).join(', ') +
      ', which is in neither TERMINAL_STATUSES nor {running, pending} — a job left in that state ' +
      'can never be deleted, because deleteJob refuses every non-terminal job');
  }
}

// A watcher that already failed must not be stopped a second time —
// cancelJob would otherwise call _stop() on an already-closed fs watcher.
// This is why the fix was "stop producing a status outside the set" rather
// than "add 'error' to TERMINAL_STATUSES": reaching a terminal state is
// what makes cancelJob return early instead of re-running teardown.
{
  const job = jobs.createJob('permanent', 'fs-watcher', {});
  let stopCalls = 0;
  job._stop = function () { stopCalls++; };
  jobs.updateJob(job.id, { status: 'failed' }); // what watcher.on('error') now sets
  jobs.cancelJob(job.id);
  if (stopCalls === 0) {
    test.check('cancelling an already-failed watcher does not call _stop again');
  } else {
    test.fail('cancelling an already-failed watcher called _stop ' + stopCalls + ' time(s) — ' +
      'teardown ran twice on a closed watcher');
  }
}

// ---- 2. the SSE fan-out must not trip Node's listener warning ----
test.subHeading('The events emitter is sized for real SSE fan-out');
{
  const limit = jobs.events.getMaxListeners();
  const supportedTabs = limit === 0 ? Infinity : Math.floor(limit / SSE_LISTENERS_PER_CONNECTION);

  if (limit === 0 || supportedTabs >= PLAUSIBLE_OPEN_TABS) {
    test.check('jobs.events supports ' + (limit === 0 ? 'unlimited' : supportedTabs) +
      ' concurrent SSE connections');
  } else {
    test.fail('jobs.events allows only ' + limit + ' listeners (' + supportedTabs +
      ' SSE connections) before Node prints MaxListenersExceededWarning — ' +
      'each connection registers ' + SSE_LISTENERS_PER_CONNECTION +
      ' (job-updated, job-deleted), and having ' + PLAUSIBLE_OPEN_TABS + ' tabs open is ordinary');
  }
}

test.reportSuccessFailureCount();
