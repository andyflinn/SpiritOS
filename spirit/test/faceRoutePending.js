'use strict';

// THE FACE'S ROUTE, WHAT IS STILL OWED — public-app-server/G17.
//
//   Andy, 2026-09-27, in Desk under G17, "go." on THE ROUTE
//   (design/shell/PUBLIC-APP-SERVER.md, G17): the face domain one level down
//   (face.spirit.<domain>), the owner node as the boot route, a signed
//   redirect the puppet caches in RAM, and appServerPost / appServerReply
//   for the request and its answer.
//
// Declared at design time, as CLAUDE.md asks: each names the unit that is
// ABSENT today, and goes red the moment somebody builds it, which is the
// handover to the assertion. The units are named here so the build has one
// place to land:
//
//   spirit/run/js/faceRoute.js
//     nameOf(host, faceDomain)             'join.face.spirit.x' -> 'join'
//     answerRoute(grants, name, ...)       mine | {to, until} | no such route
//     createRouteCache(opts)               the puppet's RAM cache
//   spirit/run/app/appFaceApp/appFaceApp.js
//     appServerPost / appServerReply

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}

test.startTest('The face route (G17), what is still owed');

const face = source('app/appFaceApp/appFaceApp.js');

// faceRoute.nameOf, answerRoute and createRouteCache are BUILT (67af809) and
// asserted in faceRouteSuite.js, with mutations: the three declarations that
// stood here flipped to EXISTS NOW as the handover and are removed.

test.awaiting('public-app-server/G17', 'appServerPost and appServerReply in appFaceApp',
  /function appServerPost\b/.test(face) && /function appServerReply\b/.test(face),
  'the visitor\'s request posted straight to the slot owner\'s key with the owner\'s signed route, and the answer ' +
  'back with re = the request\'s hash, matched to the open browser request (with the early-answer store)',
  { there: 0, cost: 'a sitting' });

// ── THE LAST LEG: THE OWNER'S NODE TO THE APP'S SERVER PROCESS ─────────
//
//   Andy, 2026-09-27, under G17: "the go is officail. also: i explicitly
//   permit the two new/proposed interfaces/api' for communication from node
//   to appserver." claude-windows builds; these are the handover. Each
//   probe is loose on purpose (the names are not fixed yet) and is
//   tightened to the real name when the piece lands.
//
// What the assertions will hold, once each goes red:
//   - only an app whose manifest declares it gets toLocalApp at all (absent,
//     not refusing), and only for a name the owner's grants route to 'mine';
//   - the request is capped at BODY_MAX before the door is touched, and the
//     answer at the face cap, each refused by name;
//   - the door's timeout is shorter than appFaceApp's SERVE_WAIT_MS (18 s),
//     which is shorter than puppetPost's FACE_WAIT_MS (30 s): the limits nest;
//   - a server process that is not running answers a named 503, never a hang;
//   - no port, pipe or path to the process ever appears in a packet;
//   - only the content type crosses, each way, and bodies are text.

const nodeApps = source('js/nodeApps.js');
const jobs = source('js/jobs.js');

test.awaiting('public-app-server/G17', 'api.toLocalApp in nodeApps',
  /toLocalApp/.test(nodeApps),
  'the node hands a booted app\'s request to a local app server\'s door; the app never sees an address',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G17', 'a long-running server job kind in jobs.js',
  /['"]server['"]/.test(jobs),
  'the node starts and keeps an app server process, so it knows the door locally',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G17', 'the owner\'s serve answered by the app server, not the 501 stub',
  face !== '' && !/last-leg-not-built/.test(face),
  'appFaceApp\'s ownerRole hands serve to toLocalApp; faceRouteWorld (a) moves from the 501 to the app\'s own answer',
  { there: 0, cost: 'with the two above' });

test.awaiting('public-app-server/G17', 'a named 503 when the app server is not running',
  /app-not-running/.test(face) || /app-not-running/.test(nodeApps),
  'a dead or unstarted process is answered by name at once, not left to the 18 s wait',
  { there: 0, cost: 'with the two above' });

test.reportSuccessFailureCount();

module.exports = test;
