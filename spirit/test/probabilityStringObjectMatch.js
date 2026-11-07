'use strict';

// spirit/test/probabilityStringObjectMatch.js
// goal/G18.3: probabilityStringObjectMatch(string, object), the second probabilit* module. The item's box,
// Andy, 2026-10-12:
//   "1. the input must be valid string and object, empty string will return 0", "2. We "measure" the object ... extracts
//   every valid string from the object and places it in a table", "3. ... the shortest string in the object gets the
//   highest weight, the longest string in the object gets the smallest weight, and all the weights of the string in the
//   table must add up to 1.0", "4. the overall input string is then matched agains all strings in the object, using
//   pobabilityStringMatch(). each of those results is then multiplied by the weight of the corresponding object-string,
//   and added to the overall result.", "5. the overall result is returned."
//   Decided: empty strings stay out of the table; "no arrays are searched in this version"; "nested objects will be
//   searched for strings to put into the table."; "if keys are string, they are included, this is supposed to be
//   "dumb""; the weights (S - L) / S, corrected: "you formula-correction is accepted": divided by n - 1, one string 1.0.
//
// WHAT IS ASSERTED
//   1. spirit/run/spirit/probabilityStringObjectMatch.js exports probabilityStringObjectMatch(string, object).
//   2. not a string, an empty string, not a plain object (null, an array, a string, a number): 0.0; an object with no
//      string in it: 0.0.
//   3. the table: keys and string values, nested plain objects in, empty strings out; the weights
//      (S - L) / S / (n - 1), one string 1.0; the answer the weighted sum of probabilityStringMatch, checked against
//      that computed here.
//   4. a cycle in the object ends; every answer is a number from 0 to 1.
//   5. goal/G41.28: numbers are matched as text; a true boolean's key is evaluated, a false boolean's key is
//      not; arrays are scanned, each element a field (Andy: "probabilityStringObjectMatch can easily convert numbers in an
//      object to strings, for matching", "same for booleans: if a boolean is true, then it's key serves as string to be
//      evaluated. if the boolean is false, it's key will NOT be evaluated.", "probabilityStringObjectMatch will scan
//      arrays as well."). They overrule "no arrays are searched in this version".
// rule/11: through testSupport only.

const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G18.3: ';
const MODULE = path.join(__dirname, '..', 'run', 'spirit', 'probabilityStringObjectMatch.js');
const psm = require('../run/spirit/probabilityStringMatch.js').probabilityStringMatch;

test.startTest('goal/G18.3: probabilityStringObjectMatch(string, object), a weighted probability from 0 to 1');

let mod = null;
try { mod = require(MODULE); } catch (e) { mod = null; }
const psom = mod && (typeof mod === 'function' ? mod : mod.probabilityStringObjectMatch);

test.subHeading('1. the module');
if (typeof psom === 'function') test.check('run/js/probabilityStringObjectMatch.js exports probabilityStringObjectMatch(string, object)');
else { test.fail(OWED + 'no run/js/probabilityStringObjectMatch.js exporting probabilityStringObjectMatch'); test.reportSuccessFailureCount(); process.exit(0); }

// THE TABLE AND THE ANSWER AS THE BOXES SAY, computed here to hold the module to it: keys, unless their value is false;
// strings, numbers as text; nested plain objects entered, arrays scanned, each element as a value (goal/G41.28).
function value(v, out, seen) {
  if (typeof v === 'string') { if (v !== '') out.push(v); }
  else if (typeof v === 'number') out.push(String(v));
  else if (Array.isArray(v)) { if (seen.indexOf(v) === -1) { seen.push(v); v.forEach(function (x) { value(x, out, seen); }); } }
  else if (v && typeof v === 'object') table(v, out, seen);
}
function table(obj, out, seen) {
  out = out || []; seen = seen || [];
  if (seen.indexOf(obj) !== -1) return out;
  seen.push(obj);
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (k !== '' && v !== false) out.push(k);
    value(v, out, seen);
  });
  return out;
}
function expected(s, obj) {
  const strings = table(obj);
  if (!strings.length) return 0;
  if (strings.length === 1) return psm(s, strings[0]);
  const S = strings.reduce(function (n, x) { return n + x.length; }, 0);
  const n = strings.length;
  return strings.reduce(function (sum, x) { return sum + psm(s, x) * ((S - x.length) / S / (n - 1)); }, 0);
}

test.subHeading('2. not a string, not an object, nothing to match: 0.0');
const zero = [[5, { a: 'b' }], [null, { a: 'b' }], ['', { a: 'b' }], ['ann', null], ['ann', ['ann']], ['ann', 'ann'], ['ann', 5], ['ann', {}], ['ann', { '': '' }]]
  .filter(function (p) { return psom(p[0], p[1]) !== 0; });
if (!zero.length) test.check('not a string, an empty string, null, an array, a string, a number, an empty object: 0.0');
else test.fail(OWED + 'not 0.0 for ' + JSON.stringify(zero.map(function (p) { return [p[0], p[1], psom(p[0], p[1])]; })));

