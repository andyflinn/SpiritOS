'use strict';

// spirit/run/spirit/test/app-child-browser.js [<script> ...]
// THE -browser GENERAL TEST BESIDE spirit/app/manager/script.js (goal/G47.1, box v140-142: "a new general test,
// spirit/test/app-child-browser.js: every element under spirit/app/, mounted alone on a scratch node with its app's server
// on, is red unless it loaded its own app's api.js and data.js"; Andy: "i just want the fucking status box to fail a fucking
// test if it does NOT fucking mount its own shit by itself", "agreed."). Its contract: ./app-child-browser.md. The page twin
// of app-child-general.js; what holds for every page script is script-sibling-browser.js's.
//
//   node spirit/test/app-child-browser.js spirit/app/testicle/element/statusBox.js ...   those scripts
//   node spirit/test/app-child-browser.js                                                every script under spirit/app/
//
// THE RUNNER OF ITS RULE MODULES (goal/G49.27, step 2b; box v5, Andy's Go: "spirit/testicle/ is the faceless test system", the
// general rules become modules, one rule set one module): its checks, one world with no parts of its own, are the one module
// spirit/testicle/general/app/browser/mountRules/script.js now, every title kept. This file loads it by its full path, asks
// appliesTo of each path handed and runs checks; the module draws every script handed in one world.
require('../script.js');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
const test = S.requireScript('spirit/testicle/testReport/script.js');

const ARGV = process.argv.slice(2);
const GIVEN = ARGV.filter(function (a, i) { return a.indexOf('--') !== 0 && ARGV[i - 1] !== '--test'; })
  .map(function (a) { return String(a).split(path.sep).join('/').replace(/^\.?\//, '').replace(/^spirit\/run\//, ''); });
// What every module is handed: the reporter, the run root and its spirit object.
const TOOLS = { test: test, run: RUN, spirit: S };
// ITS RULE MODULE BY ITS FULL PATH (goal/G49.13: every requireScript a full path written out).
// A PART THAT THROWS IS RED, NEVER SILENT (goal/G49.27, as spirit/test/script-sibling-general.js says its parts): a module that
// does not load, or whose checks throw, reaches no running test, so it is said here, one fixed title a module (goal/G49.6: no
// title assembled at run time).
function mountRules() { return S.requireScript('spirit/testicle/general/app/browser/mountRules/script.js'); }
try {
  const m = mountRules();
  if (!GIVEN.length) m.checks('', TOOLS);
  else GIVEN.forEach(function (rel) { if (m.appliesTo(rel)) m.checks(rel, TOOLS); });
} catch (e) {
  test.run('its app mount rules make their tests without throwing', 0.2, function () { return false; }, test.limit.quick);
}
