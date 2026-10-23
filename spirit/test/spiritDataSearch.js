'use strict';

// spirit/test/spiritDataSearch.js
// goal/G33.7 (box v9): searchDataSet. Andy's box: "a cache-only search in the component that keeps the data set
// (spirit.data), so it serves the page and every server alike. It asks nobody and ranks by probability across every
// table it holds, returning the most relevant rows whatever table they are in, bounded like every search."
//
// WHAT IS ASSERTED, by outcome:
//   1. spirit.data answers search({ text }) with the rows of every branch it holds, ranked by probability (the desk's
//      own ranking, probabilityStringObjectMatch into a probabilityBucket), the most relevant first whatever branch they
//      are in; each item names its branch and key ('<branch>/<key>') and carries the row as JSON.
//   2. branches narrows it to the branches named.
//   3. The answer is bounded like every search: under one answer (appClient.ANSWER_MAX) however many rows match, with
//      more: true when not all fit.
//   4. It asks nobody: the search runs with no transport at all, and the data set is unchanged by it.
// rule/11: through testSupport only; no server, no port.

const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

test.startTest('goal/G33.7: searchDataSet, a cache-only search across every branch of spirit.data');
// No transport of any kind: any ask would have to go through one of these, and there are none.
delete globalThis.fetch;
const D = require('../run/shell/js/spiritData.js');

const OWED = 'OWED by goal/G33.7 (searchDataSet): ';
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// THE DATA SET: three branches, the best match for "walrus harbour" in the middle one, a near match in another, and a
// great many rows that do not match, so the answer cannot hold them all.
D.set('deskItems/goal/G1.1', { id: 'goal/G1.1', title: 'Paint the fence', status: '' });
D.set('deskItems/goal/G1.2', { id: 'goal/G1.2', title: 'The walrus in the bay', status: '' });
D.set('contacts/key-one', { name: 'Walrus Harbour Inc', nick: 'walrus' });
D.set('contacts/key-two', { name: 'Someone Else', nick: 'else' });
D.set('files/docs/walrus.txt', { kind: 'file', size: 10 });
for (let i = 0; i < 400; i++) D.set('deskItem/goal/G2.' + i, { box: 'unrelated text number ' + i + ' padding padding padding padding padding padding', version: 1 });
const before = JSON.stringify(D.data);

test.subHeading('1. ranked across every branch, the most relevant first');
const has = typeof D.search === 'function';
const r1 = has ? D.search({ text: 'walrus harbour' }) : null;
const keys1 = r1 && Array.isArray(r1.items) ? r1.items.map(function (x) { return x.key; }) : [];
if (has && keys1[0] === 'contacts/key-one' && keys1.indexOf('deskItems/goal/G1.2') !== -1 && keys1.indexOf('deskItems/goal/G1.2') < keys1.indexOf('deskItem/goal/G2.0') &&
  JSON.parse(r1.items[0].label).name === 'Walrus Harbour Inc') test.check('"walrus harbour" answered the contact first, then the walrus item, ahead of the rows that do not match: ' + short(keys1.slice(0, 4)));
else test.fail(OWED + 'spirit.data.search ' + (has ? 'answered ' + short(keys1.slice(0, 6)) : 'does not exist'));

test.subHeading('2. branches narrows it');
const r2 = has ? D.search({ text: 'walrus', branches: ['deskItems'] }) : null;
const keys2 = r2 && Array.isArray(r2.items) ? r2.items.map(function (x) { return x.key; }) : [];
if (has && keys2.length && keys2.every(function (k) { return k.indexOf('deskItems/') === 0; }) && keys2[0] === 'deskItems/goal/G1.2') test.check('branches: ["deskItems"] answered only deskItems rows, the walrus item first');
else test.fail(OWED + 'search in deskItems answered ' + short(keys2));

test.subHeading('3. bounded like every search');
const r3 = has ? D.search({ text: 'unrelated' }) : null;
const bytes3 = r3 ? Buffer.byteLength(JSON.stringify({ items: r3.items, more: r3.more }), 'utf8') : -1;
if (has && r3 && r3.items.length > 0 && r3.items.length < 405 && r3.more === true && bytes3 <= appClient.ANSWER_MAX) test.check('405 rows held, ' + r3.items.length + ' answered in ' + bytes3 + ' bytes, under ' + appClient.ANSWER_MAX + ', with more');
else test.fail(OWED + 'a search over 405 rows answered ' + (r3 ? r3.items.length + ' rows, ' + bytes3 + ' bytes, more ' + r3.more : 'nothing'));

test.subHeading('4. it asks nobody, and changes nothing');
if (has && JSON.stringify(D.data) === before) test.check('three searches with no transport at all answered from the data set alone, which they left as it was');
else test.fail(OWED + (has ? 'the data set changed under the searches' : 'no search to run'));

test.reportSuccessFailureCount();
