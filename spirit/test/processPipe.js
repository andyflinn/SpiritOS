'use strict';

// spirit/test/processPipe.js
// THE NODE NAMES A PIPE FOR ITS process/js SERVERS — desk/G1.6, written
// FIRST, red on today's code.
//
//   Not a decision: appPair D15 ("only the node names a pipe, handed over
//   as --pipe") applied where it did not reach. Andy's check: "A process/js
//   server built on appServer.js starts with the node and answers api over
//   its pipe." Per D11, process/js only; nothing new on the app/ path.
//
// THE CONTRACT (wsl-claude's, sent to claude-windows before the build; no
// manifest field, claude-windows' proposal):
//   - appClient.pipePathFor(root, name, platform, 'process'): off Windows
//     <root>/relay-state/process/<name>/door.sock (the process's state
//     folder, desk/G1 D5); on Windows a pipe name carrying the checkout and
//     'process', so it never equals an app's pipe of the same name.
//   - jobs.startNodeServers(root, client) starts each node-operated server
//     with [script, values, '--pipe', pipe], its folder made, and calls
//     client.register(name, pipe).
//   - client.register(name, pipe): client.ask reaches it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const jobs = require('../run/js/jobs.js')(spirit, 65432);

test.startTest('desk/G1.6: the node names the pipe of a process/js server it starts');

const OWED = 'OWED by desk/G1.6: ';
const HELPER = path.join(__dirname, '..', 'run', 'js', 'appServer.js');

// A node's folder with one node-operated server built on appServer.js.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-procpipe-'));
const dir = path.join(root, 'process', 'js', 'pinger');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'pinger.json'), JSON.stringify({ name: 'pinger', kind: 'server', operated: 'node', args: [] }));
fs.writeFileSync(path.join(dir, 'pinger.js'), 'require(' + JSON.stringify(HELPER) + ').serve(' +
  "{ ping: { request: { say: '' }, reply: { pong: '' }, handler: function (a) { return { pong: 'pong ' + a.say }; } } });\n");

function waitFor(fn, ms) {
  const until = Date.now() + (ms || 6000);
  return new Promise(function (resolve) {
    (function again() {
      Promise.resolve(fn()).then(function (ok) {
        if (ok || Date.now() > until) resolve(ok);
        else setTimeout(again, 100);
      }, function () { if (Date.now() > until) resolve(false); else setTimeout(again, 100); });
    })();
  });
}

(async function () {
  // ── T2, on names alone ──────────────────────────────────────────────
  test.subHeading('T2: two checkouts never share a pipe, and a process never takes an app\'s');
  const other = root + '-other';
  const winA = appClient.pipePathFor(root, 'pinger', 'win32', 'process');
  const winB = appClient.pipePathFor(other, 'pinger', 'win32', 'process');
  const winApp = appClient.pipePathFor(root, 'pinger', 'win32');
  const nixA = appClient.pipePathFor(root, 'pinger', 'linux', 'process');
  const nixApp = appClient.pipePathFor(root, 'pinger', 'linux');
  const expected = path.join(root, 'relay-state', 'process', 'pinger', 'door.sock');
  if (/^\\\\\.\\pipe\\/.test(winA) && winA !== winB && winA !== winApp) test.check('on Windows: one pipe per checkout, apart from the app pipe of the same name');
  else test.fail(OWED + 'Windows names: ' + JSON.stringify([winA, winB, winApp]));
  if (nixA === expected && nixA !== nixApp) test.check('off Windows: the socket sits in the process\'s own state folder, relay-state/process/pinger');
  else test.fail(OWED + 'off-Windows name ' + nixA + ', wanted ' + expected);

  // ── T1: the boot hands it over ──────────────────────────────────────
  test.subHeading('T1: a node-operated process/js server is started with --pipe, its socket in its state folder');
  const client = appClient.createAppClient({ rootDir: root });
  let booted = [];
  // A test node includes what it starts, for this run (slim/G1.3 T6).
  require('../run/js/includeList.js').add(root, 'process/js/pinger');
  try { booted = jobs.startNodeServers(root, client) || []; } catch (e) { test.fail(OWED + 'startNodeServers threw: ' + e.message); }
  const job = booted[0] && jobs.getJob(booted[0].id);
  const args = (job && job.data && job.data.args) || [];
  const at = args.indexOf('--pipe');
  const pipe = at !== -1 ? args[at + 1] : '';
  const mine = appClient.pipePathFor(root, 'pinger', process.platform, 'process');
  if (booted.length === 1 && pipe && pipe === mine) test.check('started with --pipe ' + (process.platform === 'win32' ? 'its named pipe' : 'relay-state/process/pinger/door.sock'));
  else test.fail(OWED + 'started ' + booted.length + ', args ' + JSON.stringify(args.slice(1)));
  if (process.platform === 'win32' || fs.existsSync(path.dirname(expected))) test.check('its state folder exists before it listens');
  else test.fail(OWED + 'no folder ' + path.dirname(expected));

  // ── T3: appClient reaches it ────────────────────────────────────────
  test.subHeading('T3: appClient.ask reaches it, by a call and by api');
  let call = null;
  await waitFor(function () {
    return client.ask({ pinger: { ping: { say: 'hi' } } }).then(function (r) { call = r; return r && r.status === 200; });
  });
  if (call && call.status === 200 && call.body && call.body.pong === 'pong hi') test.check('{pinger: {ping: {say}}} came back {pong: "pong hi"}');
  else test.fail(OWED + 'the call answered ' + JSON.stringify(call));
  let tree = null;
  try { tree = (await client.ask('api')).body; } catch (e) { tree = null; }
  const branch = tree && tree.pinger;
  if (branch && JSON.stringify(branch).indexOf('ping') !== -1 && branch.ok !== false) test.check('api lists pinger and its ping verb');
  else test.fail(OWED + 'api answered ' + JSON.stringify(tree));

  booted.forEach(function (j) { try { jobs.cancelJob(j.id); } catch (e) { /* gone */ } });
})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
