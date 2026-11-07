'use strict';

// DESK'S RECORD IS THE DESK SERVER'S, AND THE NODE IS ASKED NOTHING ELSE.
//
//   Andy, 2026-09-27, on node.history, a verb added to the node for one
//   app without review: "after correcting agents and desk, we will remove
//   the new verb."
//
// What this suite holds:
//
//   - neither Desk nor DeskDetails names a verb but its servers' (desk.,
//     deskVerify., backup.), and neither names node.history.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const APP_DIR = path.join(__dirname, '..', 'run', 'shell');
const DESK = path.join(APP_DIR, 'desk', 'desk.js');
const DETAILS = path.join(APP_DIR, 'deskDetails', 'deskDetails.js');
// A verb of one of Desk's servers, by its name on the flat apiDoor (goal/G30.6); the family is the part before the dot.
const SERVER_VERB = /^(desk|deskVerify|backup)\./;

test.startTest('Desk — its record, through the desk server, and nothing else asked of the node');

// Desk reaches its record through its servers (desk/G1.4, D4), by each
// verb's name on the flat apiDoor (goal/G30.6: desk.<verb>, and beside it
// deskVerify.<verb> and backup.<verb>), and those are the only verbs it may
// name; the node's own history it never asks for.
test.subHeading('Desk and its dialog name only their servers\' verbs (desk/G2.7), and never node.history');
[DESK, DETAILS].forEach(function (f) {
  const src = fs.readFileSync(f, 'utf8');
  const code = src.split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  const named = (code.match(/\.verb\(\s*'([^']*)'/g) || []).map(function (m) { return m.replace(/^\.verb\(\s*'|'$/g, ''); });
  const allowed = named.every(function (v) { return SERVER_VERB.test(v); }) && named.length > 0;
  if (allowed && !/node\.history/.test(code)) {
    test.check(path.basename(f) + ' names only its servers\' verbs (' + named.join(', ') + '), and never node.history outside a comment');
  } else {
    test.fail(path.basename(f) + ' asks the node for ' + JSON.stringify(named) + (/node\.history/.test(code) ? ' and names node.history' : ''));
  }
});

test.reportSuccessFailureCount();

module.exports = test;
