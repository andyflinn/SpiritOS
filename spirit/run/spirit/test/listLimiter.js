'use strict';

// spirit/run/spirit/test/listLimiter.js
// The tests of spirit/listLimiter.js, and of no other module (spec: ./probabilityBucket.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// createProbabilityBucket(capacity): the best objects by probability, seated as they come and serialized to a byte
// ceiling (goal/G18.4). Pure: no I/O, no clock, so every test makes its own bucket in process.
// ITS ONE LIMIT IS BYTES (goal/G49.8, point 1, box v12; Andy: "Disregard the seatlimit, because its DUMB", "the only thing
// that counts is the byte-limit of the bucket", "NOTHING ELSE NEEDS TO CHANGE"): capacity is a byte limit, the same one
// serialize measures, kept as objects are seated; past it the lowest go at once, and seatFor names what it pushed out.
// Sizes below are the objects' JSON in an array: ["a"] is 5 bytes, [{"n":"a"}] is 11.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const B = S.requireScript('spirit/listLimiter.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function names(bucket) { return bucket.serialize().items.map(function (o) { return o.n; }); }

// ── seatFor: highest at the top ──
test.run('seatFor sorts by probability, highest first, whatever order they come in', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  [[0.3, 'c'], [0.9, 'a'], [0.5, 'b'], [0.1, 'd']].forEach(function (x) { b.seatFor(x[0], { n: x[1] }); });
  return short(names(b)) === short(['a', 'b', 'c', 'd']) || false;
}, test.limit.quick);
test.run('an equal probability is seated behind those already in', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.5, { n: 'first' }); b.seatFor(0.5, { n: 'second' }); b.seatFor(0.5, { n: 'third' });
  return short(names(b)) === short(['first', 'second', 'third']) || false;
}, test.limit.quick);
test.run('the bucket fills with objects of probability 0 until higher ones push them out of its bytes', 0.2, function () {
  // [{"n":"z1"},{"n":"z2"}] is 23 bytes: both fit; a third of any probability does not.
  const b = B.createProbabilityBucket(23);
  b.seatFor(0, { n: 'z1' }); b.seatFor(0, { n: 'z2' });
  const both = short(names(b)) === short(['z1', 'z2']);
  b.seatFor(0.4, { n: 'hi' });
  // Of the two of the lowest probability, the longest held goes ("shedding: the longest held seat").
  return (both && short(names(b)) === short(['hi', 'z2'])) || false;
}, test.limit.quick);
test.run('full, a lower probability is turned away; a higher one takes the room of the lowest', 0.2, function () {
  // [{"n":"a"},{"n":"b"}] is 21 bytes, [{"n":"a"},{"n":"higher"}] 26: the limit holds the second, never three.
  const b = B.createProbabilityBucket(26);
  b.seatFor(0.6, { n: 'a' }); b.seatFor(0.4, { n: 'b' });
  b.seatFor(0.2, { n: 'lower' }); b.seatFor(0.5, { n: 'higher' });
  return short(names(b)) === short(['a', 'higher']) || false;
}, test.limit.quick);
// THE LONGEST HELD GOES (goal/G49.8, point 1; Andy: "for the bucket, the default is: arrival sequence.", "default arrival
// sequence, shedding: the longest held seat"): among equal probabilities, full, the one seated first goes and the newcomer
// is kept, so a branch that gives every row the same probability keeps its newest.
test.run('full, a newcomer of equal probability takes the room of the longest held of them', 0.2, function () {
  // [{"n":"a"},{"n":"b"}] is 21 bytes: a third of 9 does not fit.
  const b = B.createProbabilityBucket(21);
  b.seatFor(0.5, { n: 'a' }); b.seatFor(0.5, { n: 'b' }); b.seatFor(0.5, { n: 'c' });
  return short(names(b)) === short(['b', 'c']) || false;
}, test.limit.quick);
test.run('all of one probability, the bucket keeps the newest that fit, in arrival order', 0.2, function () {
  // Each ["n"] item is 5 bytes alone; ten of them in turn, a limit of 13 holds the last three: ["7","8","9"] is 13.
  const b = B.createProbabilityBucket(13);
  for (let i = 0; i < 10; i += 1) b.seatFor(1, String(i));
  return short(b.serialize().items) === short(['7', '8', '9']) || false;
}, test.limit.quick);
test.run('its one limit is bytes: past it the lowest go at once, however few the objects', 0.2, function () {
  // ["xxxxxxxxxx","xxxxxxxxxx"] is 27 bytes; a third makes 40.
  const b = B.createProbabilityBucket(30);
  b.seatFor(0.9, 'x'.repeat(10)); b.seatFor(0.1, 'z'.repeat(10)); b.seatFor(0.5, 'y'.repeat(10));
  return short(b.serialize().items) === short(['x'.repeat(10), 'y'.repeat(10)]) || false;
}, test.limit.quick);
test.run('what it holds always fits its byte limit, so serialize at that limit cuts nothing', 0.2, function () {
  const b = B.createProbabilityBucket(30);
  [0.3, 0.9, 0.1, 0.7, 0.5, 0.8, 0.2, 0.6, 0.4, 0.05].forEach(function (p, i) { b.seatFor(p, 'item' + i); });
  const s = b.serialize(null, 30);
  return (s.items.length > 0 && s.truncated === false && s.bytes <= 30) || false;
}, test.limit.quick);
test.run('seatFor names the objects it pushed out', 0.2, function () {
  // ["aaaa"] is 8 bytes: a higher "bbbb" takes its room.
  const b = B.createProbabilityBucket(8);
  b.seatFor(0.2, 'aaaa');
  const answer = b.seatFor(0.5, 'bbbb');
  return (short(b.serialize().items) === short(['bbbb']) && JSON.stringify(answer).indexOf('"aaaa"') !== -1) || false;
}, test.limit.quick);
test.run('a probability that is no number from 0 to 1 gets no seat', 0.2, function () {
  const b = B.createProbabilityBucket(10);
  [-0.1, 1.1, NaN, '0.5', null, undefined].forEach(function (p) { b.seatFor(p, { n: 'x' }); });
  return names(b).length === 0 || false;
}, test.limit.quick);
test.run('a bucket of no capacity (0, negative, not a number) seats nothing', 0.2, function () {
  const got = [0, -3, 'ten', undefined].map(function (c) { const b = B.createProbabilityBucket(c); b.seatFor(1, { n: 'x' }); return b.serialize().items.length; });
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);
test.run('the bucket holds objects as they are and knows nothing of strings: any object is seated', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  const o = { deep: { a: [1, 2] } };
  b.seatFor(0.7, o); b.seatFor(0.6, 42); b.seatFor(0.5, 'text');
  const items = b.serialize().items;
  return (items[0] === o && items[1] === 42 && items[2] === 'text') || false;
}, test.limit.quick);

