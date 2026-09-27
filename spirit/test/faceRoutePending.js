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
function exportsOf(rel) {
  try { return require(path.join(RUN, rel)); } catch (e) { return {}; }
}
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}

test.startTest('The face route (G17), what is still owed');

const faceRoute = exportsOf('js/faceRoute.js');
const face = source('app/appFaceApp/appFaceApp.js');

test.awaiting('public-app-server/G17', 'faceRoute.nameOf: the face domain turns a host into a name',
  typeof faceRoute.nameOf === 'function',
  'the owner node\'s face-domain setting, default face.spirit.<relay domain> and changeable; ' +
  '"join.face.spirit.andyflinn.com" is the name "join", the bare face domain is no name, and a host outside it is none',
  { there: 0, cost: 'small' });

test.awaiting('public-app-server/G17', 'faceRoute.answerRoute: the boot route answers where a name lives',
  typeof faceRoute.answerRoute === 'function',
  'the owner node, asked by its puppet, answers from its grant rows: mine, or {name, to, until} as a reply ' +
  'signed by its key carrying the question\'s hash, or no such route by name',
  { there: 0, cost: 'small' });

test.awaiting('public-app-server/G17', 'faceRoute.createRouteCache: the puppet keeps routes in RAM',
  typeof faceRoute.createRouteCache === 'function',
  'a route is taken only signed by the key in puppet.json and matching the question\'s hash; it lives until its ' +
  '"until" (an hour) and is dropped when its target refuses; "no such route" is kept a minute; a restart forgets all',
  { there: 0, cost: 'a sitting' });

test.awaiting('public-app-server/G17', 'appServerPost and appServerReply in appFaceApp',
  /function appServerPost\b/.test(face) && /function appServerReply\b/.test(face),
  'the visitor\'s request posted straight to the slot owner\'s key with the owner\'s signed route, and the answer ' +
  'back with re = the request\'s hash, matched to the open browser request (with the early-answer store)',
  { there: 0, cost: 'a sitting' });

test.reportSuccessFailureCount();

module.exports = test;
