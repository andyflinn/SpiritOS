'use strict';

// spirit/test/shellAppNeedsServer.js
// goal/G27.16: a shell app shows only while its server runs. The item's box (Andy, goal/G27.9 chat, 2026-10-17):
//   R1. a shell app manifest may name the server it needs; the shell shows that app only while that server is
//       installed and running; when the server is uninstalled or stopped, the app is not offered.
//   R2. the link lives on the app side only.
//   R3. an app that names no server always shows, as today.
//   R4. the shell names no app and no server: it reads the field from each manifest.
//
// THE SHAPE: the manifest field is `server`, the server's folder name under spirit/run/process/js (desk.json:
// "server": "desk"). Running is a job of type server whose module is process/js/<server> and whose status is running, or pending (a node-operated server between restarts, which comes
// back by itself); failed, completed or no such job is not running. A server job is kind server; its type is its display name.
// WHAT IS ASSERTED
//   1. the manifests: Desk, its two dialogs and Chatter name their servers; the Remote names none (its server may be on a puppet); Text Editor names none.
//   2. with no desk server running Desk is not on the desktop; Text Editor is (R3).
//   3. once a desk server job runs, Desk shows; the Remote, needing deskAgent, still does not.
//   4. a server restarting (pending) keeps its app; a failed one, or one gone from the jobs, takes it away.
//   5. shell.js names no app and no server for this (R4).
// rule/11: through testSupport only; no node, no port.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G27.16: ';
const RUN_DIR = path.join(__dirname, '..', 'run');
function readRun(rel) { return fs.readFileSync(path.join(RUN_DIR, rel), 'utf8').replace(/\r\n/g, '\n'); }
function manifest(rel) { try { return JSON.parse(readRun(rel)); } catch (e) { return {}; } }

test.startTest('goal/G27.16: a shell app shows only while its server runs');

test.subHeading('1. the manifests name their servers');
const named = {
  'shell/desk/desk.json': 'desk', 'shell/deskDetails/deskDetails.json': 'desk', 'shell/ruleDetails/ruleDetails.json': 'desk',
  // Folded in by Andy, 2026-10-17: Chatter is the face of chatClerver.
  'shell/chatter/chatter.json': 'chatClerver',
};
const wrong = Object.keys(named).filter(function (rel) { return manifest(rel).server !== named[rel]; });
if (!wrong.length) test.check('Desk, its two dialogs and Chatter name their servers');
else test.fail(OWED + 'these manifests do not name their server: ' + wrong.map(function (r) { return r + ' reads ' + JSON.stringify(manifest(r).server); }).join('; '));

test.subHeading('5. shell.js names no app and no server for this');
const shellSrc = readRun('spirit/client/shell.js');
if (/manifest\.server/.test(shellSrc) && !/['"]process\/js\/(desk|deskAgent)['"]/.test(shellSrc)) test.check('shell.js reads manifest.server and names no server');
else test.fail(OWED + 'shell.js does not read manifest.server, or names a server itself');

test.reportSuccessFailureCount();
