'use strict';

// spirit/run/spirit/search/test/string.js
// The tests of spirit/search/string.js, and of no other module (spec: ./probabilityStringMatch.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// probabilityStringMatch(A, B): how likely two strings mean the same thing, as a number from 0 to 1 (goal/G18.2), with
// distance and case added by goal/G29.1 and the shorter token first by goal/G41.28. Pure: two strings in, one number out.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const M = require(path.join(RUN, 'spirit', 'search', 'string.js'));
const p = M.probabilityStringMatch;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function inRange(x) { return typeof x === 'number' && x >= 0 && x <= 1; }

// ── Andy's item, goal/G18.2 ──
test.run('A or B not a string gives 0.0', 0.2, function () {
  const got = [p(1, '1'), p('1', 1), p(null, 'a'), p('a', undefined), p({}, '[object Object]'), p(['a'], 'a')];
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);
test.run('A exactly equal to B gives 1.0', 0.2, function () {
  const got = [p('relay', 'relay'), p('Relay Box', 'Relay Box'), p('*?', '*?'), p('', '')];
  return got.every(function (x) { return x === 1; }) || false;
}, test.limit.quick);
test.run('an empty string against a non-empty one gives 0', 0.2, function () {
  const got = [p('', 'x'), p('x', ''), p('', 'relay server')];
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);
test.run('A and B swapped give the same probability, no matter which one is the search string', 0.2, function () {
  const pairs = [['relay', 'relay server'], ['desk', 'desk server'], ['alpha beta', 'beta alpha gamma'], ['reLay', 'Relay box'], ['café', 'my cafe']];
  const bad = pairs.filter(function (x) { return p(x[0], x[1]) !== p(x[1], x[0]); });
  return bad.length === 0 || false;
}, test.limit.quick);
test.run('every answer is a number from 0 to 1', 0.2, function () {
  const pairs = [['relay', 'relay server'], ['a b', 'b a'], ['x', 'xxxxxxxxxxxxxxxxxxxxxxxxxxx'], ['one two three', 'one'], ['abc', 'abd'], ['Ü', 'u']];
  const bad = pairs.filter(function (x) { return !inRange(p(x[0], x[1])); });
  return bad.length === 0 || false;
}, test.limit.quick);
test.run('strings that share nothing give 0', 0.2, function () {
  const got = [p('relay', 'xyz'), p('abc', 'abd'), p('ab', 'ba')];
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);

// ── how good a match is ──
test.run('a text that starts with the search string beats one that has it somewhere later', 0.2, function () {
  const a = p('relay', 'relay server');
  const b = p('relay', 'my relay ser');
  return (a > b && b > 0) || false;
}, test.limit.quick);
test.run('a search string found whole beats one of which only some of the words are found', 0.2, function () {
  const a = p('relay zz', 'my relay zz box');
  const b = p('relay zz', 'the relay box q');
  return (a > b && b > 0) || false;
}, test.limit.quick);
test.run('the closer the lengths, the higher the match, so a word in a short text beats it in a long one', 0.2, function () {
  const a = p('relay', 'relay box');
  const b = p('relay', 'relay box with a very long label after it');
  return (a > b && b > 0) || false;
}, test.limit.quick);
test.run('there are no wildcards, so * and ? are characters like any other', 0.2, function () {
  const got = [p('*', 'abc'), p('a*', 'abc'), p('a?', 'abc'), p('*', 'a*c'), p('a?', 'xa?')];
  return (got[0] === 0 && got[1] === 0 && got[2] === 0 && got[3] > 0 && got[4] > 0) || false;
}, test.limit.quick);
test.run('accents fold both ways: ü matches u and é matches e', 0.2, function () {
  const got = [p('ü', 'u'), p('u', 'ü'), p('café', 'cafe'), p('cafe', 'café')];
  return got.every(function (x) { return x === 1; }) || false;
}, test.limit.quick);

// ── goal/G29.1: distance counts, and more than order ──
test.run('words side by side beat the same words far apart', 0.2, function () {
  const a = p('alpha beta', 'alpha beta gamma');
  const b = p('alpha beta', 'alpha x x x x x x x x x x beta');
  return a > b || false;
}, test.limit.quick);
test.run('words in the order typed beat the same words swapped', 0.2, function () {
  const a = p('one two', 'one two x');
  const b = p('one two', 'two one x');
  return a > b || false;
}, test.limit.quick);
test.run('distance weighs more than order: words adjacent and swapped beat words in order with a word between, labels of one length', 0.2, function () {
  const a = p('alpha beta', 'beta alpha zz');
  const b = p('alpha beta', 'alpha zz beta');
  return a > b || false;
}, test.limit.quick);

// ── goal/G29.1: case counts, by a hair ──
test.run('case counts, so "Relay" matches "Relay box" better than "relay" does, and "relay" better than "reLay"', 0.2, function () {
  const got = [p('Relay', 'Relay box'), p('relay', 'Relay box'), p('reLay', 'Relay box')];
  return (got[0] > got[1] && got[1] > got[2]) || false;
}, test.limit.quick);
test.run('each character whose case differs costs 0.000001, and nothing more', 0.2, function () {
  const base = p('Relay', 'Relay box');
  const one = base - p('relay', 'Relay box');
  const two = base - p('reLay', 'Relay box');
  return (Math.abs(one - 0.000001) < 1e-12 && Math.abs(two - 0.000002) < 1e-12) || false;
}, test.limit.quick);
test.run('a case miss alone keeps an exact match all but 1.0, never above another match', 0.2, function () {
  const a = p('relay', 'Relay');
  return (a < 1 && Math.abs(1 - a - 0.000001) < 1e-12) || false;
}, test.limit.quick);

// ── goal/G41.28: the shorter token first ──
test.run('a typed word longer than the label\'s word still counts by the part they share', 0.2, function () {
  const a = p('relays ab', 'relay ab cdef');
  const b = p('relays ab', 'zzzzz ab cdef');
  return a > b || false;
}, test.limit.quick);
test.run('a whole word beats a part of one', 0.2, function () {
  const a = p('relay ab', 'relay ab cdef');
  const b = p('relays ab', 'relay ab cdef');
  return a > b || false;
}, test.limit.quick);
test.run('the module answers probabilityStringMatch alone', 0.2, function () {
  return short(Object.keys(M)) === short(['probabilityStringMatch']) || false;
}, test.limit.quick);
test.run('loaded in a page as a plain script, it stands at spirit.required.spirit.search.string, and it keeps its names to itself', 0.2, function () {
  const win = { spirit: { required: { spirit: { other: 1 } } } };
  const ctx = { window: win };
  vm.runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'search', 'string.js'), 'utf8'), ctx);
  const f = win.spirit.required.spirit.search.string.probabilityStringMatch;
  if (typeof f !== 'function') return false;
  const leaked = Object.keys(ctx).filter(function (k) { return k !== 'window'; });
  return (win.spirit.required.spirit.other === 1 && leaked.length === 0) || false;
}, test.limit.quick);
