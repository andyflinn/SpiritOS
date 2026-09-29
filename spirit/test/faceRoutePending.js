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
//   spirit/run/shell/appFaceApp/appFaceApp.js
//     appServerPost / appServerReply

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}

test.startTest('The face route (G17), what is still owed');


// faceRoute.nameOf, answerRoute and createRouteCache are BUILT (67af809) and
// asserted in faceRouteSuite.js, with mutations: the three declarations that
// stood here flipped to EXISTS NOW as the handover and are removed.

// appServerPost / appServerReply, and the last leg's four pieces (toLocalApp,
// startServerJob, serve through the app server, app-not-running) are BUILT
// (62e2b96, claude-windows, on Andy's "the go is officail") and flipped to
// EXISTS NOW as the handover. Asserted in appClient.js (claude-windows'
// pieces) and faceLastLeg.js (the agreed limits against real sockets, and
// the whole route browser -> face -> owner -> app server -> back), with
// mutations; the five declarations that stood here are removed.
//
// STILL OWED, and declared when its design has Andy's yes: the same route
// for a MEMBER's app. Run on 2026-09-27, the face already forwards serve to
// the member the grant names; the member answers 404 no-such-route, name '',
// because it holds neither face-domain.json nor the grant.

test.reportSuccessFailureCount();

module.exports = test;