// ── serialize: the objects alone, measured in bytes ──
test.run('serialize gives only the object portion, never the probability', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.8, { n: 'a' });
  const s = b.serialize();
  return (short(s.items) === short([{ n: 'a' }]) && JSON.stringify(s).indexOf('0.8') === -1) || false;
}, test.limit.quick);
test.run('serialize runs each object through map', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.8, { n: 'a', big: 'x'.repeat(50) }); b.seatFor(0.4, { n: 'b', big: 'y' });
  const s = b.serialize(function (o) { return o.n; });
  return short(s.items) === short(['a', 'b']) || false;
}, test.limit.quick);
test.run('bytes is the UTF-8 byte length of the items as JSON, never their character count', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, 'üüü');
  const s = b.serialize();
  return s.bytes === Buffer.byteLength(JSON.stringify(s.items), 'utf8') && s.bytes === 10 || false;
}, test.limit.quick);
test.run('with maxBytes, the items as JSON never exceed it, and stop at the first that will not fit, never skipping it for a smaller one', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, 'aaaa'); b.seatFor(0.8, 'bbbbbbbbbbbbbbbbbbbb'); b.seatFor(0.7, 'c');
  const s = b.serialize(null, 20);
  return (short(s.items) === short(['aaaa']) && s.bytes <= 20 && s.truncated === true && s.more === true) || false;
}, test.limit.quick);
test.run('the ceiling is in bytes: multibyte text is cut where its bytes overrun, not its characters', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, 'ééééé'); b.seatFor(0.8, 'éé');
  // ["ééééé"] is 14 bytes (9 characters); ["ééééé","éé"] is 21 bytes (14 characters)
  const s = b.serialize(null, 16);
  return (short(s.items) === short(['ééééé']) && s.truncated === true) || false;
}, test.limit.quick);
test.run('maxBytes left out or 0 is unbounded', 0.2, function () {
  const b = B.createProbabilityBucket(Infinity);
  for (let i = 0; i < 200; i += 1) b.seatFor(i / 200, 'item ' + i + ' ' + 'x'.repeat(100));
  const s = [b.serialize(), b.serialize(null, 0)];
  return (s[0].items.length === 200 && s[1].items.length === 200 && s[0].truncated === false && s[0].more === false) || false;
}, test.limit.quick);
test.run('more says something was turned away even when nothing was cut; truncated stays false', 0.2, function () {
  // ["a"] is 5 bytes: "b" does not fit beside it.
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.5, 'a'); b.seatFor(0.2, 'b');
  const s = b.serialize();
  return (s.more === true && s.truncated === false && s.items.length === 1) || false;
}, test.limit.quick);
test.run('one pushed out by a higher one counts as turned away', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.2, 'a'); b.seatFor(0.5, 'b');
  const s = b.serialize();
  return (s.more === true && short(s.items) === short(['b'])) || false;
}, test.limit.quick);

