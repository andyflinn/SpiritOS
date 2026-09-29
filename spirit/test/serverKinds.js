'use strict';

// spirit/test/serverKinds.js
// TWO KINDS OF SERVER — processes/G1.3, written FIRST, red on today's code.
//
//   Andy, 2026-09-28, go on processes/G1.3, under "they must be red before
//   wsl pulls the implementation, and green after". Decided: a process
//   manifest says 'kind': 'server' and 'operated': 'node' or 'user'.
//   Node-operated: started at boot, restarted when it exits, gone with the
//   node, no Cancel. User-operated: started from Processes (jobs.create),
//   Cancel in Jobs ends it, a crash leaves it down and failed, and a node
//   restart does not bring it back ("NO"). jobs.create may start one: Andy's
//   yes on the verb, "YES it's the only existing user door to server launch".
//
// The units this asks for: jobs.startJob (what jobs.create calls: a server
// or a one-shot, by the script's manifest), jobs.startNodeServers(rootDir)
// (the boot's scan of process/js), and the Jobs app's Cancel rule.

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const { relayRequest } = require('../run/js/relayRequest.js');

test.startTest('processes/G1.3: node-operated and user-operated servers');

const OWED = 'OWED by processes/G1.3: ';
const RUN = path.join(__dirname, '..', 'run');
const COUNTER = path.join(RUN, 'process', 'js', 'counterServer', 'counterServer.js');
const JOBS_APP = path.join(RUN, 'shell', 'jobs', 'jobs.js');
const jobs = require('../run/js/jobs.js')(spirit, 65432);

function freePort() {
  return new Promise(function (resolve) {
    const s = net.createServer().listen(0, '127.0.0.1', function () { const p = s.address().port; s.close(function () { resolve(p); }); });
  });
}
function isOpen(port) {
  return new Promise(function (resolve) {
    const s = net.connect(port, '127.0.0.1', function () { s.destroy(); resolve(true); });
    s.on('error', function () { resolve(false); });
  });
}
function waitFor(fn, ms) {
  const until = Date.now() + (ms || 8000);
  return (function poll() {
    return Promise.resolve(fn()).then(function (ok) {
      if (ok || Date.now() > until) return ok;
      return new Promise(function (r) { setTimeout(r, 150); }).then(poll);
    });
  }());
}
// Through the node's own request helper, as counterPage.js does (oneDoor.js).
function count(port) {
  return relayRequest('http://127.0.0.1:' + port, 'GET', '/', null).then(function (r) {
    const m = String(r.text || '').match(/served (\d+) time/); return m ? Number(m[1]) : null;
  }, function () { return null; });
}
const pause = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

// A node home with the counter server installed twice: once node-operated,
// once user-operated, each on its own port.
function home(nodePort, userPort) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-serverkinds-'));
  [['counterNode', 'node', nodePort], ['counterUser', 'user', userPort]].forEach(function (s) {
    const dir = path.join(root, 'process', 'js', s[0]);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(COUNTER, path.join(dir, s[0] + '.js'));
    fs.writeFileSync(path.join(dir, s[0] + '.json'), JSON.stringify({
      label: s[0], kind: 'server', operated: s[1],
      args: [{ name: 'port', type: 'number', label: 'Port', default: s[2] }],
    }));
  });
  return root;
}

const has = function (name) { return typeof jobs[name] === 'function'; };

