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
//   4. its order holds: whole word over prefix over found inside over none (gradedSearch's quality until goal/G29.1).
//   5. gradedSearch.js is untouched by this item (the integration is argued after).
//   6, 7. goal/G29.1: case counts by 0.000001 a character; distance counts, proximity 0.35 over order 0.15.
// rule/11: through testSupport only.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G18.2: ';
const MODULE = path.join(__dirname, '..', 'run', 'js', 'probabilityStringMatch.js');

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
const pairs = [['ann', 'annabel'], ['annabel', 'ann'], ['one two three four', 'six twelve four one'], ['abc', 'xyz'], ['Zürich', 'zurich'], ['a', 'banana'], ['deskAgent', 'deskAgentRemote'], ['x', ''], ['', 'x']];
const out = pairs.map(function (p) { return psm(p[0], p[1]); });
if (out.every(function (v) { return typeof v === 'number' && v >= 0 && v <= 1 && !isNaN(v); })) test.check('every answer is a number from 0 to 1: ' + out.map(function (v) { return v.toFixed(3); }).join(' '));
else test.fail(OWED + 'answers ' + JSON.stringify(out));

test.subHeading('3. no search string');
const sym = pairs.filter(function (p) { return psm(p[0], p[1]) !== psm(p[1], p[0]); });
if (!sym.length) test.check('the same answer either way round');
else test.fail(OWED + 'not symmetric for ' + JSON.stringify(sym));
if (psm('a*c', 'abc') === 0 && psm('a?c', 'abc') === 0 && psm('a*c', 'xa*cx') > 0) test.check('* and ? are plain characters, not wildcards');
else test.fail(OWED + 'wildcards: ' + JSON.stringify([psm('a*c', 'abc'), psm('a?c', 'abc'), psm('a*c', 'xa*cx')]));

test.subHeading('4. its order');
// goal/G29.1 departs from gradedSearch on purpose (case and distance count, the weights move), so the answer is no
// longer gradedSearch's quality; the order of the four kinds of match still holds.
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

// goal/G29.1: IMPROVE THE STRING MATCH ITSELF. Its box: "Case counts: "Relay" matches "Relay" better than "relay" or
// "reLay" does. 0.000001 is subtracted from the probability for every character whose case differs, counted over the
// characters that matched ignoring case; it only orders better matches ahead of worse ones and moves nothing else."
// "Distance counts, and more than order: a fifth signal, proximity = matched words / words spanned from the first
// match to the last (side by side 1.0) ... proximity weighs 0.35 and order drops from 0.25 to 0.15. That ratio is a
// guess."
const OWED29 = 'OWED by goal/G29.1: ';
test.subHeading('6. goal/G29.1: case counts, by a hair');
const exactCase = psm('Relay', 'Relay');
const oneOff = psm('relay', 'Relay');
const twoOff = psm('reLay', 'Relay');
if (exactCase === 1 && oneOff < exactCase && twoOff < oneOff && Math.abs(oneOff - (1 - 0.000001)) < 1e-12 && Math.abs(twoOff - (1 - 0.000002)) < 1e-12) test.check('Relay 1.0 > relay ' + oneOff + ' > reLay ' + twoOff + ', 0.000001 per character whose case differs');
else test.fail(OWED29 + 'Relay ' + exactCase + ', relay ' + oneOff + ', reLay ' + twoOff);
// Counted over what matched ignoring case: a better match with the wrong case still beats a worse one with the right.
const betterWrongCase = psm('relay key', 'RELAY KEY answers');
const worseRightCase = psm('relay key', 'the relay answers the key');
if (betterWrongCase > worseRightCase) test.check('case only orders ties: RELAY KEY answers (' + betterWrongCase.toFixed(6) + ') still beats the relay answers the key (' + worseRightCase.toFixed(6) + ')');
else test.fail(OWED29 + 'case moved a better match below a worse one: ' + betterWrongCase + ' vs ' + worseRightCase);
const inLong = psm('relay', 'the RELAY answers');
const inLongLower = psm('relay', 'the relay answers');
if (inLong < inLongLower && inLongLower - inLong < 0.00001) test.check('found inside with the wrong case: a hair below the right case (' + (inLongLower - inLong).toExponential(1) + ')');
else test.fail(OWED29 + 'relay in the RELAY answers ' + inLong + ', in the relay answers ' + inLongLower);

test.subHeading('7. goal/G29.1: distance counts, more than order');
// Two labels alike in length, words and order, the matched words side by side in one and far apart in the other.
const filler = function (n, from) { const w = []; for (let i = 0; i < n; i++) w.push('w' + String(from + i).padStart(3, '0')); return w.join(' '); };
const near = 'relay w000 key ' + filler(300, 1);
const far = 'relay ' + filler(300, 1) + ' w000 key';
const pNear = psm('relay key', near);
const pFar = psm('relay key', far);
if (near.length === far.length && pNear > pFar) test.check('the same words in the same order score higher close together (' + pNear.toFixed(4) + ') than 300 words apart (' + pFar.toFixed(4) + ')');
else test.fail(OWED29 + 'close ' + pNear + ', far ' + pFar + ' (lengths ' + near.length + ', ' + far.length + ')');
// Distance weighs more than order: side by side but reversed beats in order but 300 words apart.
const nearReversed = 'key relay ' + filler(300, 1) + ' w300';
const farInOrder = 'relay ' + filler(300, 1) + ' key';
const pRev = psm('relay key', nearReversed);
const pOrd = psm('relay key', farInOrder);
if (pRev > pOrd) test.check('side by side but reversed (' + pRev.toFixed(4) + ') beats in order but 300 words apart (' + pOrd.toFixed(4) + '): proximity 0.35 over order 0.15');
else test.fail(OWED29 + 'reversed but close ' + pRev + ', in order but far ' + pOrd);

test.reportSuccessFailureCount();
process.exit(0);
