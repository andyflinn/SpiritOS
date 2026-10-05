'use strict';

// goal/G6.7: THE CORE RULE FIXED. coreFiles.js moves to spirit/run/js/coreFiles.js (with no desk dependency),
// and the rule it enforces reads as system-design-correct: core is what every app stands on, never one app
// itself, except that an app with "intrinsic": true in its manifest is still part of the shipped shell and
// so is core as well. index.html, shell/elements.css and shell/tokens.css are core too.
//   Andy, 2026-10-05/06, under goal/G6.1 and G6.7: "i never saw coreFiles.js"; "well, we'll fix that, before
//   anything else."; "1. coreFiles.js goes in \"spirit/run/js/coreFiles.js\", with NO dependencies on any
//   desk stuff, and it is updated to include all files in spirit/run/shell/js"; "2. remove the intrinsic mark
//   in desk-related components"; to Q1 "apps in spirit/run/shell/<appname>/ are intrinsic (core) if the
//   manifest says so."; to Q2 (index.html, elements.css, tokens.css core?): "yes."; to Q3 (agents' include
//   lists): "leave it to each node, and correct AGENT_ONBOARDING accordingly." claude-ubuntu wrote this red,
//   claude-windows builds it.
//
// SHAPES (the box's; the one Andy named is the file path spirit/run/js/coreFiles.js, every other check follows):
//   A  coreFiles.js lives at spirit/run/js/coreFiles.js and exports isCore(file, top). The old path
//      spirit/run/process/js/desk/coreFiles.js is gone (removed, not left as a stub).
//   B  spirit/run/js/coreFiles.js require()s nothing under spirit/run/process/js/desk/.
//   C  isCore returns true for: a file under spirit/run/js/; a file under spirit/run/shell/js/;
//      spirit/run/index.html; spirit/run/shell/elements.css; spirit/run/shell/tokens.css; a file in a
//      spirit/run/shell/<app>/ whose <app>.json says "intrinsic": true. isCore returns false for a file in
//      a shell/<app>/ whose manifest says "intrinsic": false (desk.json and deskDetails.json today) and for
//      an ordinary non-core path (e.g. spirit/test/something.js).
//   D  commitCheck.js reads coreFiles.js from the new location (one require line); spirit/test/deskScopes.js
//      does the same (readers follow the file). This is checked by file text alone: the moved require path
//      is present, the old one is absent.
//
// DRY-RUN NOTE: against today's tree every section fails by shape (file still at the old path, isCore does
// not count shell/js/ or the three face files, the require path points at process/js/desk/). On a scratch
// patch each check turns green.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G6.7: ';
const RUN = path.join(__dirname, '..', 'run');
const NEW_PATH = path.join(RUN, 'js', 'coreFiles.js');
const OLD_PATH = path.join(RUN, 'process', 'js', 'desk', 'coreFiles.js');
const COMMIT_CHECK = path.join(RUN, 'process', 'js', 'desk', 'commitCheck.js');
const DESK_SCOPES_TEST = path.join(__dirname, 'deskScopes.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G6.7: coreFiles.js moves to spirit/run/js/, counts shell/js and the shell frame, no desk dependency');

test.subHeading('A. the file at its new location, the old one gone');
if (fs.existsSync(NEW_PATH)) test.check('spirit/run/js/coreFiles.js exists');
else test.fail(OWED + 'spirit/run/js/coreFiles.js is not there');
if (!fs.existsSync(OLD_PATH)) test.check('spirit/run/process/js/desk/coreFiles.js is removed');
else test.fail(OWED + 'the old path spirit/run/process/js/desk/coreFiles.js still exists (should be removed, not left as a stub)');

let core = null;
if (fs.existsSync(NEW_PATH)) {
  try { delete require.cache[require.resolve(NEW_PATH)]; } catch (e) { /* not cached */ }
  try { core = require(NEW_PATH); } catch (e) { core = null; }
}
if (core && typeof core.isCore === 'function') test.check('spirit/run/js/coreFiles.js exports isCore(file, top)');
else test.fail(OWED + 'spirit/run/js/coreFiles.js has no exported isCore function');

