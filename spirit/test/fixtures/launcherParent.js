'use strict';

// spirit/test/fixtures/launcherParent.js
// A STAND-IN NODE for launcherChecks.js (goal/G43.23, restored from 885f1ab5^ on today's jobs module): it installs the
// real jobs module of its run tree (spirit/jobs.js, installJobs(port) since goal/G40.6), starts one job of the kind asked
// for, a one-shot or a server, and then waits to be killed. When it dies, its job's process must not outlive it.
// Run from the scratch copy launcherChecks.js makes, so the job's fixture loads that tree's spirit.js.
//
// argv: <kind: oneshot | server> <pidFile> <port> [pipe]
const path = require('path');

const kind = process.argv[2];
const pidFile = process.argv[3];
const port = Number(process.argv[4]) || 0;
const pipe = process.argv[5] || '';
const jobs = require(path.join(__dirname, '..', '..', 'run', 'spirit', 'jobs.js'))(port);
const fixture = path.join(__dirname, 'jobCallbackFixture.js');
if (kind === 'server') jobs.startServerJob(process.execPath, [fixture, JSON.stringify({ mode: 'serve', pidFile: pidFile }), '--pipe', pipe], { type: 'launcher-server' });
else jobs.startProcessJob(process.execPath, [fixture, JSON.stringify({ mode: 'wait', pidFile: pidFile })], { type: 'launcher-oneshot' });
setInterval(function () {}, 1000);