test.subHeading('3. the table, the weights, the weighted sum');
const one = { n: {} };
if (psom('n', one) === 1) test.check('one string alone (the key n of {n: {}}) weighs 1.0: an exact match answers 1.0');
else test.fail(OWED + 'psom("n", {n: {}}) answered ' + psom('n', one));
const ann = { name: 'ann' };
const wantAnn = expected('ann', ann);
if (Math.abs(psom('ann', ann) - wantAnn) < 1e-12 && Math.abs(wantAnn - 4 / 7) < 1e-12) test.check('keys and values: {name: "ann"} against "ann" is 0 x 3/7 + 1 x 4/7 = ' + wantAnn.toFixed(4));
else test.fail(OWED + 'psom("ann", {name: "ann"}) answered ' + psom('ann', ann) + ', the box gives ' + wantAnn);
const cases = [
  ['ann', { a: { b: 'ann' } }],
  ['ann', { tags: ['ann', 'annabel'], name: 'ann smith' }],
  ['john smith', { publicKey: 'MCowBQYDK2VwAyEAx', publicLabel: 'john smith', present: true, via: '' }],
  ['zurich', { city: 'Zürich', country: { name: 'Switzerland', code: 'CH' } }],
  ['levant', { persona: 'Levant', preamble: 'you are Levant, a genius', model: 'ornith-ai/Ornith-1.5-9B-GGUF' }],
];
const off = cases.filter(function (c) { return Math.abs(psom(c[0], c[1]) - expected(c[0], c[1])) > 1e-12; });
if (!off.length) test.check('for nested objects, arrays, numbers and booleans, keys in: the weighted sum the boxes give, every case');
else test.fail(OWED + 'differs from the box for ' + JSON.stringify(off.map(function (c) { return [c[0], c[1], psom(c[0], c[1]), expected(c[0], c[1])]; })));

test.subHeading('5. goal/G41.28: numbers, booleans and arrays');
const OWED28 = 'OWED by goal/G41.28: ';
const arr = { tags: ['ann'] };
if (Math.abs(psom('ann', arr) - expected('ann', arr)) < 1e-12 && psom('ann', arr) > psm('ann', 'tags') * 0.5 + 1e-9) test.check('an array is scanned: {tags: ["ann"]} against "ann" finds the element (' + psom('ann', arr).toFixed(4) + ')');
else test.fail(OWED28 + 'psom("ann", {tags: ["ann"]}) answered ' + psom('ann', arr) + ', its elements unread; the box gives ' + expected('ann', arr));
const deep = { list: [{ name: 'ann' }, ['zoe']] };
if (Math.abs(psom('zoe', deep) - expected('zoe', deep)) < 1e-12 && psom('zoe', deep) > 0) test.check('inside an array, objects and arrays are scanned too');
else test.fail(OWED28 + 'psom("zoe", {list: [{name: "ann"}, ["zoe"]]}) answered ' + psom('zoe', deep) + ', the box gives ' + expected('zoe', deep));
const num = { count: 42 };
if (Math.abs(psom('42', num) - expected('42', num)) < 1e-12 && psom('42', num) > 0.5) test.check('a number is matched as text: {count: 42} against "42" is ' + psom('42', num).toFixed(4));
else test.fail(OWED28 + 'psom("42", {count: 42}) answered ' + psom('42', num) + ', the box gives ' + expected('42', num));
const yes = { active: true };
if (psom('active', yes) === 1) test.check('a true boolean\'s key is evaluated: {active: true} against "active" is 1.0');
else test.fail(OWED28 + 'psom("active", {active: true}) answered ' + psom('active', yes));
const no = { active: false, name: 'ann' };
if (Math.abs(psom('active', no) - expected('active', no)) < 1e-12 && psom('active', { active: false }) === 0) test.check('a false boolean\'s key is not evaluated: {active: false} against "active" is 0');
else test.fail(OWED28 + 'psom("active", {active: false}) answered ' + psom('active', { active: false }) + ': its key was evaluated');

test.subHeading('4. a cycle ends; every answer from 0 to 1');
const loop = { name: 'ann' };
loop.self = loop;
let ended = null;
try { ended = psom('ann', loop); } catch (e) { ended = 'threw ' + e.message; }
if (typeof ended === 'number' && ended >= 0 && ended <= 1) test.check('an object that holds itself is measured once and answers ' + ended.toFixed(4));
else test.fail(OWED + 'a cycle answered ' + JSON.stringify(ended));
const all = cases.concat([['ann', ann], ['n', one], ['ann', arr], ['zoe', deep], ['42', num], ['active', yes], ['active', no]]).map(function (c) { return psom(c[0], c[1]); });
if (all.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1 && !isNaN(v); })) test.check('every answer is a number from 0 to 1: ' + all.map(function (v) { return v.toFixed(3); }).join(' '));
else test.fail(OWED + 'answers ' + JSON.stringify(all));

test.reportSuccessFailureCount();
process.exit(0);
