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

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function put(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
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

// the traffic log's admitted mark: trafficLog
const f = path.join(RUN, 'spirit', 'trafficLog.js');
// The world: the file is there and its code, comments left out, still holds a line that is surely code.
test.run('the world: the file is read, and its code, comments left out, still holds a line of code', 0.2, function () {
  const c = code(f);
  return (c !== null && /module\.exports/.test(c)) ||
    (c === null ? path.relative(RUN, f) + ' is not there: nothing judged' : path.relative(RUN, f) + '\'s code holds no /module\\.exports/: the comment stripper ate it, nothing judged');
}, 1000);
test.run('trafficLog.js\'s code names no admitted mark', 0.2, function () {
  const h = hits(f, /admit/i);
  if (h === null) return 'trafficLog.js is not there: nothing judged';
  return !h.length || 'trafficLog.js\'s code still marks or reads admitted: ' + short(h);
}, 1000);

// ── THE NO RESCUE PART ──
// THE TRAFFIC LOG READS NO OLD traffic.json (goal/G43.23, item 7; spec: ./trafficLog.md, its section). The box: "old-data rescue
// still runs (G41.30): relayKeys importOld, shellMove, the old traffic.json, routingTable.json, invites.json, the cycle-3
// relay.db owner column." This section holds the traffic log's part: this tree's trafficLog.js opened in-process on a scratch
// root under /tmp, an old spirit/state/traffic.json planted there.
// noRescue: on a scratch root, the traffic log reads no old traffic.json (goal/G43.23, item 7)
// The box: "the old traffic.json"
const OLD = 'rescue-traffic-hash-' + process.pid;
const NEW = 'world-traffic-hash-' + process.pid;
const W = { root: null, log: null, after: null };
test.run('the log does not read the planted spirit/state/traffic.json', 0.2, function () {
  W.root = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-traffic-'));
  put(path.join(W.root, 'spirit', 'state', 'traffic.json'), JSON.stringify({ entries: [{ at: '2026-01-01T00:00:00.000Z', dir: 'in', kind: 'message', peer: 'old', relay: '', hash: OLD, outcome: 'delivered' }] }));
  W.log = require(f).createTrafficLog({ rootDir: W.root });
  const before = W.log.read();
  return !before.some(function (r) { return r && r.hash === OLD; }) || 'the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers';
}, 1000);
test.run('the world: a row noted on this scratch log is read back', 0.2, function () {
  if (!W.log) return 'no scratch log: the world failed';
  W.log.note({ dir: 'in', kind: 'message', peer: 'world', hash: NEW, outcome: 'delivered' });
  W.after = W.log.read();
  return W.after.some(function (r) { return r && r.hash === NEW; }) || 'a row noted on this scratch log is not read back: the log read nothing, nothing judged (' + short(W.after) + ')';
}, 1000);
test.run('with node.db written, the planted traffic.json is still not read', 0.2, function () {
  if (!W.after) return 'no row noted: the world failed';
  return !W.after.some(function (r) { return r && r.hash === OLD; }) || 'with node.db written, the log reads the old traffic.json: its row ' + OLD + ' is in what the log answers';
}, 1000);

test.after(function () { if (W.root) { try { fs.rmSync(W.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } } });
