'use strict';

// spirit/run/shell/shared/js/test/noDeskLeftovers.js
// PLUGIN LEFTOVERS IN shell/shared (goal/G43.23, item 10, after goal/G43.22; spec: ./noDeskLeftovers.md). The box:
// "plugin leftovers (G43.22): deskChat.js and deskElement.js in shell/shared, loaded by nothing". They go, and their
// tests with them: a test that reads a file gone from the tree is stale (G43.23, Q3: "yes."). The tree read as it is
// (tracked files that are on disk). No node, no port.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const SHARED = path.join(RUN, 'shell', 'shared', 'js');
// This item's own reds of item 10 name the two files to say they are gone: this suite, and noVerifyTests' spec, which
// quotes the box.
const SELF = /shell\/shared\/js\/test\/noDeskLeftovers\.(js|md)$|process\/js\/deskVerify\/test\/noVerifyTests\.md$/;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

test.startTest('noDeskLeftovers.js: deskChat.js and deskElement.js, and their tests, gone from shell/shared (goal/G43.23 item 10)');

test.subHeading('the world');
ok(fs.existsSync(path.join(SHARED, 'deskRunStatus.js')), 'the world: spirit/run/shell/shared/js is the folder read (deskRunStatus.js is in it)', 'no deskRunStatus.js in ' + path.relative(REPO, SHARED) + ': the wrong folder, nothing judged');
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
// Any other test, or its spec, that reads or names them.
const tests = tracked.filter(function (f) { return /\.(js|md)$/.test(f) && /(^|\/)test\//.test(f) && !SELF.test(f); });
const naming = tests.filter(function (f) { return /\bdeskChat\.js\b|\bdeskElement\.js\b|\bcreateDeskChat\b|\bcreateDeskElement\b/.test(fs.readFileSync(path.join(REPO, f), 'utf8')); });
ok(tests.length > 50, 'the world: ' + tests.length + ' tests and specs are read', 'only ' + tests.length + ' tests read: nothing judged');
ok(!naming.length, 'no test or spec left reads or names deskChat.js, deskElement.js, createDeskChat or createDeskElement', naming.length + ' still do: ' + short(naming));

test.reportSuccessFailureCount();
process.exit(0);
