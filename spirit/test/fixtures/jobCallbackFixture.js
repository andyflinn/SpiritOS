'use strict';

// spirit/test/fixtures/jobCallbackFixture.js
// A PROCESS AS TODAY'S PROCESSES ARE WRITTEN, for launcherChecks.js (goal/G43.23, restored from 885f1ab5^ and rewritten
// on today's API). It loads the one spirit object, spirit.js, and reports on its own job through spirit.jobs (log,
// report, complete, fail: the events family's publish with its SPIRIT_JOB_ID, goal/G40.6), as the old kernel's
// spirit.core.jobs did before. Spawned by the real jobs module as a real child, never a mock of the contract.
//
// RUN ONLY FROM A SCRATCH COPY of the run tree (launcherChecks.js makes it): spirit.js posts to the port in its run
// root's spirit/state/environment.json, and the checkout's names a live node. So it refuses to start unless that port
// is the one the test named in SPIRIT_FIXTURE_PORT.
//
// argv[2], JSON:
//   {outcome: 'complete', data}     log 'fixture running', then complete(data), then exit 0
//   {outcome: 'fail', message}      log 'fixture running', then fail(message), then exit 0
//   {mode: 'wait', pidFile}         a one-shot that runs on: its pid written, what it was given reported, never exits
//   {mode: 'serve', pidFile}        a server: the same, then appServer.serve on the --pipe it was handed
const fs = require('fs');
const path = require('path');

const RUN = path.join(__dirname, '..', '..', 'run');
let port = 0;
try { port = Number(JSON.parse(fs.readFileSync(path.join(RUN, 'spirit', 'state', 'environment.json'), 'utf8')).PORT) || 0; } catch (e) { port = 0; }
if (!port || String(port) !== String(process.env.SPIRIT_FIXTURE_PORT || '')) {
  console.error('jobCallbackFixture: not in a scratch run tree of the test (port ' + port + '); refused');
  process.exit(3);
}

require(path.join(RUN, 'spirit', 'spirit.js'));

const args = JSON.parse(process.argv[2] || '{}');
if (args.pidFile) fs.writeFileSync(args.pidFile, String(process.pid));

const seen = { sawJobId: process.env.SPIRIT_JOB_ID || '', sawCallback: process.env.SPIRIT_CALLBACK_URL || '', hasIpc: typeof process.send === 'function' };

async function main() {
  if (args.mode === 'wait' || args.mode === 'serve') {
    await spirit.jobs.report({ data: seen }).catch(function () { /* the test reads what arrived */ });
    if (args.mode === 'serve') require(path.join(RUN, 'spirit', 'appServer.js')).serve({});
    setInterval(function () {}, 1000);
    return;
  }
  await spirit.jobs.log('fixture running');
  if (args.outcome === 'fail') await spirit.jobs.fail(args.message || 'boom');
  else await spirit.jobs.complete(args.data || {});
  process.exit(0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
