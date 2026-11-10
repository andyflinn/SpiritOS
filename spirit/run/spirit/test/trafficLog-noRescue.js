'use strict';

// spirit/run/spirit/test/trafficLog-noRescue.js
// THE TRAFFIC LOG READS NO OLD traffic.json (goal/G43.23, item 7; spec: ./trafficLog-noRescue.md). The box: "old-data rescue
// still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3
// relay.db owner column." This file holds the traffic log's part: this tree's trafficLog.js opened in-process on a scratch
// root under /tmp, an old spirit/state/traffic.json planted there.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }

test.startTest('trafficLog-noRescue.js: on a scratch root, the traffic log reads no old traffic.json (goal/G43.23, item 7)');

function trafficChecks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-traffic-'));
  try {
    test.subHeading('The box: "the old traffic.json"');
    const OLD = 'rescue-traffic-hash-' + process.pid;
    const NEW = 'world-traffic-hash-' + process.pid;
    put(path.join(root, 'spirit', 'state', 'traffic.json'), JSON.stringify({ entries: [{ at: '2026-01-01T00:00:00.000Z', dir: 'in', kind: 'message', peer: 'old', relay: '', hash: OLD, outcome: 'delivered' }] }));
    const trafficLog = require(path.join(RUN, 'spirit', 'trafficLog.js'));
    const log = trafficLog.createTrafficLog({ rootDir: root });
    const before = log.read();
    ok(!before.some(function (r) { return r && r.hash === OLD; }), 'the log does not read the planted spirit/state/traffic.json (' + before.length + ' rows)',
      'the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers');
    log.note({ dir: 'in', kind: 'message', peer: 'world', hash: NEW, outcome: 'delivered' });
    const after = log.read();
    ok(after.some(function (r) { return r && r.hash === NEW; }), 'the world: a row noted on this scratch log is read back',
      'a row noted on this scratch log is not read back: the log read nothing, nothing judged (' + short(after) + ')');
    ok(!after.some(function (r) { return r && r.hash === OLD; }), 'with node.db written, the planted traffic.json is still not read',
      'with node.db written, the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers');
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

try { trafficChecks(); } catch (e) { test.fail('the test threw ' + (e && e.stack || e)); }
test.reportSuccessFailureCount();
process.exit(0);
