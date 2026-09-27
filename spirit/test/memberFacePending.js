'use strict';

// MEMBER APPS BEHIND THE FACE, WHAT IS STILL OWED — public-app-server/G17.
//
// design/shell/PUBLIC-APP-SERVER.md, G17, *MEMBER APPS*. Andy, 2026-09-27:
// "how about proving that this works for member-apps as well as owner
// apps?", and ruled: "a route ask should never happen to a member who is
// not the owner", "the members to store their own subdomain on disc", "the
// route-knowledge can only be obtained by the owner of appFaceApp".
//
// Declared at design time, as CLAUDE.md asks: each names a unit that is
// ABSENT today and goes red the moment somebody builds it.
//
// NOT DECLARED, because the shape waits for Andy's yes (a board that guesses
// an API has to be rewritten when the design settles):
//   - the face admitting the member's ANSWER: a front-door rule, "an answer
//     to a question this node asked, from the key it asked, is never a
//     stranger's packet" (Andy: "the grant is implicit by naming the
//     route"), awaiting wsl-claude's review and his yes on the rule.
//   - the member admitting the face: by hand for the first proof, or a new
//     node verb, which goes under the gate.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
function source(rel) {
  try { return fs.readFileSync(path.join(RUN, rel), 'utf8'); } catch (e) { return ''; }
}

test.startTest('Member apps behind the face (G17), what is still owed');

const face = source('app/appFaceApp/appFaceApp.js');

test.awaiting('public-app-server/G17', 'a member keeps the names granted to it, on disk (MINE_FILE in appFaceApp)',
  /\bMINE_FILE\b/.test(face),
  'Andy: "the members to store their own subdomain on disc". A granted reply is written down where the member\'s ' +
  'appFaceApp reads it, so a serve for that name reaches its app server instead of 404 no-such-route',
  { there: 0, cost: 'a sitting, with the introductions' });

test.reportSuccessFailureCount();

module.exports = test;
