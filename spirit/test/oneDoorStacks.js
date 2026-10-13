'use strict';

// spirit/test/oneDoorStacks.js
// NOBODY BUT THE GATE HAS A PATH TO ITS ENDPOINT (goal/G19.14, THE DOORS FROM THE PLUGIN'S LIST SINCE goal/G22.3).
//
//   Andy: "whe just want that a stack-frame test asserst nobody but
//   peerPost has a path to it." — "the permitted door is peerPost (bottom
//   frame) and the endpoints are the components of peerPost." — "It's
//   simply generate a set of test id's by matching allowed door (peerPost)
//   to endpoint (http, presenceNode etc)".
//
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box), not this file's to loosen: the doors are the stackFrameChecks plugin's
// list, spirit/run/process/js/desk/plugins/js/stackFrameChecks/stackFrameList.json, and this test reads it to know which
// checks to run. THE GATE IS NARROW: one file::function, matched against a frame in that file whose function is that
// one (tools/wirePaths.js, gateMatches). A whole module named as the gate is cheating. THE ENDPOINT IS WIDE: every
// function a module exports and what an exported factory returns, or Node's own http, https and fetch filtered to paths.
//
// One test per door: the probe runs that door's suites, and every stack that reached the endpoint is read. A stack with
// a production frame (spirit/run/...) and no frame matching the gate is a path around it, and fails the test.
//
// A STACK WITH NO PRODUCTION FRAME IS NOT COUNTED: a suite calling the component itself to unit-test it. Andy ruled
// tests are not subject to production rules.
//
// AN EMPTY RUN FAILS. A probe pointed at suites that never reached the endpoint reports nothing, and nothing would read
// as a clean door; a door the plugin has just added has no suites yet, and is red that way until an agent measures it.
// A DOOR THAT FAILS SHOWS WORK, and is left red: Andy wants doors that fail to show it, fixed in an item of their own.

const test = require('./testSupport.js');
const wirePaths = require('./tools/wirePaths.js');

function short(file) { return String(file).replace(/^spirit\/run\/js\//, '').replace(/\.js$/, ''); }

test.startTest('One door, by stack: nobody but the gate reaches its endpoint');

// ── THE FRAME CARRIES ITS FUNCTION, AND THE GATE MATCHES ON IT ──────
// Fed the shapes V8 prints, so a probe that dropped the name again, or a gate that matched the whole file, is red here
// before any door is judged.
test.subHeading('the frame and the gate');
(function () {
  const F = 'spirit/run/js/peerPost.js';
  const cases = [
    ['Object.post', F + ':802:post'], ['peerPost.post', F + ':802:post'], ['async post', F + ':802:post'],
    ['Object.holdStreams [as hold]', F + ':802:holdStreams'], ['new Thing', F + ':802:Thing'],
    ['Object.<anonymous>', F + ':802'], ['', F + ':802'],
  ];
  const got = typeof wirePaths.frameName === 'function' ? cases.map(function (c) { return wirePaths.frameName(F, '802', c[0]); }) : [];
  const bad = cases.filter(function (c, i) { return got[i] !== c[1]; });
  if (got.length && !bad.length) test.check('a frame is file:line:function, the function the last segment of V8\'s name, an anonymous one file:line');
  else test.fail('OWED by goal/G22.3: frameName gives ' + JSON.stringify(got) + ' against ' + JSON.stringify(cases.map(function (c) { return c[1]; })));
  const gm = wirePaths.gateMatches;
  const ok = typeof gm === 'function' && gm(F + ':802:post', F + '::post') && !gm(F + ':900:sendAttempt', F + '::post') &&
    !gm(F + ':802', F + '::post') && !gm('spirit/run/js/hub.js:5:post', F + '::post') && !gm(F + ':802:post', F) &&
    // The complete frame (goal/G22.3): written inside counts, in its own file only.
    gm(F + ':657 in sendAttempt in createPeerPost', F + '::createPeerPost') && gm(F + ':899:post in createPeerPost', F + '::createPeerPost') &&
    !gm('spirit/run/js/hub.js:5:post in createPeerPost', F + '::createPeerPost') && !gm(F + ':657 in sendAttempt', F + '::pump');
  if (ok) test.check('a gate file::function matches a frame in that file with that function, and nothing else; a gate with no function matches nothing');
  else test.fail('OWED by goal/G22.3: gateMatches is ' + typeof gm + ' or matches wrongly');
})();

// ── A CALLBACK'S STACK CARRIES THE FUNCTION THAT PLACED IT (goal/G22.3) ──
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box): the probe uses async_hooks, so a callback placed by a named function
// records that function below its own stack. A fixture planted under a temp spirit/run/ (ours() names it as the
// repo's) calls http.request from an anonymous .then placed by placeFromThen; the request is destroyed before it
// connects, to a port nobody listens on. Red here means a door like the relay's can never see its gate.
// The fixture runs under the probe watching the wire, and the line recorded for its request path comes back: '' when
// nothing was recorded.
function underProbe(prefix, name, source, marker) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawnSync } = require('child_process');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dir = path.join(home, 'spirit', 'run', 'js');
  fs.mkdirSync(dir, { recursive: true });
  const fixture = path.join(dir, name);
  const log = path.join(home, 'wire.tsv');
  fs.writeFileSync(fixture, source.join('\n'));
  const probe = path.join(__dirname, 'tools', 'wirePaths.js').replace(/\\/g, '/');
  const env = Object.assign({}, process.env, {
    SPIRIT_WIRE_LOG: log, SPIRIT_WIRE_BOTTOM: 'wire',
    NODE_OPTIONS: ((process.env.NODE_OPTIONS || '') + ' --require ' + probe).trim(),
  });
  spawnSync(process.execPath, [fixture], { env: env, encoding: 'utf8', timeout: 20000 });
  let raw = '';
  try { raw = fs.readFileSync(log, 'utf8'); } catch (e) { raw = ''; }
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) { /* left in tmp */ }
  return raw.split('\n').filter(function (l) { return l.indexOf(marker) !== -1; })[0] || '';
}
function framesOfLine(line) { return line.slice(line.indexOf('\t', line.indexOf('\t') + 1) + 1).split(' < '); }