test.subHeading('B. no dependency on anything under process/js/desk/');
if (fs.existsSync(NEW_PATH)) {
  const src = fs.readFileSync(NEW_PATH, 'utf8');
  const bad = /require\s*\(\s*['\"][^'\"]*process\/js\/desk[^'\"]*['\"]\s*\)/i.test(src);
  if (!bad) test.check('coreFiles.js has no require of anything under process/js/desk/');
  else test.fail(OWED + 'coreFiles.js still requires something under process/js/desk/');
} else {
  test.fail(OWED + 'skipping dependency check until the file is at its new location');
}

test.subHeading('C. isCore reads: run/js, run/shell/js, index.html, elements.css, tokens.css, intrinsic apps only');
if (core && typeof core.isCore === 'function') {
  const top = path.resolve(path.join(RUN, '..', '..'));
  const cases = [
    { file: 'spirit/run/js/relay.js', want: true, why: 'under spirit/run/js' },
    { file: 'spirit/run/shell/js/appHeader/appHeader.js', want: true, why: 'under spirit/run/shell/js' },
    { file: 'spirit/run/index.html', want: true, why: 'index.html' },
    { file: 'spirit/run/shell/elements.css', want: true, why: 'elements.css' },
    { file: 'spirit/run/shell/tokens.css', want: true, why: 'tokens.css' },
    { file: 'spirit/run/shell/deskDetails/deskDetails.js', want: false, why: 'deskDetails manifest says intrinsic:false' },
    { file: 'spirit/run/shell/desk/desk.js', want: false, why: 'desk manifest says intrinsic:false' },
    { file: 'spirit/test/coreFilesMove.js', want: false, why: 'spirit/test/* is not core' },
  ];
  cases.forEach(function (c) {
    let got; try { got = !!core.isCore(c.file, top); } catch (e) { got = 'threw: ' + e.message; }
    if (got === c.want) test.check(c.file + ' isCore=' + c.want + ' (' + c.why + ')');
    else test.fail(OWED + c.file + ' isCore=' + short(got) + ', expected ' + c.want + ' (' + c.why + ')');
  });

  // At least one of the shell/<app> dirs with intrinsic:true must be core (apps, contacts, files, etc.).
  // Pick one that exists today and check its manifest says intrinsic:true before asserting.
  const candidates = ['apps', 'contacts', 'files', 'jobs', 'natterDetails'];
  const picked = candidates.find(function (app) {
    const m = path.join(RUN, 'shell', app, app + '.json');
    try { return JSON.parse(fs.readFileSync(m, 'utf8')).intrinsic === true; } catch (e) { return false; }
  });
  if (picked) {
    const file = 'spirit/run/shell/' + picked + '/' + picked + '.js';
    let got; try { got = !!core.isCore(file, top); } catch (e) { got = 'threw: ' + e.message; }
    if (got === true) test.check(file + ' isCore=true (intrinsic app)');
    else test.fail(OWED + file + ' isCore=' + short(got) + ', expected true (its manifest says intrinsic:true)');
  } else {
    test.fail(OWED + 'no intrinsic app found among ' + short(candidates) + ' to test with');
  }
} else {
  for (let i = 0; i < 9; i++) test.fail(OWED + 'skipping isCore case ' + (i + 1) + ' until isCore is exported from the new location');
}

test.subHeading('D. readers follow the file: commitCheck.js and deskScopes.js require from the new path');
if (fs.existsSync(COMMIT_CHECK)) {
  const src = fs.readFileSync(COMMIT_CHECK, 'utf8');
  const movedIn = /require\s*\(\s*['\"][^'\"]*spirit\/run\/js\/coreFiles(?:\.js)?['\"]\s*\)/.test(src)
    || /require\s*\(\s*['\"](?:\.\.\/)+js\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  const oldOut = !/require\s*\(\s*['\"]\.\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  if (movedIn && oldOut) test.check('commitCheck.js requires coreFiles.js from the new location, not the old');
  else test.fail(OWED + 'commitCheck.js require line: moved-in=' + movedIn + ', old-out=' + oldOut);
} else {
  test.fail(OWED + 'commitCheck.js not found at ' + COMMIT_CHECK);
}
if (fs.existsSync(DESK_SCOPES_TEST)) {
  const src = fs.readFileSync(DESK_SCOPES_TEST, 'utf8');
  const movedIn = /require\s*\(\s*['\"][^'\"]*\/js\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  const oldOut = !/require\s*\(\s*['\"][^'\"]*process\/js\/desk\/coreFiles(?:\.js)?['\"]\s*\)/.test(src);
  if (movedIn && oldOut) test.check('deskScopes.js requires coreFiles.js from the new location, not the old');
  else test.fail(OWED + 'deskScopes.js require line: moved-in=' + movedIn + ', old-out=' + oldOut);
} else {
  test.fail(OWED + 'deskScopes.js not found at ' + DESK_SCOPES_TEST);
}

test.reportSuccessFailureCount();
