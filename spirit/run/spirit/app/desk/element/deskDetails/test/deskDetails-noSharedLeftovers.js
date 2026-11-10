'use strict';

// spirit/run/spirit/app/desk/element/deskDetails/test/deskDetails-noSharedLeftovers.js
// PLUGIN LEFTOVERS IN shell/shared (goal/G43.23, item 10, after goal/G43.22; spec: ./deskDetails-noSharedLeftovers.md). The box:
// "plugin leftovers (G43.22): deskChat.js and deskElement.js in shell/shared, loaded by nothing". They go, and their
// tests with them: a test that reads a file gone from the tree is stale (G43.23, Q3: "yes."). deskChat.js drew an item's
// chat, which the item detail, deskDetails.js, draws itself now, so their absence is judged beside it (goal/G43.28; Andy:
// "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING BELONG"; moved from shell/shared/js/test/deskRunStatus-noDeskLeftovers.js).
// The tree read as it is (tracked files that are on disk). No node, no port.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const SHARED = path.join(RUN, 'shell', 'shared', 'js');
// This suite names the two files to say they are gone; a spec elsewhere that quotes the box's line names them too, and a
// quote of the box is no use of them.
const SELF = /spirit\/app\/desk\/element\/deskDetails\/test\/deskDetails-noSharedLeftovers\.(js|md)$/;
const BOX_LINE = /plugin leftovers \(G43\.22\): deskChat\.js and deskElement\.js in shell\/shared, loaded by nothing/g;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

test.startTest('deskDetails-noSharedLeftovers.js: deskChat.js and deskElement.js, and their tests, gone from shell/shared (goal/G43.23 item 10)');

test.subHeading('the world');
// Since goal/G43.30 shell/shared/ is gone with all of shell/, deskRunStatus.js moved into Desk: the folder read is the one the
// two leftovers stood in, and it no longer exists.
ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'desk', 'element', 'deskRunStatus', 'deskRunStatus.js')) && !fs.existsSync(SHARED), 'the world: deskRunStatus.js moved into Desk, and spirit/run/shell/shared/js, where the leftovers stood, is gone (goal/G43.30)', 'deskRunStatus.js not in Desk, or ' + path.relative(REPO, SHARED) + ' still there: nothing judged');
ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'desk', 'element', 'deskDetails', 'deskDetails.js')), 'the world: deskDetails.js, which draws an item\'s chat, is beside this test', 'no deskDetails.js beside this test: nothing judged');
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
  .filter(function (f) { return fs.existsSync(path.join(REPO, f)); });
ok(tracked.length > 100, 'the world: ' + tracked.length + ' tracked files on disk are read', 'only ' + tracked.length + ' tracked files read: nothing judged');

test.subHeading('the two leftovers are gone');
['deskChat.js', 'deskElement.js'].forEach(function (n) {
  ok(!fs.existsSync(path.join(SHARED, n)), 'shell/shared/js/' + n + ' is gone', 'shell/shared/js/' + n + ' is still there');
});

test.subHeading('and their tests');
['deskChat.js', 'deskChat.md', 'deskElement.js', 'deskElement.md'].forEach(function (n) {
  ok(!fs.existsSync(path.join(SHARED, 'test', n)), 'shell/shared/js/test/' + n + ' is gone', 'shell/shared/js/test/' + n + ' is still there');
});
// Any other test, or its spec, that reads or names them, the box's line quoted aside.
const tests = tracked.filter(function (f) { return /\.(js|md)$/.test(f) && /(^|\/)test\//.test(f) && !SELF.test(f); });
const naming = tests.filter(function (f) { return /\bdeskChat\.js\b|\bdeskElement\.js\b|\bcreateDeskChat\b|\bcreateDeskElement\b/.test(fs.readFileSync(path.join(REPO, f), 'utf8').replace(BOX_LINE, '')); });
ok(tests.length > 50, 'the world: ' + tests.length + ' tests and specs are read', 'only ' + tests.length + ' tests read: nothing judged');
ok(!naming.length, 'no test or spec left reads or names deskChat.js, deskElement.js, createDeskChat or createDeskElement', naming.length + ' still do: ' + short(naming));

test.reportSuccessFailureCount();
process.exit(0);
