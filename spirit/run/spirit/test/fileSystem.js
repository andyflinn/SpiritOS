'use strict';

// spirit/run/spirit/test/fileSystem.js
// The tests of spirit/fileSystem.js, and of no other module (spec: ./fileSystem.md). This file holds its two gates,
// fileServable (can a path be read) and fileWritable (can it be written), against a path spelled in another case
// (goal/G41.30; Andy, 2026-11-02: "Path gates are case-sensitive, so on Windows and macOS GET /Relay-State/identity.json
// serves the private keys"). On those disks a name in any case opens the same file, so a gate that refuses
// relay-state/ but not Relay-State/ refuses nothing there. Nothing is read or written: the gates are asked only.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FS = require(path.join(RUN, 'spirit', 'fileSystem.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function ask(fn, p) { try { return FS[fn](p); } catch (e) { return 'threw ' + (e && e.message); } }

test.startTest('fileSystem.js: its gates refuse a path in any case');

// Each closed path, as the gate refuses it today, and the same path in other cases.
const CLOSED_READ = [
  ['relay-state/identity.json', 'the node\'s private key'],
  ['process/js/desk/relay-state/identity.json', 'an app server\'s private key, at depth'],
  ['spirit/server.js', 'a server script'],
  ['spirit/DEBUG/garbageArguments.js', 'the DEBUG folder'],
  ['shell/info/info.js.sidecar.json', 'a sidecar\'s own path'],
];
function cases(p) {
  const up = p.toUpperCase();
  const title = p.split('/').map(function (s) { return s.split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('-'); }).join('/');
  return [up, title].filter(function (x, i, all) { return x !== p && all.indexOf(x) === i; });
}

test.subHeading('fileServable: what it refuses, it refuses in every case');
CLOSED_READ.forEach(function (c) {
  ok(ask('fileServable', c[0]) === false, 'refused as written: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') is servable as written: the case below judges nothing');
  cases(c[0]).forEach(function (v) {
    ok(ask('fileServable', v) === false, 'refused: ' + v + ' (' + c[1] + ', another case)', v + ' (' + c[1] + ', another case) is servable: on a case-insensitive disk it opens ' + c[0]);
  });
});

test.subHeading('fileWritable: what it refuses, it refuses in every case');
const CLOSED_WRITE = [
  ['relay-state/identity.json', 'the node\'s private key'],
  ['relay-state/new.json', 'anything under relay-state'],
  ['spirit/server.js', 'a core file'],
  ['shell/js/icon.js', 'a core file under shell/js'],
  ['shell/info/info.js.sidecar.json', 'a sidecar\'s own path'],
];
CLOSED_WRITE.forEach(function (c) {
  ok(ask('fileWritable', c[0]) === false, 'refused as written: ' + c[0] + ' (' + c[1] + ')', c[0] + ' (' + c[1] + ') is writable as written: the case below judges nothing');
  cases(c[0]).forEach(function (v) {
    ok(ask('fileWritable', v) === false, 'refused: ' + v + ' (' + c[1] + ', another case)', v + ' (' + c[1] + ', another case) is writable: on a case-insensitive disk it writes ' + c[0]);
  });
});

test.subHeading('what is open stays open');
[['index.html', 'fileServable'], ['shell/js/icon.js', 'fileServable'], ['preferences.json', 'fileWritable']].forEach(function (c) {
  ok(ask(c[1], c[0]) === true, c[1] + ' keeps ' + c[0] + ' open', c[1] + ' closed ' + c[0] + ': the fix went too wide');
});

test.reportSuccessFailureCount();
