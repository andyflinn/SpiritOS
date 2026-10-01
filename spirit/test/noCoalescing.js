'use strict';

// fileTransfer goal/G1.4: the unwanted publish coalescing leaves appServer. Red on today's code.
//   Andy: "so. again: why on earth would a coalesing apparatus all of a sudden be in the appServer module?",
//   "through peerPost every item has a unique hash, no? let desk worry about its problems, don't but shit into a
//   common component without asking.", "so get rid of the unwanted coalescing in appServer, first item on this
//   goal. all other items depend on it."
// The 100 ms last-object-wins rule was an agent's addition in desk/G2.3 (020c339a), never his ruling.
// The contract the builder follows:
//   1. appServer.publish sends every object it is handed, as it is handed it: no timer, no pending object, no
//      interval constant. (publishChecks.js proves it live: a burst of 200 arrives as 200, in order.)
//   2. The size cap stays: an object over PUBLISH_MAX is refused out loud, as now.
//   3. No comment in the tree still says publish keeps only its last object per 100 ms.
//   desk's one object per write carrying every changed row stays (desk/G3.10: one press changes several rows).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run');
const OWED = 'OWED by fileTransfer goal/G1.4: ';

function code(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
}

test.startTest('fileTransfer goal/G1.4: appServer publishes every object, no coalescing');

test.subHeading('the coalescing machinery is gone from appServer');
const appServer = code(path.join(RUN, 'js', 'appServer.js'));
const left = ['PUBLISH_EVERY_MS', 'publishPending', 'publishTimer', 'publishLast'].filter(function (name) {
  return appServer.indexOf(name) !== -1;
});
if (!left.length) test.check('appServer.js has no publish interval, pending object or timer');
else test.fail(OWED + 'appServer.js still has ' + left.join(', '));

test.subHeading('the size cap stays');
if (/PUBLISH_MAX/.test(appServer) && /publish-too-large/.test(appServer)) test.check('an object over PUBLISH_MAX is still refused out loud');
else test.fail(OWED + 'the size cap went with the coalescing');

test.subHeading('no comment still describes the coalescing');
const said = [
  path.join(RUN, 'js', 'appServer.js'),
  path.join(RUN, 'process', 'js', 'desk', 'desk.js'),
  path.join(RUN, 'shell', 'desk', 'desk.js'),
  path.join(__dirname, 'deskRows.js'),
].filter(function (file) {
  // A comment may wrap mid-sentence, so its line breaks and comment marks are joined first.
  const joined = fs.readFileSync(file, 'utf8').replace(/\r?\n\s*\/\/\s*/g, ' ');
  return /last object\s{1,3}per 100 ?ms/i.test(joined);
}).map(function (file) { return path.relative(path.join(__dirname, '..'), file); });
if (!said.length) test.check('nothing says publish keeps only its last object per 100 ms');
else test.fail(OWED + 'still described in ' + said.join(', '));

test.reportSuccessFailureCount();
