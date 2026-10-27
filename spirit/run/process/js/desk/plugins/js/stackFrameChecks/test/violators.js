'use strict';

// spirit/run/process/js/desk/plugins/js/stackFrameChecks/test/violators.js
// The tests of process/js/desk/plugins/js/stackFrameChecks/violators.js, and of no other module (spec: ./violators.md;
// goal/G41.11). The module is pure: a door and its run's raw paths in, one line per violator out. Its read of a source
// line is handed in (readLine), or read from a scratch tree of the test's own (root).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'violators.js');
const TMP = path.join(RUN, 'test', '_tmp_violators');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }

const GATE = 'spirit/run/spirit/peerPost.js::createPeerPost';
const MODULE_DOOR = { gate: GATE, endpoint: 'spirit/run/spirit/presenceNode.js' };
const NODE_DOOR = { gate: GATE, endpoint: 'node:http+https+fetch' };
const noFetch = function () { return '  return send(x);'; };

test.startTest('violators.js: a door\'s run as one line per violator');

(function () {
  let v = null;
  try { v = require(FILE).violators; } catch (e) { test.fail('violators.js threw as it loaded: ' + e.message); }
  ok(typeof v === 'function', 'it exports violators(door, paths, options)', 'exports ' + typeof v);
  if (typeof v !== 'function') return;

  test.subHeading('a module endpoint: the first frame outside the endpoint\'s file');
  const m1 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/spirit/hub.js:300:sealedClaim < spirit/run/spirit/hub.js:250:handleClaim < spirit/run/spirit/server.js:5:dispatch';
  const l1 = v(MODULE_DOOR, [m1], { readLine: noFetch });
  ok(l1.length === 1 && l1[0] === 'hub.js:300 sealedClaim (from handleClaim) ---> presenceNode.js announce, bypassing createPeerPost',
    'the violator, its caller in the same file, the module and function reached, the gate\'s function', 'got ' + short(l1));
  const m2 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/spirit/hub.js:300:sealedClaim < spirit/run/spirit/server.js:5:dispatch';
  ok(v(MODULE_DOOR, [m2])[0] === 'hub.js:300 sealedClaim ---> presenceNode.js announce, bypassing createPeerPost', 'a caller in another file (server.js\'s dispatch) is not said', 'got ' + short(v(MODULE_DOOR, [m2])));
  const m3 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/spirit/hub.js:300:sealedClaim < spirit/run/spirit/hub.js:40';
  ok(v(MODULE_DOOR, [m3])[0] === 'hub.js:300 sealedClaim ---> presenceNode.js announce, bypassing createPeerPost', 'nor top-level code above it', 'got ' + short(v(MODULE_DOOR, [m3])));
  const m4 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/js/boot.js:7';
  ok(v(MODULE_DOOR, [m4])[0] === 'boot.js:7 (top level) ---> presenceNode.js announce, bypassing createPeerPost', 'a violator with no function is (top level)', 'got ' + short(v(MODULE_DOOR, [m4])));
  const m5 = 'announce from spirit/run/spirit/presenceNode.js:10:announce < spirit/run/js/boot.js:7 in startAll in main';
  ok(v(MODULE_DOOR, [m5])[0] === 'boot.js:7 startAll ---> presenceNode.js announce, bypassing createPeerPost', 'an anonymous frame takes the first function it is written inside', 'got ' + short(v(MODULE_DOOR, [m5])));
  ok(v(MODULE_DOOR, [m1])[0].indexOf('relayRequest') === -1, 'a module door never says it bypassed the request library', 'got ' + short(v(MODULE_DOOR, [m1])));

  test.subHeading('a node: endpoint: the library\'s frames skipped, its entry and the via between');
  const n1 = 'GET /api/relay/key from spirit/run/spirit/relayRequest.js:40:send < spirit/run/spirit/hub.js:2784:relaySummary < spirit/run/js/ownerBadge.js:12:probe < spirit/run/spirit/hub.js:2700:relaySummary < spirit/run/spirit/hub.js:2600:relayGet';
  const ln = v(NODE_DOOR, [n1], { readLine: noFetch });
  ok(ln.length === 1 && ln[0] === 'hub.js:2784 relaySummary (from relayGet, via ownerBadge probe) ---> GET /api/relay/key, bypassing createPeerPost',
    'its entry is the highest frame of its function in its file; the other file between is a via; the caller above the entry is said', 'got ' + short(ln));
  const n2 = 'GET /api/relay/key from spirit/run/spirit/relayRequest.js:40:send < spirit/run/spirit/hub.js:2784:relaySummary < spirit/run/js/ownerBadge.js:12:probe < spirit/run/spirit/hub.js:2700:relaySummary < spirit/run/spirit/hub.js:2650:relaySearch';
  const two = v(NODE_DOOR, [n1, n2, n1], { readLine: noFetch });
  ok(two.length === 2 && /from relayGet/.test(two[0]) && /from relaySearch/.test(two[1]), 'one line per caller: the same violator from two callers is two lines (Andy: "list them separately")', 'got ' + short(two));
  ok(two.filter(function (l) { return /from relayGet/.test(l); }).length === 1, 'the same path twice is one line', 'got ' + short(two));
  ok(v(NODE_DOOR, [n2, n1], { readLine: noFetch })[0].indexOf('relaySearch') !== -1, 'lines keep the order their first path came in', 'got ' + short(v(NODE_DOOR, [n2, n1], { readLine: noFetch })));

  test.subHeading('no frame of the library below the violator: it bypassed relayRequest too');
  const f1 = 'GET /api/relay/key from spirit/run/js/offboard.js:78:main';
  const read = [];
  const withFetch = v(NODE_DOOR, [f1], { readLine: function (file, line) { read.push(file + ':' + line); return '  const r = await fetch(url, { method: \'GET\' });'; } });
  ok(withFetch[0] === 'offboard.js:78 main ---> GET /api/relay/key by plain fetch, bypassing createPeerPost and relayRequest', 'its own line calling fetch( is "by plain fetch", and the library is bypassed too', 'got ' + short(withFetch));
  ok(read.join() === 'spirit/run/js/offboard.js:78', 'it reads the violator\'s own line, nothing else', 'read ' + short(read));
  ok(v(NODE_DOOR, [f1], { readLine: noFetch })[0] === 'offboard.js:78 main ---> GET /api/relay/key, bypassing createPeerPost and relayRequest', 'a line without fetch( is not "by plain fetch"', 'got ' + short(v(NODE_DOOR, [f1], { readLine: noFetch })));
  ok(v(NODE_DOOR, [f1], { readLine: function () { return 'return client.fetch(url);'; } })[0].indexOf('plain fetch') === -1, 'a method named fetch (.fetch() is no plain fetch', 'got ' + short(v(NODE_DOOR, [f1], { readLine: function () { return 'client.fetch(url)'; } })));
  ok(v(NODE_DOOR, [f1])[0].indexOf('plain fetch') === -1, 'with no root and no readLine nothing is read, and nothing is said of fetch', 'got ' + short(v(NODE_DOOR, [f1])));

  test.subHeading('options.root: the line read from the tree');
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'spirit', 'run', 'js'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'spirit', 'run', 'js', 'offboard.js'), ['a', 'b', 'fetch(u).then(go);'].join('\n'));
  const p3 = 'POST /api/relay/claim from spirit/run/js/offboard.js:3:main';
  const p1 = 'POST /api/relay/claim from spirit/run/js/offboard.js:1:other';
  const rooted = v(NODE_DOOR, [p3, p1, 'GET /x from spirit/run/js/missing.js:1:gone'], { root: TMP });
  ok(/by plain fetch/.test(rooted[0]) && !/plain fetch/.test(rooted[1]) && !/plain fetch/.test(rooted[2]), 'the frame\'s file is read under root at its line; a file not there reads as no line', 'got ' + short(rooted));
  fs.rmSync(TMP, { recursive: true, force: true });

  test.subHeading('what does not read as a path is kept as it came');
  const raw = 'the runner said something else';
  const allLib = 'GET /api/x from spirit/run/spirit/relayRequest.js:40:send';
  const inEndpoint = 'announce from spirit/run/spirit/presenceNode.js:10:announce';
  ok(v(NODE_DOOR, [raw])[0] === raw && v(NODE_DOOR, [allLib])[0] === allLib && v(MODULE_DOOR, [inEndpoint])[0] === inEndpoint, 'a path with no frames, or with only the library\'s or the endpoint\'s, is kept whole', 'got ' + short([v(NODE_DOOR, [raw]), v(NODE_DOOR, [allLib]), v(MODULE_DOOR, [inEndpoint])]));
  const odd = 'GET /api/x from not a frame < spirit/run/js/a.js:5:go';
  ok(v(NODE_DOOR, [odd], { readLine: noFetch })[0] === 'a.js:5 go ---> GET /api/x, bypassing createPeerPost and relayRequest', 'a frame that does not parse is passed over', 'got ' + short(v(NODE_DOOR, [odd], { readLine: noFetch })));
  ok(Array.isArray(v(NODE_DOOR, null)) && v(NODE_DOOR, null).length === 0 && v(NODE_DOOR, 'x').length === 0, 'paths that are no list give no lines', 'got ' + short(v(NODE_DOOR, null)));
  ok(v({ gate: 'peerPost', endpoint: 'node:fetch' }, [f1], { readLine: noFetch })[0] === 'offboard.js:78 main ---> GET /api/relay/key, bypassing peerPost and relayRequest', 'a gate with no :: is named whole', 'got ' + short(v({ gate: 'peerPost', endpoint: 'node:fetch' }, [f1], { readLine: noFetch })));
  let threw = null;
  try { v(null, [f1]); v(undefined, undefined, undefined); } catch (e) { threw = e; }
  ok(!threw, 'no door and no options throw nothing', 'threw ' + short(threw && threw.message));
}());

test.reportSuccessFailureCount();
