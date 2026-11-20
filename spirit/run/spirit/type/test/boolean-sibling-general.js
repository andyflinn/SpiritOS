'use strict';

// spirit/run/spirit/type/test/boolean-sibling-general.js [file]
// THE RULES EVERY TYPE FILE KEEPS (goal/G48.4; spec: ./boolean-sibling-general.md). Andy: "spirit/type/test/
// boolean-sibling-general.js (is that a name that reaches all type files?)": a -sibling- general test beside
// spirit/type/boolean.js judges every module in spirit/type/ and below (../../test/TEST_SYSTEM.md).
//
//   node spirit/type/test/boolean-sibling-general.js spirit/type/string/label.js     that type file
//   node spirit/type/test/boolean-sibling-general.js                                 every type file
//
// Its rules, Andy's: "isValid() must return true for default() value of the same field script."; "isValid(value) must
// throw an error if the value is null or undefined". With them, the box: "a type script.js is an object containing static
// functions ... defaultValue() ... and isValid(something)".
require('../../spirit.js');
const GIVEN = process.argv.slice(2).filter(function (a, i, all) { return a.indexOf('--') !== 0 && all[i - 1] !== '--test'; });
function typeRules(ARGS) {
const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const TYPE = path.join(RUN, 'spirit', 'type');

// Every type file: each script under spirit/type/, at any depth, leaving out the test folders.
function walk(dir) {
  let out = [];
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach(function (d) {
    if (d.isDirectory()) { if (d.name !== 'test') out = out.concat(walk(path.join(dir, d.name))); }
    else if (/\.js$/.test(d.name)) out.push(path.relative(RUN, path.join(dir, d.name)).split(path.sep).join('/'));
  });
  return out;
}
const ALL = walk(TYPE).sort();
const asked = ARGS[0] ? String(ARGS[0]).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^spirit\/run\//, '') : '';
const TARGETS = asked ? ALL.filter(function (f) { return f === asked; }) : ALL;
function load(rel) { try { return require(path.join(RUN, rel)); } catch (e) { return null; } }
function throws(T, v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } }
const every = function (fn) { return TARGETS.length > 0 && TARGETS.every(function (rel) { const T = load(rel); return !!T && fn(T); }); };

test.run('every type file under spirit/type/ is an object holding defaultValue, isValid and ruleDescription', 0.4, function () {
  return every(function (T) { return typeof T === 'object' && typeof T.defaultValue === 'function' && typeof T.isValid === 'function' && typeof T.ruleDescription === 'function'; }) || false;
}, test.limit.quick);
test.run('for every type file, isValid answers true for its own defaultValue()', 0.4, function () {
  return every(function (T) { try { return T.isValid(T.defaultValue()) === true; } catch (e) { return false; } }) || false;
}, test.limit.quick);
test.run('for every type file, isValid throws an error for null and for undefined', 0.4, function () {
  return every(function (T) { return throws(T, null) && throws(T, undefined); }) || false;
}, test.limit.quick);
// Box v23: "the third filed is ruleDesription(), it returns a short description if what the isValid() checks." Short: a
// description as spirit.type.string.description takes it, not empty and at most 128 bytes.
test.run('for every type file, ruleDescription() answers a short description of what isValid checks: a description of 1 to 128 bytes', 0.4, function () {
  const D = load('spirit/type/string/description.js');
  if (!D) return false;
  return every(function (T) {
    if (typeof T.ruleDescription !== 'function') return false;
    let d = null;
    try { d = T.ruleDescription(); } catch (e) { return false; }
    try { return typeof d === 'string' && D.isValid(d) === true; } catch (e) { return false; }
  }) || false;
}, test.limit.quick);
}
if (!GIVEN.length) typeRules([]);
else GIVEN.forEach(function (one) { require('../../test/testReport.js').forScript(one, function () { typeRules([one]); }); });
