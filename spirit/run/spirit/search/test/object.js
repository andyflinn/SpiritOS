'use strict';

// spirit/run/spirit/search/test/object.js
// The tests of spirit/search/object.js, and of no other module (spec: ./probabilityStringObjectMatch.md).
// Its own test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
//
// probabilityStringObjectMatch(string, object): how likely a string is what an object holds (goal/G18.3), a weighted sum
// over every string the object holds, the shortest heaviest; measureObject, the one scan, with each string's path
// (goal/G43.6). Pure; the page half is loaded in a vm with a planted window.

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/search/object.js';
const FILE = path.join(RUN, SUBJECT);
const O = LOADER.requireScript(SUBJECT);
const p = O.probabilityStringObjectMatch;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function near(a, b) { return typeof a === 'number' && Math.abs(a - b) < 1e-9; }
function strings(table) { return table.map(function (r) { return r.objectString; }); }

// ── 1. the input ──
test.run('an empty string, or a string that is no string, gives 0', 0.2, function () {
  const got = [p('', { andy: 'andy' }), p(null, { andy: 'andy' }), p(5, { 5: 5 })];
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);
test.run('an object that is no plain object (null, an array, a string) gives 0', 0.2, function () {
  const got = [p('andy', null), p('andy', ['andy']), p('andy', 'andy'), p('andy', undefined)];
  return got.every(function (x) { return x === 0; }) || false;
}, test.limit.quick);
test.run('an object that holds no string gives 0', 0.2, function () {
  return p('andy', {}) === 0 || false;
}, test.limit.quick);

// ── 2. measure the object ──
test.run('measureObject takes every key and every string value, in the order met, keys included, as "this is supposed to be dumb"', 0.2, function () {
  return short(strings(O.measureObject({ name: 'Andy', city: 'Basel' }))) === short(['name', 'Andy', 'city', 'Basel']) || false;
}, test.limit.quick);
test.run('measureObject keeps empty strings out of the table, as values and as keys', 0.2, function () {
  const t = strings(O.measureObject({ a: '', '': 'x' }));
  return (t.indexOf('') === -1 && short(t) === short(['a', 'x'])) || false;
}, test.limit.quick);
test.run('measureObject searches nested objects for strings', 0.2, function () {
  const t = strings(O.measureObject({ stats: { cpu: 'hot' } }));
  return short(t) === short(['stats', 'cpu', 'hot']) || false;
}, test.limit.quick);
test.run('measureObject puts numbers in as text', 0.2, function () {
  const t = strings(O.measureObject({ n: 12345, f: 0.5 }));
  return short(t) === short(['n', '12345', 'f', '0.5']) || false;
}, test.limit.quick);
test.run('measureObject evaluates a key whose value is true, and not one whose value is false', 0.2, function () {
  const t = O.measureObject({ online: true, away: false });
  return (short(strings(t)) === short(['online']) && t[0].flag === true && t[0].isKey === true) || false;
}, test.limit.quick);
test.run('measureObject scans arrays, every element a value of its own', 0.2, function () {
  const t = strings(O.measureObject({ tags: ['red', 7, { b: 'c' }, ['deep']] }));
  return short(t) === short(['tags', 'red', '7', 'b', 'c', 'deep']) || false;
}, test.limit.quick);
test.run('measureObject measures a cycle once, and the scan ends', 0.2, function () {
  const o = { a: 'x' }; o.self = o; const arr = ['y']; arr.push(arr); o.list = arr;
  const t = strings(O.measureObject(o));
  return short(t) === short(['a', 'x', 'self', 'list', 'y']) || false;
}, test.limit.quick);
test.run('measureObject gives each string its JS object path, such as stats.cpu and files[0].name', 0.2, function () {
  const t = O.measureObject({ stats: { cpu: 'hot' }, files: [{ name: 'a.txt' }] });
  const paths = t.map(function (r) { return r.objectString + '@' + r.path; });
  return short(paths) === short(['stats@stats', 'cpu@stats.cpu', 'hot@stats.cpu', 'files@files', 'name@files[0].name', 'a.txt@files[0].name']) || false;
}, test.limit.quick);
test.run('in measureObject a key\'s own row says isKey, and a value\'s row does not', 0.2, function () {
  const t = O.measureObject({ name: 'Andy' });
  return (t[0].isKey === true && t[0].flag === false && !t[1].isKey) || false;
}, test.limit.quick);

// ── 3. the weights: the shortest heaviest, adding up to 1 ──
test.run('the weights add up to 1: a string every row of the object matches exactly gives 1.0', 0.2, function () {
  const got = [p('andy', { andy: 'andy' }), p('andy', { andy: { andy: 'andy' } }), p('andy', { andy: ['andy', 'andy'] })];
  return got.every(function (x) { return near(x, 1); }) || false;
}, test.limit.quick);
test.run('one string alone weighs 1.0', 0.2, function () {
  return near(p('andy', { andy: true }), 1) || false;
}, test.limit.quick);
test.run('a string weighs (total length less its own) / total length / (strings less one): "andy" beside "qq" 1/3, beside "qqqqqq" 3/5', 0.2, function () {
  const got = [p('andy', { qq: 'andy' }), p('andy', { qqqqqq: 'andy' })];
  return (near(got[0], 1 / 3) && near(got[1], 3 / 5)) || false;
}, test.limit.quick);
test.run('the shortest weighs most: the same hit counts more beside a longer string than beside a shorter one', 0.2, function () {
  const a = p('andy', { qqqqqqqqqqqq: 'andy' });
  const b = p('andy', { q: 'andy' });
  return a > b || false;
}, test.limit.quick);

// ── 4. a weighted sum, not the best field, on purpose ──
test.run('a perfect hit on one field among many is diluted, as accepted: not 1.0, and lower the more fields there are', 0.2, function () {
  const a = p('andy', { name: 'andy' });
  const b = p('andy', { name: 'andy', city: 'basel', role: 'owner' });
  return (a < 1 && b < a && b > 0) || false;
}, test.limit.quick);
test.run('each string is matched through probabilityStringMatch: a near hit counts, less than an exact one', 0.2, function () {
  const exact = p('andy', { k: 'andy' });
  const nearHit = p('andy', { k: 'andyx' });
  return (nearHit > 0 && nearHit < exact) || false;
}, test.limit.quick);
test.run('numbers match as text', 0.2, function () {
  return near(p('12345', { n: 12345 }), 1 / 6) || false;
}, test.limit.quick);
test.run('a key whose value is false is never matched', 0.2, function () {
  return p('away', { away: false, zz: 'q' }) === 0 || false;
}, test.limit.quick);

// ── in a page ──
test.run('in a page it stands at spirit.required.spirit.search.object, and reads the string match there when called, not at load', 0.2, function () {
  const win = {};
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), { window: win });
  const Q = (((win.spirit || {}).required || {}).spirit || {}).search || {};
  const P = Q.object;
  if (!P || typeof P.probabilityStringObjectMatch !== 'function' || typeof P.measureObject !== 'function') return false;
  Q.string = { probabilityStringMatch: function (a, b) { return a === b ? 1 : 0; } };
  return near(P.probabilityStringObjectMatch('andy', { andy: 'andy' }), 1) || false;
}, test.limit.quick);
test.run('the module answers measureObject and probabilityStringObjectMatch', 0.2, function () {
  return short(Object.keys(O).sort()) === short(['measureObject', 'probabilityStringObjectMatch']) || false;
}, test.limit.quick);
