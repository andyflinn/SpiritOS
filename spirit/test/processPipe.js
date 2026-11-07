'use strict';

// spirit/test/processPipe.js
// THE NODE NAMES A PIPE FOR ITS process/js SERVERS — desk/G1.6.
//
//   Not a decision: appPair D15 ("only the node names a pipe, handed over
//   as --pipe") applied where it did not reach. Andy's check: "A process/js
//   server built on appServer.js starts with the node and answers api over
//   its pipe." Per D11, process/js only; nothing new on the app/ path.
//
// THE CONTRACT (no manifest field):
//   - appClient.pipePathFor(root, name, platform, 'process'): off Windows
//     <root>/relay-state/process/<name>/door.sock (the process's state
//     folder, desk/G1 D5); on Windows a pipe name carrying the checkout and
//     'process', so it never equals an app's pipe of the same name.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

test.startTest('desk/G1.6: the node names the pipe of a process/js server it starts');

const OWED = 'OWED by desk/G1.6: ';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-procpipe-'));

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

})().catch(function (e) { test.fail('the run broke: ' + e.message); }).then(function () {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* busy: the OS clears tmp */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
