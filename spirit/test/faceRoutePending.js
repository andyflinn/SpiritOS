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

test.reportSuccessFailureCount();

module.exports = test;