// ── sort: the caller's function gives new probabilities ──
test.run('sort re-scores every held object through compare, highest first', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, { n: 'a', v: 0.1 }); b.seatFor(0.5, { n: 'b', v: 0.8 }); b.seatFor(0.1, { n: 'c', v: 0.4 });
  b.sort(function (o) { return o.v; });
  return short(names(b)) === short(['b', 'c', 'a']) || false;
}, test.limit.quick);
test.run('sort keeps the place of equal ones', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, { n: 'a' }); b.seatFor(0.5, { n: 'b' }); b.seatFor(0.1, { n: 'c' });
  b.sort(function () { return 0.3; });
  return short(names(b)) === short(['a', 'b', 'c']) || false;
}, test.limit.quick);
test.run('one scored outside 0 to 1 stays held, out of serialize, until a later sort scores it again', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, { n: 'a', v: 0.5 }); b.seatFor(0.5, { n: 'b', v: 'no' });
  b.sort(function (o) { return o.v; });
  const out = names(b);
  b.sort(function () { return 0.5; });
  const back = names(b);
  return (short(out) === short(['a']) && short(back) === short(['a', 'b'])) || false;
}, test.limit.quick);
test.run('sort with no function changes nothing', 0.2, function () {
  const b = B.createProbabilityBucket(1000);
  b.seatFor(0.9, { n: 'a' }); b.seatFor(0.5, { n: 'b' });
  b.sort('not a function');
  return short(names(b)) === short(['a', 'b']) || false;
}, test.limit.quick);
test.run('the module answers createProbabilityBucket alone', 0.2, function () {
  return short(Object.keys(B)) === short(['createProbabilityBucket']) || false;
}, test.limit.quick);
test.run('in a page too, loaded as a plain script, it stands at spirit.required.spirit.listLimiter, and its names stay its own', 0.2, function () {
  const win = { spirit: { required: { spirit: { other: 1 } } } };
  const ctx = { window: win };
  vm.runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'listLimiter.js'), 'utf8'), ctx);
  const f = win.spirit.required.spirit.listLimiter.createProbabilityBucket;
  if (typeof f !== 'function') return false;
  const leaked = Object.keys(ctx).filter(function (k) { return k !== 'window'; });
  return (win.spirit.required.spirit.other === 1 && leaked.length === 0) || false;
}, test.limit.quick);
