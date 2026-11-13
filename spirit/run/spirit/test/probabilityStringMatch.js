'use strict';

// spirit/run/spirit/test/probabilityStringMatch.js
// The tests of spirit/probabilityStringMatch.js, and of no other module (spec: ./probabilityStringMatch.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// probabilityStringMatch(A, B): how likely two strings mean the same thing, as a number from 0 to 1 (goal/G18.2), with
// distance and case added by goal/G29.1 and the shorter token first by goal/G41.28. Pure: two strings in, one number out.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const M = require(path.join(RUN, 'spirit', 'probabilityStringMatch.js'));
const p = M.probabilityStringMatch;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function inRange(x) { return typeof x === 'number' && x >= 0 && x <= 1; }

// ── Andy's item, goal/G18.2 ──
test.run('A or B not a string gives 0.0', 0.2, function () {
  const got = [p(1, '1'), p('1', 1), p(null, 'a'), p('a', undefined), p({}, '[object Object]'), p(['a'], 'a')];
  return got.every(function (x) { return x === 0; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('A exactly equal to B gives 1.0', 0.2, function () {
  const got = [p('relay', 'relay'), p('Relay Box', 'Relay Box'), p('*?', '*?'), p('', '')];
  return got.every(function (x) { return x === 1; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('an empty string against a non-empty one gives 0 (Andy, 2026-10-12)', 0.2, function () {
  const got = [p('', 'x'), p('x', ''), p('', 'relay server')];
  return got.every(function (x) { return x === 0; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('no matter which one is the search string: A and B swapped give the same probability', 0.2, function () {
  const pairs = [['relay', 'relay server'], ['desk', 'desk server'], ['alpha beta', 'beta alpha gamma'], ['reLay', 'Relay box'], ['café', 'my cafe']];
  const bad = pairs.filter(function (x) { return p(x[0], x[1]) !== p(x[1], x[0]); });
  return bad.length === 0 || 'not the same swapped: ' + short(bad.map(function (x) { return [x, p(x[0], x[1]), p(x[1], x[0])]; }));
}, test.limit.quick);
test.run('every answer is a number from 0 to 1', 0.2, function () {
  const pairs = [['relay', 'relay server'], ['a b', 'b a'], ['x', 'xxxxxxxxxxxxxxxxxxxxxxxxxxx'], ['one two three', 'one'], ['abc', 'abd'], ['Ü', 'u']];
  const bad = pairs.filter(function (x) { return !inRange(p(x[0], x[1])); });
  return bad.length === 0 || 'out of range: ' + short(bad);
}, test.limit.quick);
test.run('strings that share nothing give 0', 0.2, function () {
  const got = [p('relay', 'xyz'), p('abc', 'abd'), p('ab', 'ba')];
  return got.every(function (x) { return x === 0; }) || 'got ' + short(got);
}, test.limit.quick);

// ── how good a match is ──
test.run('starts with beats found somewhere', 0.2, function () {
  const a = p('relay', 'relay server');
  const b = p('relay', 'my relay ser');
  return (a > b && b > 0) || 'starts ' + a + ', inside ' + b;
}, test.limit.quick);
test.run('found whole beats only some of the words found', 0.2, function () {
  const a = p('relay zz', 'my relay zz box');
  const b = p('relay zz', 'the relay box q');
  return (a > b && b > 0) || 'whole ' + a + ', some words ' + b;
}, test.limit.quick);
test.run('the closer the lengths, the higher: a word in a short text beats it in a long one', 0.2, function () {
  const a = p('relay', 'relay box');
  const b = p('relay', 'relay box with a very long label after it');
  return (a > b && b > 0) || 'short ' + a + ', long ' + b;
}, test.limit.quick);
test.run('no wildcards: * and ? are characters like any other', 0.2, function () {
  const got = [p('*', 'abc'), p('a*', 'abc'), p('a?', 'abc'), p('*', 'a*c'), p('a?', 'xa?')];
  return (got[0] === 0 && got[1] === 0 && got[2] === 0 && got[3] > 0 && got[4] > 0) || 'got ' + short(got);
}, test.limit.quick);
test.run('accents fold both ways: ü matches u and é matches e', 0.2, function () {
  const got = [p('ü', 'u'), p('u', 'ü'), p('café', 'cafe'), p('cafe', 'café')];
  return got.every(function (x) { return x === 1; }) || 'got ' + short(got);
}, test.limit.quick);

// ── goal/G29.1: distance counts, and more than order ──
test.run('words side by side beat the same words far apart (proximity)', 0.2, function () {
  const a = p('alpha beta', 'alpha beta gamma');
  const b = p('alpha beta', 'alpha x x x x x x x x x x beta');
  return a > b || 'side by side ' + a + ', far apart ' + b;
}, test.limit.quick);
test.run('words in the order typed beat the same words swapped (sequence)', 0.2, function () {
  const a = p('one two', 'one two x');
  const b = p('one two', 'two one x');
  return a > b || 'in order ' + a + ', swapped ' + b;
}, test.limit.quick);
test.run('distance weighs more than order: adjacent and swapped beats in order with a word between, the labels the same length', 0.2, function () {
  const a = p('alpha beta', 'beta alpha zz');
  const b = p('alpha beta', 'alpha zz beta');
  return a > b || 'adjacent swapped ' + a + ', in order apart ' + b;
}, test.limit.quick);

// ── goal/G29.1: case counts, by a hair ──
test.run('case counts: "Relay" matches "Relay box" better than "relay" does, and "relay" better than "reLay"', 0.2, function () {
  const got = [p('Relay', 'Relay box'), p('relay', 'Relay box'), p('reLay', 'Relay box')];
  return (got[0] > got[1] && got[1] > got[2]) || 'got ' + short(got);
}, test.limit.quick);
test.run('each character whose case differs costs 0.000001, and nothing more', 0.2, function () {
  const base = p('Relay', 'Relay box');
  const one = base - p('relay', 'Relay box');
  const two = base - p('reLay', 'Relay box');
  return (Math.abs(one - 0.000001) < 1e-12 && Math.abs(two - 0.000002) < 1e-12) || 'one miss costs ' + one + ', two ' + two;
}, test.limit.quick);
test.run('a case miss alone keeps an exact match all but 1.0, never above another match', 0.2, function () {
  const a = p('relay', 'Relay');
  return (a < 1 && Math.abs(1 - a - 0.000001) < 1e-12) || 'got ' + a;
}, test.limit.quick);

// ── goal/G41.28: the shorter token first ──
test.run('a typed word longer than the label\'s word still counts by the part they share', 0.2, function () {
  const a = p('relays ab', 'relay ab cdef');
  const b = p('relays ab', 'zzzzz ab cdef');
  return a > b || 'sharing "relay" ' + a + ', sharing nothing ' + b;
}, test.limit.quick);
test.run('a whole word beats a part of one', 0.2, function () {
  const a = p('relay ab', 'relay ab cdef');
  const b = p('relays ab', 'relay ab cdef');
  return a > b || 'whole ' + a + ', part ' + b;
}, test.limit.quick);
test.run('the module answers probabilityStringMatch alone', 0.2, function () {
  return short(Object.keys(M)) === short(['probabilityStringMatch']) || 'exports ' + short(Object.keys(M));
}, test.limit.quick);
test.run('in a page alike (goal/G27.14): loaded as a plain script, it is found on window.spirit.probability, and its names stay its own', 0.2, function () {
  const win = { spirit: { probability: { other: 1 } } };
  const ctx = { window: win };
  vm.runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'probabilityStringMatch.js'), 'utf8'), ctx);
  const f = win.spirit.probability.probabilityStringMatch;
  if (typeof f !== 'function') return 'window.spirit.probability holds ' + short(Object.keys(win.spirit.probability));
  const leaked = Object.keys(ctx).filter(function (k) { return k !== 'window'; });
  return (win.spirit.probability.other === 1 && leaked.length === 0) || 'kept other: ' + win.spirit.probability.other + ', leaked ' + short(leaked);
}, test.limit.quick);
