'use strict';

// spirit/run/spirit/test/trafficLog.js
// The tests of spirit/trafficLog.js, in this one file (spec: ./trafficLog.md). Its sections: no admitted mark, then no old
// traffic.json read (goal/G43.23, item 7).
// TRAFFICLOG.JS MARKS NO ADMITTED (goal/G43.23, item 6, after goal/G43.17). Andy, G43.17: "Didn't i say remove ALL
// code referencing "admit" and "hold". it was a hair-brained scheme, and it HAS TO GO."
// Moved here from spirit/test/nodeStore-noAdmitHold.js (goal/G43.28; Andy: "you WILL FUCKING PLACE TESTS WHERE THEY FUCKING
// BELONG"): beside the file whose code it reads. Each file's code is read with its comments left out. No node, no port.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// A file's code, comments blanked (line numbers kept); null when the file is not there.
function code(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, ' '); })
    .replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
}
// The lines of a file's code matching re, as "name:line text".
function hits(file, re) {
  const c = code(file);
  if (c === null) return null;
  const out = [];
  c.split('\n').forEach(function (l, i) { if (re.test(l)) out.push(path.basename(file) + ':' + (i + 1) + ' ' + l.trim().slice(0, 100)); });
  return out;
}
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
function world(file, anchor) {
  const c = code(file);
  ok(c !== null && anchor.test(c), 'the world: ' + path.relative(RUN, file) + ' is read, its code holding ' + anchor,
    c === null ? path.relative(RUN, file) + ' is not there: nothing judged' : path.relative(RUN, file) + '\'s code holds no ' + anchor + ': the comment stripper ate it, nothing judged');
  return c !== null;
}

test.startTest('trafficLog.js: trafficLog.js names no admitted mark, and reads no old traffic.json');

(async function () {
  test.subHeading('the traffic log\'s admitted mark: trafficLog');
  const f = path.join(RUN, 'spirit', 'trafficLog.js');
  if (world(f, /module\.exports/)) {
    const h = hits(f, /admit/i);
    ok(!h.length, 'trafficLog.js\'s code names no admitted mark', 'trafficLog.js\'s code still marks or reads admitted: ' + short(h));
  }
}()).then(null, function (e) { test.fail('the test threw ' + (e && e.stack || e)); })
  // The section folded in from a file of its own, no rescue, runs after the checks above.
  .then(function () { return noRescuePart().then(null, function (e) { test.fail('the noRescue part threw ' + (e && e.stack || e)); }); })
  .then(function () { test.reportSuccessFailureCount(); process.exit(0); });

async function noRescuePart() {
  // ── THE NO RESCUE PART ──
  // THE TRAFFIC LOG READS NO OLD traffic.json (goal/G43.23, item 7; spec: ./trafficLog.md, its section). The box: "old-data rescue
  // still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3
  // relay.db owner column." This section holds the traffic log's part: this tree's trafficLog.js opened in-process on a scratch
  // root under /tmp, an old spirit/state/traffic.json planted there.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }

  test.subHeading('noRescue: on a scratch root, the traffic log reads no old traffic.json (goal/G43.23, item 7)');

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

  trafficChecks();
}
