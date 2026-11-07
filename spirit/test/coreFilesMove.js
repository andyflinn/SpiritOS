'use strict';

// goal/G6.7: THE CORE RULE FIXED. coreFiles.js lives at spirit/run/spirit/coreFiles.js (with no desk dependency):
// core is what every app stands on, never one app itself, except an app on the coded INTRINSIC list (goal/G41.1;
// Andy: "the user doesn't decide intrinsic, our development team does. so i would agree on a "coded" intrinsic
// list."), which is part of the shipped shell and so is core as well. The shell's frame is core too.
//   Andy, 2026-10-05/06, under goal/G6.1 and G6.7: "i never saw coreFiles.js"; "well, we'll fix that, before
//   anything else.";
//   "1. coreFiles.js goes in \"spirit/run/spirit/coreFiles.js\", with NO dependencies on any desk stuff";
//   "2. remove the intrinsic mark in desk-related components"; to Q2 (index.html, elements.css, tokens.css
//   core?): "yes."; to Q3 (agents' include lists): "leave it to each node, and correct AGENT_ONBOARDING
//   accordingly."
//
// SHAPES (the box's; the one Andy named is the file path spirit/run/spirit/coreFiles.js, every other check follows):
//   A  coreFiles.js lives at spirit/run/spirit/coreFiles.js and exports isCore(file, top). The old path
//      spirit/run/process/js/desk/coreFiles.js is gone (removed, not left as a stub).
//   B  spirit/run/spirit/coreFiles.js require()s nothing under spirit/run/process/js/desk/.
//   C  isCore returns true for a file under spirit/run/spirit/ (spirit/run/spirit/element/ among them, the shell's
//      frame in spirit/run/spirit/shell/ too). It returns false for a shell/<app>/ that is not on the coded
//      INTRINSIC list (desk and deskDetails today) and for an ordinary non-core path (e.g. spirit/test/something.js).
//   D  commitCheck.js reads coreFiles.js from the new location (one require line); spirit/test/deskCoreGrants.js
//      does the same (readers follow the file). This is checked by file text alone: the moved require path
//      is present, the old one is absent.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G6.7: ';
const RUN = path.join(__dirname, '..', 'run');
const NEW_PATH = path.join(RUN, 'spirit', 'coreFiles.js');
const OLD_PATH = path.join(RUN, 'process', 'js', 'desk', 'coreFiles.js');
const COMMIT_CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const DESK_SCOPES_TEST = path.join(__dirname, 'deskCoreGrants.js'); // the desk's core-grant suite

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G6.7: coreFiles.js moves to spirit/run/spirit/, counts spirit/element and the shell frame, no desk dependency');

test.subHeading('A. the file at its new location, the old one gone');
if (fs.existsSync(NEW_PATH)) test.check('spirit/run/spirit/coreFiles.js exists');
else test.fail(OWED + 'spirit/run/spirit/coreFiles.js is not there');
if (!fs.existsSync(OLD_PATH)) test.check('spirit/run/process/js/desk/coreFiles.js is removed');
else test.fail(OWED + 'the old path spirit/run/process/js/desk/coreFiles.js still exists (should be removed, not left as a stub)');

let core = null;
if (fs.existsSync(NEW_PATH)) {
  try { delete require.cache[require.resolve(NEW_PATH)]; } catch (e) { /* not cached */ }
  try { core = require(NEW_PATH); } catch (e) { core = null; }
}
if (core && typeof core.isCore === 'function') test.check('spirit/run/spirit/coreFiles.js exports isCore(file, top)');
else test.fail(OWED + 'spirit/run/spirit/coreFiles.js has no exported isCore function');

test.subHeading('B. no dependency on anything under process/js/desk/');
if (fs.existsSync(NEW_PATH)) {
  const src = fs.readFileSync(NEW_PATH, 'utf8');
  const bad = /require\s*\(\s*['\"][^'\"]*process\/js\/desk[^'\"]*['\"]\s*\)/i.test(src);
  if (!bad) test.check('coreFiles.js has no require of anything under process/js/desk/');
  else test.fail(OWED + 'coreFiles.js still requires something under process/js/desk/');
} else {
  test.fail(OWED + 'skipping dependency check until the file is at its new location');
}

test.subHeading('C. isCore reads: run/spirit, run/spirit/element, the coded intrinsic apps only');
if (core && typeof core.isCore === 'function') {
  const top = path.resolve(path.join(RUN, '..', '..'));
  const cases = [
    { file: 'spirit/run/spirit/relay.js', want: true, why: 'under spirit/run/spirit' },
    { file: 'spirit/run/spirit/element/appHeader/appHeader.js', want: true, why: 'under spirit/run/spirit/element' },
    { file: 'spirit/run/shell/deskDetails/deskDetails.js', want: false, why: 'deskDetails is not on the coded INTRINSIC list' },
    { file: 'spirit/run/shell/desk/desk.js', want: false, why: 'desk is not on the coded INTRINSIC list' },
    { file: 'spirit/test/coreFilesMove.js', want: false, why: 'spirit/test/* is not core' },
  ];
  cases.forEach(function (c) {
    let got; try { got = !!core.isCore(c.file, top); } catch (e) { got = 'threw: ' + e.message; }
    if (got === c.want) test.check(c.file + ' isCore=' + c.want + ' (' + c.why + ')');
    else test.fail(OWED + c.file + ' isCore=' + short(got) + ', expected ' + c.want + ' (' + c.why + ')');
  });
} else {
  for (let i = 0; i < 9; i++) test.fail(OWED + 'skipping isCore case ' + (i + 1) + ' until isCore is exported from the new location');
}

test.subHeading('D. readers follow the file: commitCheck.js and deskCoreGrants.js require from the new path');
if (fs.existsSync(COMMIT_CHECK)) {
  const src = fs.readFileSync(COMMIT_CHECK, 'utf8');
  const movedIn = /require\s*\(\s*['\"][^'\"]*spirit\/run\/spirit\/coreFiles(?:\.js)?['\"]\s*\)/.test(src)
    || /require\s*\(\s*['\"](?:\.\.\/)+spirit\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  const oldOut = !/require\s*\(\s*['\"]\.\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  if (movedIn && oldOut) test.check('commitCheck.js requires coreFiles.js from the new location, not the old');
  else test.fail(OWED + 'commitCheck.js require line: moved-in=' + movedIn + ', old-out=' + oldOut);
} else {
  test.fail(OWED + 'commitCheck.js not found at ' + COMMIT_CHECK);
}
if (fs.existsSync(DESK_SCOPES_TEST)) {
  const src = fs.readFileSync(DESK_SCOPES_TEST, 'utf8');
  const movedIn = /require\s*\(\s*['\"][^'\"]*\/spirit\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  const oldOut = !/require\s*\(\s*['\"][^'\"]*process\/js\/desk\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  if (movedIn && oldOut) test.check('deskCoreGrants.js requires coreFiles.js from the new location, not the old');
  else test.fail(OWED + 'deskCoreGrants.js require line: moved-in=' + movedIn + ', old-out=' + oldOut);
} else {
  test.fail(OWED + 'deskCoreGrants.js not found at ' + DESK_SCOPES_TEST);
}

test.reportSuccessFailureCount();
