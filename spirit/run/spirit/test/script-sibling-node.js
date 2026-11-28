'use strict';
// spirit/run/spirit/test/script-sibling-node.js [<script> ...]
// THE -node GENERAL TEST BESIDE spirit.js (goal/G47.1, box v94, 2: "there will be, from now on only 3 types of general
// tests, at any level of the tree: <file>-<child | sibling>-general.js, <file>-<child | sibling>-node.js,
// <file>-<child | sibling>-browser.js", "existing general tests fold into the appropriate of the 3 new general test
// name-formats"). Its contract: ./script-sibling-node.md.
//
// THE RUNNER OF ITS RULE MODULES (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system", the
// general rules become modules, one rule set one module): its checks, which had no parts, are the one module
// spirit/testicle/general/node/placeRules/script.js now, every title kept. This file loads it by its full path, asks appliesTo of
// each path handed and runs checks, the copy of the tree it stands on made once for the whole run (the module's own).
// "with no script-argument, they will process all applicable scripts. else it will process all scripts listed in the
// arguments that fit"; "node only scripts are tested by -general AND -node general tests ... if a script is NOT browser only
// AND NOT node only, it will be tested by all 3 categories": testicle hands it no browser-only script. No argument: every
// product script, a script that does not load on the node left unjudged. Several: each judged in this one run, its result
// reported for it.
require('../script.js');
const path = require('path');

const RUN = path.join(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const ARGV = process.argv.slice(2);
const GIVEN = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test'; })
  .map(function (a) { return runRel(a); });

// A path as given, absolute or not, scoped to run:// (the verifier hands absolute ones).
function runRel(a) {
  const p = require('path');
  const abs = p.isAbsolute(String(a)) ? String(a) : p.resolve(String(a));
  const r = p.relative(RUN, abs).split(p.sep).join('/');
  if (r && r.indexOf('..') !== 0 && !p.isAbsolute(r) && require('fs').existsSync(abs)) return r;
  return String(a).split(p.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, '');
}

const test = S.requireScript('spirit/testicle/testReport/script.js');
// What every module is handed: the reporter, the run root it judges and its spirit object.
const TOOLS = { test: test, run: RUN, spirit: S };
// ITS RULE MODULE BY ITS FULL PATH (goal/G49.13: every requireScript a full path written out).
// A PART THAT THROWS IS RED, NEVER SILENT (goal/G49.27, as spirit/test/script-sibling-general.js says its parts): a module that
// does not load, or whose checks throw, reaches no running test, so it is said here, one fixed title a module (goal/G49.6: no
// title assembled at run time).
function placeRules() { return S.requireScript('spirit/testicle/general/node/placeRules/script.js'); }
try {
  const m = placeRules();
  if (!GIVEN.length) m.checks('', TOOLS);
  else GIVEN.forEach(function (rel) { if (m.appliesTo(rel)) m.checks(rel, TOOLS); });
} catch (e) {
  test.run('its node place rules make their tests without throwing', 0.2, function () { return false; }, test.limit.quick);
}
