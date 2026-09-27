'use strict';

// spirit/test/processServer.js
// THE SERVER PROCESS TYPE — public-app-server/G19.1 (design/principles/PROCESSES.md).
//
// A real server job, spawned by the jobs module against a stand-in for its
// node's door: it gets its job id and the door's address, logs to its job,
// asks a verb through spirit.core.ask exactly as a page would, has its
// output read into its job's log, and on the shutdown verb tidies up and
// exits, while one that ignores the verb is killed after the grace period.
// The declarations for this step are wsl-claude's (processServerPending.js).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
const KERNEL = path.join(RUN, 'js', 'kernel.js');

function waitFor(check, ms) {
  const until = Date.now() + ms;
  return new Promise(function (resolve) {
    (function poll() {
      if (check()) { resolve(true); return; }
      if (Date.now() > until) { resolve(false); return; }
      setTimeout(poll, 50);
    })();
  });
}

test.startTest('The server process type: its contract, its log, and its shutdown');

// A stand-in for the node's door: records every verb posted to it.
const seen = [];
const door = http.createServer(function (req, res) {
  let text = '';
  req.on('data', function (c) { text += c; });
  req.on('end', function () {
    let body = null;
    try { body = JSON.parse(text); } catch (e) { body = null; }
    seen.push(body || {});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, echoed: body && body.verb }));
  });
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-server-'));
const polite = path.join(dir, 'polite.js');
fs.writeFileSync(polite, [
  "const spirit = require(" + JSON.stringify(KERNEL) + ");",
  "console.log('started as ' + process.env.SPIRIT_APP);",
  "spirit.core.jobs.log('hello from the server');",
  "spirit.core.ask('probe.verb', { x: 1 }).then(function (r) { spirit.core.jobs.log('asked: ' + r.status + ' ' + (r.body && r.body.echoed)); });",
  "spirit.core.server.onShutdown(function () { return spirit.core.jobs.log('tidied'); });",
  "setInterval(function () {}, 1000);",
].join('\n'));
const stubborn = path.join(dir, 'stubborn.js');
fs.writeFileSync(stubborn, "process.on('message', function () {}); setInterval(function () {}, 1000);\n");

new Promise(function (resolve) { door.listen(0, '127.0.0.1', resolve); }).then(function () {
  const port = door.address().port;
  const spirit = require(KERNEL);
  const jobs = require('../run/js/jobs.js')(spirit, port);

  test.subHeading('A server job gets its job id and its node\'s door, and uses both');
  const job = jobs.startServerJob(process.execPath, [polite], { cwd: os.tmpdir(), type: 'app-server:probe', env: { SPIRIT_APP: 'probe' } });
  return waitFor(function () {
    return seen.some(function (b) { return b.verb === 'probe.verb'; }) &&
      seen.some(function (b) { return b.verb === 'jobs.update' && /^asked: /.test(String(b.logMessage || '')); });
  }, 8000).then(function (ok) {
    const logged = seen.filter(function (b) { return b.verb === 'jobs.update' && b.logMessage === 'hello from the server'; });
    if (ok && logged.length && logged[0].id === job.id) {
      test.check('it logs to its own job: the report carries SPIRIT_JOB_ID, which is this job\'s id');
    } else {
      test.fail('no log reached the door under this job\'s id: ' + JSON.stringify(seen).slice(0, 300));
    }
    const probe = seen.filter(function (b) { return b.verb === 'probe.verb'; })[0];
    const answered = seen.filter(function (b) { return /^asked: 200 probe\.verb$/.test(String(b.logMessage || '')); })[0];
    if (probe && probe.x === 1 && answered) {
      test.check('spirit.core.ask works from a process: the verb and its args reach the door, and the answer comes back in the page\'s shape');
    } else {
      test.fail('spirit.core.ask from a process: ' + JSON.stringify({ probe: probe, answered: !!answered }));
    }
    const lines = (jobs.getJob(job.id).log || []).map(function (e) { return e.message; });
    if (lines.indexOf('started as probe') !== -1) {
      test.check('its output is read into its job\'s log line by line, so the monitor shows it (and SPIRIT_APP names its app)');
    } else {
      test.fail('stdout did not reach the job log: ' + JSON.stringify(lines).slice(0, 300));
    }

    test.subHeading('The shutdown verb: asked for, then enforced');
    const stubbornJob = jobs.startServerJob(process.execPath, [stubborn], { cwd: os.tmpdir(), type: 'app-server:stubborn' });
    return waitFor(function () { return jobs.getJob(stubbornJob.id).status === 'running'; }, 3000).then(function () {
      const began = Date.now();
      return jobs.stopServers(1500).then(function () {
        const took = Date.now() - began;
        const tidied = seen.some(function (b) { return b.verb === 'jobs.update' && b.logMessage === 'tidied'; });
        if (tidied) test.check('a server that registered onShutdown ran it before exiting');
        else test.fail('the polite server never reported "tidied"');
        const a = jobs.getJob(job.id).status;
        const b = jobs.getJob(stubbornJob.id).status;
        if (a === 'stopped' && b === 'stopped' && took >= 1400 && took < 5000) {
          test.check('stopServers asks every server; the one ignoring the verb is killed after the grace (' + took + ' ms), and both end "stopped"');
        } else {
          test.fail('stopServers: ' + JSON.stringify({ a: a, b: b, took: took }));
        }
      });
    });
  });
}).then(function () {
  door.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* runAll reclaims temp homes */ }
  test.reportSuccessFailureCount();
}).catch(function (e) {
  test.fail('the suite itself failed: ' + ((e && e.stack) || e));
  try { door.close(); } catch (x) { /* closed */ }
  test.reportSuccessFailureCount();
});

module.exports = test;
