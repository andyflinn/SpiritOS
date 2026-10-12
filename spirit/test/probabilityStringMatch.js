'use strict';

// spirit/test/probabilityStringMatch.js
// goal/G18.2: probabilityStringMatch.js, the first of the probabilit* core modules. Red on today's tree (5ac318bc);
// claude-windows wrote it and builds it. The item's box (v3), Andy, 2026-10-12:
//   "result probability = probabilityStringMatch(A,B) where A and B must be strings." "if A or B are not of type
//   string return 0.0; if A is EXACTLY equal to B return 1.0"; "shorterString = the shorter String of A and B,
//   longerString = longer String of A and B; if they are of equal length, shorterString = A, longerString = B, then use
//   the logic from gradedSearch to return a result between 0 and 1"; and "in this version, we just compute the matching
//   of two string, no matter which one is the search string."
//
// WHAT IS ASSERTED
//   1. the module exists in run/js and exports probabilityStringMatch(A, B).
//   2. not two strings: 0.0. Exactly equal: 1.0. Every answer a number from 0 to 1.
//   3. no search string: the answer is the same either way round; * and ? are plain characters.
//   4. the logic is gradedSearch's: for strings without * or ?, the answer is gradedSearch's quality of the longer
//      string graded against the shorter, and its order holds (whole word over prefix over found inside over none).
//   5. gradedSearch.js is untouched by this item (the integration is argued after).
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G18.2: ';
const MODULE = path.join(__dirname, '..', 'run', 'js', 'probabilityStringMatch.js');
const graded = require('../run/js/gradedSearch.js');

test.startTest('goal/G18.2: probabilityStringMatch(A, B), a probability from 0 to 1');

let m = null;
try { m = require(MODULE); } catch (e) { m = null; }
const psm = m && (typeof m === 'function' ? m : m.probabilityStringMatch);

test.subHeading('1. the module');
if (typeof psm === 'function') test.check('run/js/probabilityStringMatch.js exports probabilityStringMatch(A, B)');
else { test.fail(OWED + 'no run/js/probabilityStringMatch.js exporting probabilityStringMatch'); test.reportSuccessFailureCount(); process.exit(0); }

test.subHeading('2. the edges: not strings, exactly equal, always 0 to 1');
const notStrings = [[null, 'a'], ['a', undefined], [5, '5'], [{}, 'x'], ['x', ['x']], [true, 'true']];
const zero = notStrings.filter(function (p) { return psm(p[0], p[1]) !== 0; });
if (!zero.length) test.check('A or B not a string: 0.0, for null, undefined, a number, an object, an array, a boolean');
else test.fail(OWED + 'not 0.0 for ' + JSON.stringify(zero));
if (psm('Levant', 'Levant') === 1 && psm('', '') === 1 && psm('a b c', 'a b c') === 1) test.check('exactly equal: 1.0');
else test.fail(OWED + 'equal strings answered ' + JSON.stringify([psm('Levant', 'Levant'), psm('', ''), psm('a b c', 'a b c')]));
// Andy, 2026-10-12: "and empty string against a non-empty string should return 0".
if (psm('', 'x') === 0 && psm('Levant', '') === 0) test.check('an empty string against a non-empty one: 0.0');
else test.fail(OWED + 'empty against non-empty answered ' + JSON.stringify([psm('', 'x'), psm('Levant', '')]));
const pairs = [['ann', 'annabel'], ['annabel', 'ann'], ['one two three four', 'six twelve four one'], ['abc', 'xyz'], ['Zürich', 'zurich'], ['a', 'banana'], ['deskUnsloth', 'deskUnslothRemote'], ['x', ''], ['', 'x']];
const out = pairs.map(function (p) { return psm(p[0], p[1]); });
if (out.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1 && !isNaN(v); })) test.check('every answer is a number from 0 to 1: ' + out.map(function (v) { return v.toFixed(3); }).join(' '));
else test.fail(OWED + 'answers ' + JSON.stringify(out));

test.subHeading('3. no search string');
const sym = pairs.filter(function (p) { return psm(p[0], p[1]) !== psm(p[1], p[0]); });
if (!sym.length) test.check('the same answer either way round');
else test.fail(OWED + 'not symmetric for ' + JSON.stringify(sym));
if (psm('a*c', 'abc') === 0 && psm('a?c', 'abc') === 0 && psm('a*c', 'xa*cx') > 0) test.check('* and ? are plain characters, not wildcards');
else test.fail(OWED + 'wildcards: ' + JSON.stringify([psm('a*c', 'abc'), psm('a?c', 'abc'), psm('a*c', 'xa*cx')]));

test.subHeading('4. the logic is gradedSearch\'s');
const same = [['ann', 'annabel'], ['ann', 'ann smith'], ['one two three four', 'six twelve four one'], ['four one', 'one two three four'], ['smith', 'john smith'], ['zurich', 'Zürich'], ['abc', 'xyz'], ['levant', 'levant']].filter(function (p) {
  const shorter = p[0].length <= p[1].length ? p[0] : p[1];
  const longer = shorter === p[0] ? p[1] : p[0];
  const want = graded.explain(longer, shorter).quality;
  return Math.abs(psm(p[0], p[1]) - want) > 1e-12;
});
if (!same.length) test.check('for strings without * or ?, the answer is gradedSearch\'s quality of the longer string against the shorter');
else test.fail(OWED + 'differs from gradedSearch for ' + JSON.stringify(same.map(function (p) { return [p, psm(p[0], p[1])]; })));
const whole = psm('ann', 'ann');
const prefix = psm('ann', 'annabel');
const inside = psm('ann', 'joanne');
const none = psm('ann', 'bob');
if (whole > prefix && prefix > inside && inside > none && none === 0) test.check('its order holds: equal ' + whole.toFixed(2) + ' > starts with ' + prefix.toFixed(2) + ' > found inside ' + inside.toFixed(2) + ' > none 0');
else test.fail(OWED + 'order: ' + JSON.stringify([whole, prefix, inside, none]));

test.subHeading('5. gradedSearch.js untouched');
const src = fs.readFileSync(path.join(__dirname, '..', 'run', 'js', 'gradedSearch.js'), 'utf8');
if (!/probabilityStringMatch/.test(src)) test.check('gradedSearch.js does not use it yet: the integration is argued after');
else test.fail(OWED + 'gradedSearch.js already refers to probabilityStringMatch');

test.reportSuccessFailureCount();
process.exit(0);
