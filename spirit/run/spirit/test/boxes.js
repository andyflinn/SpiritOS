'use strict';

// spirit/run/spirit/test/boxes.js
// The tests of spirit/boxes.js, and of no other module (spec: ./boxes.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
//
// createBoxes(opts): the owner's view of his boxes (public-app-server/G10, the node's half): each of his app servers
// reports four facts about the box it sits on, and the node matches by fingerprint and sums; he decides. In memory, and
// believed only from a key in spirit/state/servers.json. On a scratch folder with a planted clock; arrivals are handed
// in as arrivals.js hands them, the envelope already read.

const fs = require('fs');
const os = require('os');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const B = require(path.join(RUN, 'spirit', 'boxes.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function scratch() { return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-boxes-')); }
function mine(root, keys) { const f = path.join(root, 'spirit', 'state', B.SERVERS); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ keys: keys })); }
// A box report from a server, as arrivals.js hands it over: a system packet, no app, the box in its body.
function report(from, box, extra) { return Object.assign({ fromKey: from, envelope: { v: 1, id: 'x', body: { box: box } } }, extra || {}); }
function rowOf(list, fp) { return list.filter(function (g) { return g.fingerprint === fp; })[0] || null; }

const ROOT = scratch();
mine(ROOT, ['srv-1', 'srv-2', 'srv-3']);
let clock = 1000;
const V = B.createBoxes({ rootDir: ROOT, now: function () { return clock; } });

// ── only his servers are believed ──
test.run('SERVERS names the owner\'s list of his server keys: servers.json', 0.2, function () {
  return B.SERVERS === 'servers.json' || 'SERVERS: ' + short(B.SERVERS);
}, test.limit.quick);
test.run('the world: two of his servers report the same box, a third another box', 0.2, function () {
  V.onArrival(report('srv-1', { boxLabel: 'hetzner-1', fingerprint: 'fp-A', allottedMB: 600, boxTotalMB: 1000 }));
  clock = 2000;
  V.onArrival(report('srv-2', { boxLabel: 'hetzner-1', fingerprint: 'fp-A', allottedMB: 500, boxTotalMB: 1000 }));
  V.onArrival(report('srv-3', { boxLabel: 'ovh', fingerprint: 'fp-B', allottedMB: 200, boxTotalMB: 200 }));
  return V.list().length === 2 || 'list: ' + short(V.list());
}, test.limit.quick);
test.run('one row per box: the servers sharing a fingerprint are matched up, each with its allotment and when it reported', 0.2, function () {
  const a = rowOf(V.list(), 'fp-A');
  if (!a) return 'no row for fp-A: ' + short(V.list());
  const s = a.servers.map(function (x) { return x.key + ':' + x.allottedMB + '@' + x.at; }).sort();
  return (a.boxLabel === 'hetzner-1' && short(s) === short(['srv-1:600@1000', 'srv-2:500@2000'])) || 'row: ' + short(a);
}, test.limit.quick);
test.run('the node sums: what the box\'s servers were allotted, against what the box reports it has', 0.2, function () {
  const a = rowOf(V.list(), 'fp-A');
  return (!!a && a.allottedMB === 1100 && a.boxTotalMB === 1000) || 'row: ' + short(a);
}, test.limit.quick);
test.run('over-committed is a warning: allotted above the box\'s total', 0.2, function () {
  const a = rowOf(V.list(), 'fp-A');
  return (!!a && a.warning === true) || 'row: ' + short(a);
}, test.limit.quick);
test.run('equal is not over: a box allotted exactly what it has carries no warning', 0.2, function () {
  const b = rowOf(V.list(), 'fp-B');
  return (!!b && b.allottedMB === 200 && b.boxTotalMB === 200 && b.warning === false) || 'row: ' + short(b);
}, test.limit.quick);
test.run('a report is facts, never an opinion: a server saying "no warning" does not hide an over-committed box', 0.2, function () {
  const root = scratch(); mine(root, ['s']);
  const v = B.createBoxes({ rootDir: root });
  v.onArrival(report('s', { fingerprint: 'fp', allottedMB: 900, boxTotalMB: 100, warning: false }));
  const r = v.list()[0] || {};
  return r.warning === true || 'row: ' + short(r);
}, test.limit.quick);
test.run('a server\'s newest report replaces its last: its allotment is counted once', 0.2, function () {
  const root = scratch(); mine(root, ['s']);
  const v = B.createBoxes({ rootDir: root });
  v.onArrival(report('s', { fingerprint: 'fp', allottedMB: 900, boxTotalMB: 1000 }));
  v.onArrival(report('s', { fingerprint: 'fp', allottedMB: 100, boxTotalMB: 1000 }));
  const r = v.list();
  return (r.length === 1 && r[0].allottedMB === 100 && r[0].servers.length === 1) || 'list: ' + short(r);
}, test.limit.quick);
test.run('a report from a key not in servers.json is ignored', 0.2, function () {
  V.onArrival(report('stranger', { boxLabel: 'invented', fingerprint: 'fp-X', allottedMB: 1, boxTotalMB: 1 }));
  V.onArrival(report('stranger', { fingerprint: 'fp-A', allottedMB: 9999, boxTotalMB: 1000 }));
  const a = rowOf(V.list(), 'fp-A');
  return (!rowOf(V.list(), 'fp-X') && !!a && a.allottedMB === 1100) || 'list: ' + short(V.list());
}, test.limit.quick);
test.run('a stranger\'s report is not kept at all: added to his list afterwards, its earlier report does not appear', 0.2, function () {
  const root = scratch(); mine(root, ['s']);
  const v = B.createBoxes({ rootDir: root });
  v.onArrival(report('later', { fingerprint: 'fp-early', allottedMB: 1, boxTotalMB: 1 }));
  mine(root, ['s', 'later']);
  return v.list().length === 0 || 'kept from before it was his: ' + short(v.list());
}, test.limit.quick);
test.run('no servers.json, or one that does not parse, means nobody is believed', 0.2, function () {
  const none = B.createBoxes({ rootDir: scratch() });
  none.onArrival(report('srv-1', { fingerprint: 'fp', allottedMB: 1, boxTotalMB: 1 }));
  const root = scratch(); const f = path.join(root, 'spirit', 'state', B.SERVERS);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, '{not json');
  const bad = B.createBoxes({ rootDir: root });
  bad.onArrival(report('srv-1', { fingerprint: 'fp', allottedMB: 1, boxTotalMB: 1 }));
  return (none.list().length === 0 && bad.list().length === 0) || 'kept: ' + short([none.list(), bad.list()]);
}, test.limit.quick);
test.run('an app\'s packet, a packet with no box, and an arrival with no sender are not box reports', 0.2, function () {
  const root = scratch(); mine(root, ['s']);
  const v = B.createBoxes({ rootDir: root });
  const app = report('s', { fingerprint: 'fp1', allottedMB: 1, boxTotalMB: 1 }); app.envelope.app = 'chat';
  v.onArrival(app);
  v.onArrival({ fromKey: 's', envelope: { v: 1, body: { hello: 1 } } });
  v.onArrival(report('', { fingerprint: 'fp2', allottedMB: 1, boxTotalMB: 1 }));
  v.onArrival(null);
  return v.list().length === 0 || 'list: ' + short(v.list());
}, test.limit.quick);
test.run('servers.json is read when he looks: a server taken off his list leaves the view at once', 0.2, function () {
  const root = scratch(); mine(root, ['s1', 's2']);
  const v = B.createBoxes({ rootDir: root });
  v.onArrival(report('s1', { fingerprint: 'fp', allottedMB: 900, boxTotalMB: 1000 }));
  v.onArrival(report('s2', { fingerprint: 'fp', allottedMB: 900, boxTotalMB: 1000 }));
  const before = (v.list()[0] || {}).warning;
  mine(root, ['s1']);
  const after = v.list()[0] || {};
  return (before === true && after.allottedMB === 900 && after.warning === false && after.servers.length === 1) || 'before ' + short(before) + ', after ' + short(after);
}, test.limit.quick);
test.run('in memory, by design: a new view starts empty, and nothing is written beside servers.json', 0.2, function () {
  const again = B.createBoxes({ rootDir: ROOT });
  const files = fs.readdirSync(path.join(ROOT, 'spirit', 'state'));
  return (again.list().length === 0 && short(files) === short([B.SERVERS])) || 'list ' + short(again.list()) + ', files ' + short(files);
}, test.limit.quick);

