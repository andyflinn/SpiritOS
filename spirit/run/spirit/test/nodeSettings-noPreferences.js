'use strict';

// spirit/run/spirit/test/nodeSettings-noPreferences.js
// PREFERENCES.JSON GONE (goal/G43.17; spec: ./nodeSettings-noPreferences.md). Andy: "i want to remove that information and all the code that
// references it, gone.", "go do it!". The tree read as it is, and a real node on a scratch copy of the tracked
// files, asked at its own loopback door. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { scratchNode } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('nodeSettings-noPreferences.js: preferences.json and every line that reads or writes it, gone (goal/G43.17)');

(async function () {
  test.subHeading('Andy: "i want to remove that information and all the code that references it, gone."');
  const tracked = require('child_process').execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(function (f) { return /(^|\/)preferences\.json$/.test(f); });
  ok(!tracked.length, 'no preferences.json is tracked', 'still tracked: ' + short(tracked));
  // Andy: "MAKE SURE the code referencing preferences.json will be gone from the codebase.": every tracked code file, tests,
  // install scripts and comments included; only this suite, which must name it, and Desk's own data (currentGoal.json) aside.
  const naming = require('child_process').execSync('git ls-files -- "*.js" "*.html" "*.css" "*.json"', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return !/noPreferences\.(js|md)$/.test(f) && !/currentGoal\.json$/.test(f) && fs.existsSync(path.join(REPO, f)); })
    .filter(function (f) { return /preferences\.json|UNKNOWN_PREFS|unknownPolicy/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
  ok(!naming.length, 'no tracked code, tests and comments included, names preferences.json or the policy it held', naming.length + ' still do: ' + short(naming));
  const N = await scratchNode();
  try {
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    if (N.root) ok(!fs.existsSync(path.join(N.root, 'spirit', 'run', 'preferences.json')), 'and the node writes no preferences.json', 'the scratch node holds a preferences.json');
  } finally {
    try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