(async function () {
  const nodePort = await freePort();
  const userPort = await freePort();
  const root = home(nodePort, userPort);
  const userScript = path.join(root, 'process', 'js', 'counterUser', 'counterUser.js');

  // ── T1 ──────────────────────────────────────────────────────────────
  test.subHeading('T1: a server started from Processes shows in Jobs as a server job');
  let userJob = null;
  if (has('startJob')) {
    userJob = jobs.startJob('node', [userScript, JSON.stringify({ port: userPort })], { type: 'counterUser' });
  }
  const up = userJob ? await waitFor(function () { return isOpen(userPort); }) : false;
  if (userJob && userJob.kind === 'server' && userJob.data && userJob.data.operated === 'user' && up) {
    test.check('jobs.startJob started a user-operated server job, and it answers on its port');
  } else {
    test.fail(OWED + (has('startJob') ? 'startJob gave kind ' + (userJob && userJob.kind) + ', operated ' + (userJob && userJob.data && userJob.data.operated) + ', up ' + up
      : 'there is no jobs.startJob that reads the manifest'));
  }

  // ── T5 (before T2, while it runs) ───────────────────────────────────
  test.subHeading('T5: a user-operated server that crashes stays down, and Jobs shows it failed');
  let t5 = false;
  if (userJob && up && userJob.data.pid) {
    process.kill(userJob.data.pid);
    await pause(2500);
    const j = jobs.getJob(userJob.id);
    t5 = j && j.status === 'failed' && !(await isOpen(userPort));
  }
  if (t5) test.check('killed, it stayed down for 2.5 s and its job says failed');
  else test.fail(OWED + 'a crashed user-operated server did not stay down as failed');

  // ── T2 ──────────────────────────────────────────────────────────────
  test.subHeading('T2: Cancel in Jobs ends a user-operated server and closes its port; no Cancel on a node-operated one');
  let t2run = false;
  if (has('startJob')) {
    const again = jobs.startJob('node', [userScript, JSON.stringify({ port: userPort })], { type: 'counterUser' });
    if (again && await waitFor(function () { return isOpen(userPort); })) {
      jobs.cancelJob(again.id);
      t2run = await waitFor(function () { return isOpen(userPort).then(function (o) { return !o; }); }, 4000);
    }
  }
  const ctx = { document: { getElementById: function () { return null; } }, window: {},
    spirit: { shell: { activateApp: function () {} }, core: { const: { ICON: {} }, util: { escapeHtml: spirit.core.util.escapeHtml } } } };
  vm.createContext(ctx);
  let canUser = false; let canNode = true;
  try {
    vm.runInContext(fs.readFileSync(JOBS_APP, 'utf8'), ctx);
    const row = function (operated) {
      return ctx.renderJobRow({ id: 'j', kind: 'server', type: 't', status: 'running', data: { operated: operated }, log: [] });
    };
    canUser = /data-job-id=/.test(row('user'));
    canNode = /data-job-id=/.test(row('node'));
  } catch (e) { /* the app did not load: fail below */ }
  if (t2run && canUser && !canNode) test.check('Cancel closed its port; Jobs offers Cancel for user-operated servers only');
  else test.fail(OWED + 'Cancel closed the port ' + t2run + '; Jobs Cancel for user ' + canUser + ', for node ' + canNode);

  // ── T6 and the boot ─────────────────────────────────────────────────
  test.subHeading('T6: at boot only node-operated servers start; a user-operated one stays stopped');
  let booted = [];
  if (has('startNodeServers')) booted = jobs.startNodeServers(root) || [];
  const nodeUp = booted.length ? await waitFor(function () { return isOpen(nodePort); }) : false;
  const userStill = await isOpen(userPort);
  if (booted.length === 1 && nodeUp && !userStill) test.check('the boot started the node-operated server and left the user-operated one stopped');
  else test.fail(OWED + (has('startNodeServers') ? 'boot started ' + booted.length + ', node up ' + nodeUp + ', user up ' + userStill
    : 'there is no jobs.startNodeServers(rootDir) to scan process/js at boot'));

  // ── T4 ──────────────────────────────────────────────────────────────
  test.subHeading('T4: a node-operated server that crashes comes back, its counter at 1');
  let t4 = false;
  if (nodeUp) {
    await count(nodePort); await count(nodePort);
    const j = booted[0];
    const pid = jobs.getJob(j.id).data.pid;
    process.kill(pid);
    await waitFor(function () { return Promise.resolve(jobs.getJob(j.id).data.pid !== pid); }, 6000);
    await waitFor(function () { return isOpen(nodePort); }, 6000);
    t4 = (await count(nodePort)) === 1;
  }
  if (t4) test.check('killed after 2 pages, it came back and counts from 1');
  else test.fail(OWED + 'a node-operated server did not come back counting from 1');
  booted.forEach(function (j) { jobs.cancelJob(j.id); });

  // ── T3 ──────────────────────────────────────────────────────────────
  test.subHeading('T3: a node that stops leaves no server of either kind running');
  const p1 = await freePort();
  const p2 = await freePort();
  const root2 = home(p1, p2);
  const driver = 'const spirit=require(' + JSON.stringify(path.join(RUN, 'js', 'kernel.js')) + ');' +
    'const jobs=require(' + JSON.stringify(path.join(RUN, 'js', 'jobs.js')) + ')(spirit,65432);' +
    'if(!jobs.startJob||!jobs.startNodeServers){process.exit(3);}' +
    'jobs.startNodeServers(' + JSON.stringify(root2) + ');' +
    'jobs.startJob("node",[' + JSON.stringify(path.join(root2, 'process', 'js', 'counterUser', 'counterUser.js')) + ',JSON.stringify({port:' + p2 + '})],{});' +
    'setTimeout(function(){},60000);';
  const nodeProc = spawn(process.execPath, ['-e', driver], { stdio: 'ignore' });
  const bothUp = await waitFor(function () { return Promise.all([isOpen(p1), isOpen(p2)]).then(function (a) { return a[0] && a[1]; }); });
  nodeProc.kill('SIGKILL');
  const bothGone = bothUp ? await waitFor(function () { return Promise.all([isOpen(p1), isOpen(p2)]).then(function (a) { return !a[0] && !a[1]; }); }, 6000) : false;
  if (bothUp && bothGone) test.check('with the node killed outright, both of its servers were gone within seconds');
  else test.fail(OWED + 'node servers up ' + bothUp + ', gone after the node died ' + bothGone);

  [root, root2].forEach(function (r) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ } });
  jobs.listJobs().forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
}());
