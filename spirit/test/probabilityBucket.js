'use strict';

// spirit/test/probabilityBucket.js
// goal/G18.4: probabilityBucket, the third probabilit* module. Red on today's tree (6a4f7aa9); claude-windows wrote it
// and builds it. The item's box (v7), Andy, 2026-10-12:
//   "... 1. function createProbabilityBucket(capacity) 2. seatFor(probability, item)"; "objecs are
//   simply dropped into the the probabilityBucket with their probability, and probabilityBucket sorts that into it's
//   table all by itself."; "The Bucket knows NOTHING about string matching, it will only know how to sort-add objects
//   by probability. internally its table carries objects like this: { probability, object } the serialize will only
//   serialize and measure the object portion of its array-entries."; "the bucket fills up with objects of probability
//   0, until those objects are pushed out by higher-probability objects."; "the ONLY job of probabilityBucket is
//   inserting by highest-probability at the top, and limiting the serialized object, this way the bucket needs no
//   compare-callback, nothing."
//
// WHAT IS ASSERTED
//   1. run/js/probabilityBucket.js exports createProbabilityBucket(capacity), answering seatFor and serialize and
//      nothing else; it requires nothing of string matching.
//   2. seatFor seats by probability, highest at the top, an equal one behind those already in; 0 is seated; full, a
//      lower one is turned away and a higher one pushes the lowest out; it answers whether it got a seat.
//   3. a probability not a number, or outside 0 to 1, gets no seat; a capacity of 0 seats nothing.
//   4. serialize(map, maxBytes): the objects alone, best first, through map, cut at the byte ceiling; more when
//      something was turned away or cut, truncated when cut.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G18.4: ';
const MODULE = path.join(__dirname, '..', 'run', 'spirit', 'probabilityBucket.js');

test.startTest('goal/G18.4: probabilityBucket, seated by probability, serialized to a ceiling');

let mod = null;
try { mod = require(MODULE); } catch (e) { mod = null; }
const create = mod && mod.createProbabilityBucket;

test.subHeading('1. the module');
if (typeof create === 'function') test.check('run/js/probabilityBucket.js exports createProbabilityBucket(capacity)');
else { test.fail(OWED + 'no run/js/probabilityBucket.js exporting createProbabilityBucket'); test.reportSuccessFailureCount(); process.exit(0); }
const b0 = create(3);
const keys = Object.keys(b0).sort();
// sort added under goal/G27.14 (Andy, 2026-10-17: "SORT(probability = compareFunction())"): the probability still
// comes from the caller's function, so the bucket still knows nothing of string matching.
if (JSON.stringify(keys) === JSON.stringify(['seatFor', 'serialize', 'sort'])) test.check('a bucket answers seatFor, serialize and sort, nothing else');
else test.fail(OWED + 'a bucket answers ' + keys.join(', '));
const src = fs.readFileSync(MODULE, 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
if (!/require\(/.test(src)) test.check('it requires nothing: no string matching, no compare');
else test.fail(OWED + 'it requires ' + (src.match(/require\([^)]*\)/g) || []).join(', '));

test.subHeading('2. seated by probability');
const b = create(3);
const r1 = b.seatFor(0.5, { id: 'mid' });
const r2 = b.seatFor(0.9, { id: 'high' });
const r3 = b.seatFor(0.5, { id: 'mid2' });
const ids = function (bucket) { return bucket.serialize().items.map(function (o) { return o.id; }); };
if (r1 && r2 && r3 && JSON.stringify(ids(b)) === JSON.stringify(['high', 'mid', 'mid2'])) test.check('highest at the top, an equal one behind those already in: high, mid, mid2');
else test.fail(OWED + 'order ' + JSON.stringify(ids(b)) + ', seats ' + JSON.stringify([r1, r2, r3]));
const low = b.seatFor(0.1, { id: 'low' });
if (low === false && JSON.stringify(ids(b)) === JSON.stringify(['high', 'mid', 'mid2'])) test.check('full, a lower one is turned away and answers false');
else test.fail(OWED + 'a lower one into a full bucket: ' + low + ', ' + JSON.stringify(ids(b)));
const top = b.seatFor(0.95, { id: 'top' });
if (top === true && JSON.stringify(ids(b)) === JSON.stringify(['top', 'high', 'mid'])) test.check('a higher one pushes the lowest out (the later of the two equal) and answers true');
else test.fail(OWED + 'a higher one into a full bucket: ' + top + ', ' + JSON.stringify(ids(b)));
const z = create(2);
z.seatFor(0, { id: 'z1' });
z.seatFor(0, { id: 'z2' });
const zFull = ids(z);
z.seatFor(0.2, { id: 'some' });
if (JSON.stringify(zFull) === JSON.stringify(['z1', 'z2']) && JSON.stringify(ids(z)) === JSON.stringify(['some', 'z1'])) test.check('0 is seated until a higher one pushes it out');
else test.fail(OWED + 'zeros: ' + JSON.stringify(zFull) + ' then ' + JSON.stringify(ids(z)));

test.subHeading('3. no seat for what is not a probability, and none in a bucket of 0');
const bad = create(5);
const refused = [NaN, '0.5', -0.1, 1.1, undefined, null, Infinity].map(function (p) { return bad.seatFor(p, { id: String(p) }); });
if (refused.every(function (x) { return x === false; }) && bad.serialize().items.length === 0) test.check('not a number, or outside 0 to 1: no seat');
else test.fail(OWED + 'answers ' + JSON.stringify(refused) + ', held ' + JSON.stringify(bad.serialize().items));
const none = create(0);
if (none.seatFor(1, { id: 'x' }) === false && none.serialize().items.length === 0 && none.serialize().more === true) test.check('a capacity of 0 seats nothing and says more');
else test.fail(OWED + 'capacity 0: ' + JSON.stringify(none.serialize()));

test.subHeading('4. serialize: the objects alone, best first, to a ceiling');
const s = create(10);
for (let i = 0; i < 10; i++) s.seatFor(i / 10, { id: 'o' + i, pad: 'xxxxxxxxxx' });
const all = s.serialize();
if (all.items.length === 10 && all.items[0].id === 'o9' && all.items[9].id === 'o0' && all.items.every(function (o) { return !('probability' in o) && !('object' in o); }) && all.more === false && all.truncated === false) test.check('the objects alone, without their probability, best first; nothing turned away, nothing cut');
else test.fail(OWED + 'serialize() answered ' + JSON.stringify(all).slice(0, 300));
const mapped = s.serialize(function (o) { return o.id; });
if (JSON.stringify(mapped.items.slice(0, 3)) === JSON.stringify(['o9', 'o8', 'o7'])) test.check('through map, each object turned into what goes on the wire');
else test.fail(OWED + 'mapped ' + JSON.stringify(mapped.items));
const cut = s.serialize(null, 100);
if (cut.truncated === true && cut.more === true && cut.bytes <= 100 && cut.items.length > 0 && cut.items.length < 10 && cut.items[0].id === 'o9') test.check('cut at the byte ceiling, best first: ' + cut.items.length + ' objects in ' + cut.bytes + ' bytes, truncated and more');
else test.fail(OWED + 'with a 100-byte ceiling: ' + JSON.stringify(cut).slice(0, 300));

test.reportSuccessFailureCount();
process.exit(0);
