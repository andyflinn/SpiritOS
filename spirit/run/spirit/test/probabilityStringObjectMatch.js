'use strict';

// spirit/run/spirit/test/probabilityStringObjectMatch.js
// The tests of spirit/probabilityStringObjectMatch.js, and of no other module (spec: ./probabilityStringObjectMatch.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// probabilityStringObjectMatch(string, object): how likely a string is what an object holds (goal/G18.3), a weighted sum
// over every string the object holds, the shortest heaviest; measureObject, the one scan, with each string's path
// (goal/G43.6). Pure; the page half is loaded in a vm with a planted window.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js');
const O = require(FILE);
const p = O.probabilityStringObjectMatch;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function near(a, b) { return typeof a === 'number' && Math.abs(a - b) < 1e-9; }
function strings(table) { return table.map(function (r) { return r.objectString; }); }

// ── 1. the input ──
test.run('an empty string, or a string that is no string, gives 0', 0.2, function () {
  const got = [p('', { andy: 'andy' }), p(null, { andy: 'andy' }), p(5, { 5: 5 })];
  return got.every(function (x) { return x === 0; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('an object that is no plain object (null, an array, a string) gives 0', 0.2, function () {
  const got = [p('andy', null), p('andy', ['andy']), p('andy', 'andy'), p('andy', undefined)];
  return got.every(function (x) { return x === 0; }) || 'got ' + short(got);
}, test.limit.quick);
test.run('an object that holds no string gives 0', 0.2, function () {
  return p('andy', {}) === 0 || 'got ' + p('andy', {});
}, test.limit.quick);

// ── 2. measure the object ──
test.run('measureObject: every key and every string value, in the order met; keys are included, "this is supposed to be dumb"', 0.2, function () {
  return short(strings(O.measureObject({ name: 'Andy', city: 'Basel' }))) === short(['name', 'Andy', 'city', 'Basel']) || 'table ' + short(strings(O.measureObject({ name: 'Andy', city: 'Basel' })));
}, test.limit.quick);
test.run('measureObject: empty strings stay out of the table, as values and as keys', 0.2, function () {
  const t = strings(O.measureObject({ a: '', '': 'x' }));
  return (t.indexOf('') === -1 && short(t) === short(['a', 'x'])) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: nested objects are searched for strings', 0.2, function () {
  const t = strings(O.measureObject({ stats: { cpu: 'hot' } }));
  return short(t) === short(['stats', 'cpu', 'hot']) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: numbers go in as text (goal/G41.28)', 0.2, function () {
  const t = strings(O.measureObject({ n: 12345, f: 0.5 }));
  return short(t) === short(['n', '12345', 'f', '0.5']) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: a key whose value is true is evaluated, one whose value is false is not (goal/G41.28)', 0.2, function () {
  const t = O.measureObject({ online: true, away: false });
  return (short(strings(t)) === short(['online']) && t[0].flag === true && t[0].isKey === true) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: arrays are scanned, every element a value of its own (goal/G41.28)', 0.2, function () {
  const t = strings(O.measureObject({ tags: ['red', 7, { b: 'c' }, ['deep']] }));
  return short(t) === short(['tags', 'red', '7', 'b', 'c', 'deep']) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: a cycle is measured once, and the scan ends', 0.2, function () {
  const o = { a: 'x' }; o.self = o; const arr = ['y']; arr.push(arr); o.list = arr;
  const t = strings(O.measureObject(o));
  return short(t) === short(['a', 'x', 'self', 'list', 'y']) || 'table ' + short(t);
}, test.limit.quick);
test.run('measureObject: each string with its JS object path, stats.cpu and files[0].name (goal/G43.6)', 0.2, function () {
  const t = O.measureObject({ stats: { cpu: 'hot' }, files: [{ name: 'a.txt' }] });
  const paths = t.map(function (r) { return r.objectString + '@' + r.path; });
  return short(paths) === short(['stats@stats', 'cpu@stats.cpu', 'hot@stats.cpu', 'files@files', 'name@files[0].name', 'a.txt@files[0].name']) || 'paths ' + short(paths);
}, test.limit.quick);
test.run('measureObject: a key\'s own row says isKey; a value\'s row does not', 0.2, function () {
  const t = O.measureObject({ name: 'Andy' });
  return (t[0].isKey === true && t[0].flag === false && !t[1].isKey) || 'table ' + short(t);
}, test.limit.quick);

// ── 3. the weights: the shortest heaviest, adding up to 1 ──
test.run('the weights add up to 1: a string every row of the object matches exactly gives 1.0', 0.2, function () {
  const got = [p('andy', { andy: 'andy' }), p('andy', { andy: { andy: 'andy' } }), p('andy', { andy: ['andy', 'andy'] })];
  return got.every(function (x) { return near(x, 1); }) || 'got ' + short(got);
}, test.limit.quick);
test.run('one string alone weighs 1.0', 0.2, function () {
  return near(p('andy', { andy: true }), 1) || 'got ' + p('andy', { andy: true });
}, test.limit.quick);
test.run('a string of length L weighs (S - L) / S / (n - 1): "andy" beside "qq" weighs 1/3, beside "qqqqqq" 3/5', 0.2, function () {
  const got = [p('andy', { qq: 'andy' }), p('andy', { qqqqqq: 'andy' })];
  return (near(got[0], 1 / 3) && near(got[1], 3 / 5)) || 'got ' + short(got);
}, test.limit.quick);
test.run('the shortest weighs most: the same hit counts more beside a longer string than beside a shorter one', 0.2, function () {
  const a = p('andy', { qqqqqqqqqqqq: 'andy' });
  const b = p('andy', { q: 'andy' });
  return a > b || 'beside a longer ' + a + ', beside a shorter ' + b;
}, test.limit.quick);

// ── 4. a weighted sum, not the best field, on purpose ──
test.run('a perfect hit on one field among many is diluted, as accepted: not 1.0, and lower the more fields there are', 0.2, function () {
  const a = p('andy', { name: 'andy' });
  const b = p('andy', { name: 'andy', city: 'basel', role: 'owner' });
  return (a < 1 && b < a && b > 0) || 'one field ' + a + ', three ' + b;
}, test.limit.quick);
test.run('each string is matched through probabilityStringMatch: a near hit counts, less than an exact one', 0.2, function () {
  const exact = p('andy', { k: 'andy' });
  const nearHit = p('andy', { k: 'andyx' });
  return (nearHit > 0 && nearHit < exact) || 'exact ' + exact + ', near ' + nearHit;
}, test.limit.quick);
test.run('numbers match as text', 0.2, function () {
  return near(p('12345', { n: 12345 }), 1 / 6) || 'got ' + p('12345', { n: 12345 });
}, test.limit.quick);
test.run('a key whose value is false is never matched', 0.2, function () {
  return p('away', { away: false, zz: 'q' }) === 0 || 'got ' + p('away', { away: false, zz: 'q' });
}, test.limit.quick);

// ── in a page ──
test.run('in a page, it is found on window.spirit.probability, and the string match is read there when called, not as the file loads (goal/G41.18)', 0.2, function () {
  const win = {};
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), { window: win });
  const P = win.spirit && win.spirit.probability;
  if (!P || typeof P.probabilityStringObjectMatch !== 'function' || typeof P.measureObject !== 'function') return 'window.spirit.probability holds ' + short(P && Object.keys(P));
  P.probabilityStringMatch = function (a, b) { return a === b ? 1 : 0; };
  return near(P.probabilityStringObjectMatch('andy', { andy: 'andy' }), 1) || 'got ' + P.probabilityStringObjectMatch('andy', { andy: 'andy' });
}, test.limit.quick);
test.run('the module answers measureObject and probabilityStringObjectMatch', 0.2, function () {
  return short(Object.keys(O).sort()) === short(['measureObject', 'probabilityStringObjectMatch']) || 'exports ' + short(Object.keys(O));
}, test.limit.quick);
