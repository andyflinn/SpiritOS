'use strict';

// spirit/run/spirit/test/lever.js
// The tests of spirit/lever.js, and of no other module (spec: ./lever.md). Its own test, owed since the rule "every
// production script has its own test" (goal/G47.1, box v72).
//
// One gauge: a relay's bound, described once at boot and only read after (cycle 8: the lever cannot move). make() on
// the relay, fromReport() on the node's monitor. Pure, in process.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const L = require(path.join(RUN, 'spirit', 'lever.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function throws(fn) { try { fn(); return ''; } catch (e) { return String(e && e.message); } }
const G = L.make('connections1', { floor: 1, ceiling: 100, value: 40, worseAt: 'floor' });

// ── make ──
test.run('make describes the gauge: label, value, floor, ceiling, worseAt', 0.2, function () {
  return (G.label === 'connections1' && G.value === 40 && G.floor === 1 && G.ceiling === 100 && G.worseAt === 'floor') || 'gauge: ' + short(G);
}, test.limit.quick);
test.run('a gauge cannot move: it is frozen and has no setter (Andy: "relay will self-manage within fixed/constant limits")', 0.2, function () {
  try { G.value = 99; } catch (e) { /* strict mode: refused */ }
  return (Object.isFrozen(G) && G.value === 40 && typeof G.set === 'undefined') || 'gauge moved or settable: ' + short(G);
}, test.limit.quick);
test.run('readOut keeps the lever\'s old field names: settable false, locked false, lastMove null', 0.2, function () {
  const r = G.readOut();
  return short(r) === short({ label: 'connections1', value: 40, floor: 1, ceiling: 100, settable: false, worseAt: 'floor', locked: false, lastMove: null }) || 'readOut: ' + short(r);
}, test.limit.quick);
test.run('readOut is a fresh object each time, never a reference into the gauge', 0.2, function () {
  const a = G.readOut(); a.value = 7;
  return (G.readOut().value === 40 && a !== G.readOut()) || 'readOut shared state';
}, test.limit.quick);
test.run('with no value given, the value is the floor; worseAt other than floor or ceiling is null', 0.2, function () {
  const g = L.make('requestTimeout1', { floor: 5, ceiling: 9, worseAt: 'middle' });
  return (g.value === 5 && g.worseAt === null && L.make('a1', { floor: 0, ceiling: 1, worseAt: 'ceiling' }).worseAt === 'ceiling') || 'gauge: ' + short(g);
}, test.limit.quick);
test.run('make refuses, never corrects: a label off the lever rule (Andy: "meaning001 (meaning and iteration)")', 0.2, function () {
  const got = ['connections', 'connections01', 'conn_1', ''].map(function (l) { return throws(function () { L.make(l, { floor: 0, ceiling: 1 }); }); });
  return got.every(function (m) { return /bad label/.test(m); }) || 'refusals: ' + short(got);
}, test.limit.quick);
test.run('make refuses a floor or ceiling that is no integer, an inverted range, and a value outside it', 0.2, function () {
  const got = [
    throws(function () { L.make('a1', { floor: 0.5, ceiling: 1 }); }),
    throws(function () { L.make('a1', { floor: 0 }); }),
    throws(function () { L.make('a1', { floor: 5, ceiling: 1 }); }),
    throws(function () { L.make('a1', { floor: 0, ceiling: 1, value: 2 }); }),
  ];
  return (/must be integers/.test(got[0]) && /must be integers/.test(got[1]) && /above ceiling/.test(got[2]) && /outside/.test(got[3])) || 'refusals: ' + short(got);
}, test.limit.quick);

// ── fromReport: the node side draws what it is sent ──
test.run('fromReport answers the same report the relay read out', 0.2, function () {
  const r = L.fromReport(JSON.parse(JSON.stringify(G.readOut())));
  return short(r) === short(G.readOut()) || 'fromReport: ' + short(r);
}, test.limit.quick);
test.run('fromReport never moves anything: a report claiming settable, locked or a lastMove is drawn as fixed', 0.2, function () {
  const r = L.fromReport({ label: 'connections1', value: 3, floor: 1, ceiling: 9, settable: true, locked: true, lastMove: { by: 'governor' } });
  return (!!r && r.settable === false && r.locked === false && r.lastMove === null) || 'fromReport: ' + short(r);
}, test.limit.quick);
test.run('fromReport answers null for no object, a bad label, a range that is no integers, an inverted range or a value outside', 0.2, function () {
  const got = [null, 'x', { label: 'bad', floor: 0, ceiling: 1 }, { label: 'a1', floor: '0', ceiling: 1 }, { label: 'a1', floor: 3, ceiling: 1 }, { label: 'a1', floor: 0, ceiling: 1, value: 5 }].map(L.fromReport);
  return got.every(function (x) { return x === null; }) || 'fromReport: ' + short(got);
}, test.limit.quick);
test.run('fromReport with no integer value draws the floor', 0.2, function () {
  const r = L.fromReport({ label: 'a1', floor: 2, ceiling: 4, value: 'high' });
  return (!!r && r.value === 2) || 'fromReport: ' + short(r);
}, test.limit.quick);