test.subHeading('a callback carries its placer');
(function () {
  const line = underProbe('spirit-async-placer-', 'asyncPlacer.js', [
    "'use strict';",
    "const http = require('http');",
    'function placeFromThen() {',
    '  return Promise.resolve().then(function () {',
    "    const req = http.request({ host: '127.0.0.1', port: 9, path: '/selftest/async', method: 'POST' });",
    "    req.on('error', function () {});",
    '    req.destroy();',
    '  });',
    '}',
    'placeFromThen();',
    '',
  ], '/selftest/async');
  const placer = 'spirit/run/js/asyncPlacer.js::placeFromThen';
  if (framesOfLine(line).some(function (f) { return wirePaths.gateMatches(f, placer); })) {
    test.check('a request made in an anonymous .then records the named function that placed the callback');
  } else {
    test.fail('OWED by goal/G22.3: a request made in an anonymous .then lost its placer placeFromThen; recorded: ' + (line || '(nothing)'));
  }
})();

// ── A FRAME CARRIES THE FUNCTIONS IT IS WRITTEN INSIDE (goal/G22.3) ──
// DECIDED BY ANDY, 2026-10-13 (goal/G22.3's box): "you can construct a complete stackframe for anything that reaches
// endpoint. do it." A factory's instance functions are written inside the factory, which has returned long before any
// of them runs, so no live frame names it; the probe names it from the source. makeThing returns { go }, go is called
// from outside, and the gate fixture::makeThing must hold for it. Red here means peerPost.js::createPeerPost can never
// hold for post, onRequest or sendAttempt.
test.subHeading('a frame carries what it is written inside');
(function () {
  const line = underProbe('spirit-lexical-', 'lexicalThing.js', [
    "'use strict';",
    "const http = require('http');",
    'function makeThing() {',
    '  return {',
    '    go: function () {',
    "      const req = http.request({ host: '127.0.0.1', port: 9, path: '/selftest/lexical', method: 'POST' });",
    "      req.on('error', function () {});",
    '      req.destroy();',
    '    },',
    '  };',
    '}',
    'const thing = makeThing();',
    'thing.go();',
    '',
  ], '/selftest/lexical');
  const gate = 'spirit/run/js/lexicalThing.js::makeThing';
  if (framesOfLine(line).some(function (f) { return wirePaths.gateMatches(f, gate); })) {
    test.check('thing.go(), called from outside, holds the gate of the factory makeThing it is written inside');
  } else {
    test.fail('OWED by goal/G22.3: thing.go() does not hold the gate ' + gate + ' it is written inside; recorded: ' + (line || '(nothing)'));
  }
})();

let doors = [];
try { doors = wirePaths.doors(); } catch (e) { test.fail('OWED by goal/G22.3: the list of doors does not read: ' + ((e && e.message) || e)); }
if (!doors.length) test.fail('OWED by goal/G22.3: the list of doors is empty');

doors.forEach(function (d) {
  const name = wirePaths.doorKey(d);
  const row = wirePaths.BOTTOMS[name];
  const reached = /^node:/.test(d.endpoint) ? d.endpoint + ' on ' + (d.paths || []).join(', ') : short(d.endpoint);
  const title = 'nobody but ' + short(d.gate) + ' reaches ' + reached + ' (' + (d.item || 'no item') + ')';
  const suites = Array.isArray(d.suites) ? d.suites : [];
  test.subHeading(d.gate + ' -> ' + reached + ' (driven by ' + (suites.join(', ') || 'no suite yet') + ')');
  if (!row) { test.fail(title, 'the door has no row in tools/wirePaths.js BOTTOMS'); return; }
  if (!suites.length) { test.fail(title, 'no suites drive it yet: an empty run, measured by nobody'); return; }

  const run = wirePaths.measure(name, suites, false);
  if (run.status) test.comment('a driven suite exited ' + run.status + ': the run may have reached less than it should');

  let production = 0;
  const around = new Map();
  run.counts.forEach(function (n, key) {
    const tab = key.indexOf('\t');
    const where = key.slice(0, tab);
    const frames = key.slice(tab + 1).split(' < ');
    const ours = frames.filter(function (f) { return f.indexOf('spirit/run/') === 0; });
    if (!ours.length) return;
    production += n;
    if (frames.some(function (f) { return wirePaths.gateMatches(f, d.gate); })) return;
    const k = where + ' from ' + ours.join(' < ');
    around.set(k, (around.get(k) || 0) + n);
  });

  if (!production) {
    test.fail(title, 'no production stack reached it — the driven suites exercised nothing');
  } else if (around.size) {
    const list = Array.from(around.keys());
    test.fail(title, around.size + ' path(s) around the gate, of ' + production + ' production call(s): ' +
      list.slice(0, 8).join('; ') + (list.length > 8 ? '; and ' + (list.length - 8) + ' more' : ''));
  } else {
    test.check(title, production + ' production call(s), every one through ' + d.gate);
  }
});

test.reportSuccessFailureCount();
