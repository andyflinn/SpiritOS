'use strict';

// spirit/test/oneDoorStacks.js
// NOBODY BUT THE DOOR HAS A PATH TO ITS COMPONENTS (goal/G19.14).
//
//   Andy: "whe just want that a stack-frame test asserst nobody but
//   peerPost has a path to it." — "the permitted door is peerPost (bottom
//   frame) and the endpoints are the components of peerPost." — "It's
//   simply generate a set of test id's by matching allowed door (peerPost)
//   to endpoint (http, presenceNode etc)".
//
// One test per row of tools/wirePaths.js's BOTTOMS that names a `door`:
// the probe runs that row's suites, each of which boots a real node, and
// every stack that reached the endpoint is read. A stack with a
// production frame (spirit/run/...) and no frame in the door is a path
// around it, and fails the test.
//
// A STACK WITH NO PRODUCTION FRAME IS NOT COUNTED: a suite calling the
// component itself to unit-test it. Andy ruled tests are not subject to
// production rules.
//
// AN EMPTY RUN FAILS. A probe pointed at suites that never reached the
// endpoint reports nothing, and nothing would read as a clean door.

const test = require('./testSupport.js');
const wirePaths = require('./tools/wirePaths.js');

function short(file) { return String(file).replace(/^spirit\/run\/js\//, '').replace(/\.js$/, ''); }

test.startTest('One door, by stack: nobody but the door reaches its components');

Object.keys(wirePaths.BOTTOMS).forEach(function (name) {
  const row = wirePaths.BOTTOMS[name];
  if (!row.door || !row.file) return;
  const title = 'nobody but ' + short(row.door) + ' has a path to ' + short(row.file);
  test.subHeading(short(row.door) + ' -> ' + short(row.file) + ' (driven by ' + row.suites.join(', ') + ')');

  const run = wirePaths.measure(name, row.suites, false);
  if (run.status) test.comment('a driven suite exited ' + run.status + ': the run may have reached less than it should');

  let production = 0;
  const around = [];
  run.counts.forEach(function (n, key) {
    const tab = key.indexOf('\t');
    const where = key.slice(0, tab);
    const frames = key.slice(tab + 1).split(' < ');
    if (!frames.some(function (f) { return f.indexOf('spirit/run/') === 0; })) return;
    production += n;
    const through = frames.some(function (f) { return f.indexOf(row.door + ':') === 0; });
    if (!through) around.push(where + ' from ' + frames.filter(function (f) { return f.indexOf('spirit/run/') === 0; }).join(' < '));
  });

  if (!production) {
    test.fail(title, 'no production stack reached it — the driven suites exercised nothing');
  } else if (around.length) {
    test.fail(title, around.length + ' path(s) around the door: ' + around.join('; '));
  } else {
    test.check(title, production + ' production call(s), every one through ' + row.door);
  }
});

test.reportSuccessFailureCount();
