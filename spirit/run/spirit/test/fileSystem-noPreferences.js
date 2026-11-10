'use strict';

// spirit/run/spirit/test/fileSystem-noPreferences.js
// THE NODE WRITES NO preferences.json (goal/G43.17; spec: ./fileSystem-noPreferences.md). Andy: "i want to remove that
// information and all the code that references it, gone.", "go do it!". spirit/fileSystem.js held preferences.json as the
// node's one writable root file (WRITABLE_ROOT_FILES) until 7bfb9514, so what the node writes is judged beside it
// (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING BELONG"; moved from
// spirit/test/nodeSettings-noPreferences.js). A real node on a scratch copy of the tracked files. Neither Andy's node nor
// an agent's is touched.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { scratchNode } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }

test.startTest('fileSystem-noPreferences.js: the node writes no preferences.json (goal/G43.17)');

(async function () {
  test.subHeading('Andy: "i want to remove that information and all the code that references it, gone."');
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
