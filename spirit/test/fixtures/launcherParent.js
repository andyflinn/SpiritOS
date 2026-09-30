'use strict';

// A stand-in node for oneLauncher.js: it installs the real jobs module, starts one job of the kind asked for,
// and then waits to be killed. When it dies, its job's process must not outlive it.
const path = require('path');
const spirit = require('../../run/js/kernel.js');

const kind = process.argv[2];
const pidFile = process.argv[3];
const jobs = require('../../run/js/jobs.js')(spirit, 1);
const fixture = path.join(__dirname, 'launcherFixture.js');
const arg = JSON.stringify({ pidFile: pidFile });
if (kind === 'server') jobs.startServerJob(process.execPath, [fixture, arg], { type: 'launcher-server' });
else jobs.startProcessJob(process.execPath, [fixture, arg], { type: 'launcher-oneshot' });
setInterval(function () {}, 1000);
