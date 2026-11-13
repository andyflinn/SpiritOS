'use strict';

// spirit/run/spirit/test/probabilityBucket.js
// The tests of spirit/probabilityBucket.js, and of no other module (spec: ./probabilityBucket.md). Its own test, owed
// since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// createProbabilityBucket(capacity): the best objects by probability, seated as they come and serialized to a byte
// ceiling (goal/G18.4). Pure: no I/O, no clock, so every test makes its own bucket in process.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const B = require(path.join(RUN, 'spirit', 'probabilityBucket.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function names(bucket) { return bucket.serialize().items.map(function (o) { return o.n; }); }

// ── seatFor: highest at the top ──
test.run('seatFor sorts by probability, highest first, whatever order they come in', 0.2, function () {
  const b = B.createProbabilityBucket(10);
  [[0.3, 'c'], [0.9, 'a'], [0.5, 'b'], [0.1, 'd']].forEach(function (x) { b.seatFor(x[0], { n: x[1] }); });
  return short(names(b)) === short(['a', 'b', 'c', 'd']) || 'order ' + short(names(b));
}, test.limit.quick);
test.run('an equal probability is seated behind those already in', 0.2, function () {
  const b = B.createProbabilityBucket(10);
  b.seatFor(0.5, { n: 'first' }); b.seatFor(0.5, { n: 'second' }); b.seatFor(0.5, { n: 'third' });
  return short(names(b)) === short(['first', 'second', 'third']) || 'order ' + short(names(b));
}, test.limit.quick);
test.run('the bucket fills with objects of probability 0 until higher ones push them out (Andy, 2026-10-12)', 0.2, function () {
  const b = B.createProbabilityBucket(2);
  const seated = [b.seatFor(0, { n: 'z1' }), b.seatFor(0, { n: 'z2' })];
  const pushed = b.seatFor(0.4, { n: 'hi' });
  return (seated[0] && seated[1] && pushed && short(names(b)) === short(['hi', 'z1'])) || 'seated ' + short(seated) + ', pushed ' + pushed + ', held ' + short(names(b));
}, test.limit.quick);
test.run('full, a lower or equal probability is turned away and answers false; a higher one takes the lowest seat', 0.2, function () {
  const b = B.createProbabilityBucket(2);
  b.seatFor(0.6, { n: 'a' }); b.seatFor(0.4, { n: 'b' });
  const got = [b.seatFor(0.4, { n: 'equal' }), b.seatFor(0.2, { n: 'lower' }), b.seatFor(0.5, { n: 'higher' })];
  return (short(got) === short([false, false, true]) && short(names(b)) === short(['a', 'higher'])) || 'answers ' + short(got) + ', held ' + short(names(b));
}, test.limit.quick);
test.run('a probability that is no number from 0 to 1 gets no seat', 0.2, function () {
  const b = B.createProbabilityBucket(10);
  const got = [-0.1, 1.1, NaN, '0.5', null, undefined].map(function (p) { return b.seatFor(p, { n: 'x' }); });
  return (got.every(function (x) { return x === false; }) && names(b).length === 0) || 'answers ' + short(got) + ', held ' + short(names(b));
}, test.limit.quick);
test.run('a bucket of no capacity (0, negative, not a number) seats nothing', 0.2, function () {
  const got = [0, -3, 'ten', undefined].map(function (c) { return B.createProbabilityBucket(c).seatFor(1, { n: 'x' }); });
  return got.every(function (x) { return x === false; }) || 'answers ' + short(got);
}, test.limit.quick);
test.run('the bucket holds objects as they are and knows nothing of strings: any object is seated', 0.2, function () {
  const b = B.createProbabilityBucket(3);
  const o = { deep: { a: [1, 2] } };
  b.seatFor(0.7, o); b.seatFor(0.6, 42); b.seatFor(0.5, 'text');
  const items = b.serialize().items;
  return (items[0] === o && items[1] === 42 && items[2] === 'text') || 'items ' + short(items);
}, test.limit.quick);