// ── searched, not listed (puppets/G2) ──
test.run('search with no words, or "*", is every box, keyed by its fingerprint', 0.2, function () {
  const r = [V.search(''), V.search('*'), V.search()];
  const keys = r.map(function (x) { return x.items.map(function (i) { return i.key; }).sort().join(','); });
  return keys.every(function (k) { return k === 'fp-A,fp-B'; }) || 'keys: ' + short(keys);
}, test.limit.quick);
test.run('a box\'s label is its name, with the warning as a word when he has promised it more than it has', 0.2, function () {
  const labels = V.search('').items.map(function (i) { return i.label; }).sort();
  return short(labels) === short(['hetzner-1 — over-committed', 'ovh']) || 'labels: ' + short(labels);
}, test.limit.quick);
test.run('searching "over-committed" ranks the over-committed box first, though it reported last', 0.2, function () {
  const root = scratch(); mine(root, ['s1', 's2']);
  const v = B.createBoxes({ rootDir: root });
  v.onArrival(report('s1', { boxLabel: 'fine', fingerprint: 'fp-fine', allottedMB: 1, boxTotalMB: 10 }));
  v.onArrival(report('s2', { boxLabel: 'full', fingerprint: 'fp-full', allottedMB: 99, boxTotalMB: 10 }));
  const r = v.search('over-committed');
  return ((r.items[0] || {}).key === 'fp-full' && r.more === false) || 'search: ' + short(r);
}, test.limit.quick);
test.run('get(fingerprint) answers that box\'s row; an unknown one is null', 0.2, function () {
  const a = V.get('fp-A');
  return (!!a && a.allottedMB === 1100 && a.warning === true && V.get('fp-nope') === null) || 'get: ' + short([a, V.get('fp-nope')]);
}, test.limit.quick);
