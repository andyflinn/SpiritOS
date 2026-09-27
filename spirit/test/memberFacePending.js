'use strict';

// A MEMBER'S APP ANSWERS THROUGH THE FACE, WHAT IS STILL OWED
// public-app-server/G19 (design/shell/PUBLIC-APP-SERVER.md, G19, and its
// design under G17's *MEMBER APPS*).
//
// Andy, 2026-09-28, in Team: "ok break it down like that and we iron out
// remaining wrinkles as we go." The steps, each blocked by the one before:
//
//   G19.1  the process spec and the server process type  processServerPending.js
//   G19.2  passthrough to a serving app's pipe             here
//   G19.3  grantFace                                       here
//   G19.4  the 'api' verb                                  here
//   G19.5  the member's shell client                       here
//
// It first declared, under G17, "a member keeps its names on disk" in
// appFaceApp. The design moved that into the member's shell client (G19.5,
// Andy: "it uses the local fs.api to store it's end of the domain grant").
//
// Declared at design time, as CLAUDE.md asks: each names a unit that is ABSENT
// today and goes red the moment somebody builds it, which is the handover to
// the assertion.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}
function exists(rel) {
  try { return fs.statSync(path.join(RUN, rel)).isFile(); } catch (e) { return false; }
}

test.startTest('A member\'s app answers through the face (G19), what is still owed');

test.awaiting('public-app-server/G19', 'G19.2 passthrough: a packet for a serving app goes down its pipe (appServers.passthrough)',
  /function passthrough\b/.test(source('js/appServers.js')),
  'a peer\'s packet addressed to an app that runs a server is handed down that app\'s pipe unread, and its answer ' +
  'goes back as the node\'s own reply, signed with the node\'s key. Blocked by G19.1',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G19', 'G19.3 grantFace, a faceless server app (app/grantFace)',
  exists('app/grantFace/grantFace.json'),
  'owns grants.json (canonical, keyed by face domain and name), answers grant, faceKey and the face\'s route ' +
  'question, and on every change syncs the face\'s contact list by owner command over loopback. Blocked by G19.2',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G19', 'G19.4 the api verb: introspection by layers',
  /['"]api['"]\s*:/.test(source('js/server.js')),
  'a caller in the owner\'s contacts asks "api" and gets the tree of apps it may use, each verb as ' +
  '{ description, request, reply }, gathered from the apps themselves; a one-leaf object is a call. ' +
  'Andy\'s yes on the verb: "go." (Desk, G17, 2026-09-28). Blocked by G19.3',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G19', 'G19.5 the member\'s shell client (app/grantFaceClient)',
  exists('app/grantFaceClient/grantFaceClient.json'),
  'a shell page on the member\'s node: asks api over peerPost, negotiates a name, stores its grants keyed by ' +
  'face and name with the fs api, and admits the face\'s key taken from the owner-signed reply. Blocked by G19.4',
  { there: 0, cost: 'a sitting' });

test.reportSuccessFailureCount();

module.exports = test;