// ── serialize: the objects alone, measured in bytes ──
test.run('serialize gives only the object portion, never the probability', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.8, { n: 'a' });
  const s = b.serialize();
  return (short(s.items) === short([{ n: 'a' }]) && JSON.stringify(s).indexOf('0.8') === -1) || 'serialized ' + short(s);
}, test.limit.quick);
test.run('serialize runs each object through map', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.8, { n: 'a', big: 'x'.repeat(50) }); b.seatFor(0.4, { n: 'b', big: 'y' });
  const s = b.serialize(function (o) { return o.n; });
  return short(s.items) === short(['a', 'b']) || 'items ' + short(s.items);
}, test.limit.quick);
test.run('bytes is the UTF-8 byte length of the items as JSON, never their character count (Andy, 2026-10-10)', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, 'üüü');
  const s = b.serialize();
  return s.bytes === Buffer.byteLength(JSON.stringify(s.items), 'utf8') && s.bytes === 10 || 'bytes ' + s.bytes;
}, test.limit.quick);
test.run('with maxBytes, the items as JSON never exceed it, and stop at the first that will not fit, never skipping it for a smaller one', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, 'aaaa'); b.seatFor(0.8, 'bbbbbbbbbbbbbbbbbbbb'); b.seatFor(0.7, 'c');
  const s = b.serialize(null, 20);
  return (short(s.items) === short(['aaaa']) && s.bytes <= 20 && s.truncated === true && s.more === true) || 'serialized ' + short(s);
}, test.limit.quick);
test.run('the ceiling is in bytes: multibyte text is cut where its bytes overrun, not its characters', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, 'ééééé'); b.seatFor(0.8, 'éé');
  // ["ééééé"] is 14 bytes (9 characters); ["ééééé","éé"] is 21 bytes (14 characters)
  const s = b.serialize(null, 16);
  return (short(s.items) === short(['ééééé']) && s.truncated === true) || 'serialized ' + short(s);
}, test.limit.quick);
test.run('maxBytes left out or 0 is unbounded (goal/G27.14, Andy: "0 means unbounded")', 0.2, function () {
  const b = B.createProbabilityBucket(Infinity);
  for (let i = 0; i < 200; i += 1) b.seatFor(i / 200, 'item ' + i + ' ' + 'x'.repeat(100));
  const s = [b.serialize(), b.serialize(null, 0)];
  return (s[0].items.length === 200 && s[1].items.length === 200 && s[0].truncated === false && s[0].more === false) || 'lengths ' + short([s[0].items.length, s[1].items.length]);
}, test.limit.quick);
test.run('more says something was turned away even when nothing was cut; truncated stays false', 0.2, function () {
  const b = B.createProbabilityBucket(1);
  b.seatFor(0.5, 'a'); b.seatFor(0.2, 'b');
  const s = b.serialize();
  return (s.more === true && s.truncated === false && s.items.length === 1) || 'serialized ' + short(s);
}, test.limit.quick);
test.run('one pushed out by a higher one counts as turned away', 0.2, function () {
  const b = B.createProbabilityBucket(1);
  b.seatFor(0.2, 'a'); b.seatFor(0.5, 'b');
  const s = b.serialize();
  return (s.more === true && short(s.items) === short(['b'])) || 'serialized ' + short(s);
}, test.limit.quick);

// ── sort: the caller's function gives new probabilities ──
test.run('sort re-scores every held object through compare, highest first', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, { n: 'a', v: 0.1 }); b.seatFor(0.5, { n: 'b', v: 0.8 }); b.seatFor(0.1, { n: 'c', v: 0.4 });
  b.sort(function (o) { return o.v; });
  return short(names(b)) === short(['b', 'c', 'a']) || 'order ' + short(names(b));
}, test.limit.quick);
test.run('sort keeps the place of equal ones', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, { n: 'a' }); b.seatFor(0.5, { n: 'b' }); b.seatFor(0.1, { n: 'c' });
  b.sort(function () { return 0.3; });
  return short(names(b)) === short(['a', 'b', 'c']) || 'order ' + short(names(b));
}, test.limit.quick);
test.run('one scored outside 0 to 1 stays held, out of serialize, until a later sort scores it again', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, { n: 'a', v: 0.5 }); b.seatFor(0.5, { n: 'b', v: 'no' });
  b.sort(function (o) { return o.v; });
  const out = names(b);
  b.sort(function () { return 0.5; });
  const back = names(b);
  return (short(out) === short(['a']) && short(back) === short(['a', 'b'])) || 'after a bad score ' + short(out) + ', scored again ' + short(back);
}, test.limit.quick);
test.run('sort with no function changes nothing', 0.2, function () {
  const b = B.createProbabilityBucket(5);
  b.seatFor(0.9, { n: 'a' }); b.seatFor(0.5, { n: 'b' });
  b.sort('not a function');
  return short(names(b)) === short(['a', 'b']) || 'order ' + short(names(b));
}, test.limit.quick);
test.run('the module answers createProbabilityBucket alone', 0.2, function () {
  return short(Object.keys(B)) === short(['createProbabilityBucket']) || 'exports ' + short(Object.keys(B));
}, test.limit.quick);
test.run('in a page alike (goal/G27.14): loaded as a plain script, it is found on window.spirit.probability, and its names stay its own', 0.2, function () {
  const win = { spirit: { probability: { other: 1 } } };
  const ctx = { window: win };
  vm.runInNewContext(fs.readFileSync(path.join(RUN, 'spirit', 'probabilityBucket.js'), 'utf8'), ctx);
  const f = win.spirit.probability.createProbabilityBucket;
  if (typeof f !== 'function') return 'window.spirit.probability holds ' + short(Object.keys(win.spirit.probability));
  const leaked = Object.keys(ctx).filter(function (k) { return k !== 'window'; });
  return (win.spirit.probability.other === 1 && leaked.length === 0) || 'kept other: ' + win.spirit.probability.other + ', leaked ' + short(leaked);
}, test.limit.quick);
