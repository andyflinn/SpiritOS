'use strict';

// spirit/run/spirit/type/number/test/UTC.js
// The tests of spirit/type/number/UTC.js, and of no other module (spec: ./UTC.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.number.UTC: a date, a number (the box: "YES, DATE IS A FUCKING NUMBER").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'number/UTC.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/number/UTC.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('it is an object of two static functions, defaultValue and isValid', 0.4, function () {
  return (!!T && typeof T.defaultValue === 'function' && typeof T.isValid === 'function') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for 0, Date.now()', 0.4, function () {
  if (!T) return false;
  try { return [0, Date.now()].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "2026-11-20", NaN, Infinity, null, new Date()', 0.4, function () {
  if (!T) return false;
  return ['2026-11-20', NaN, Infinity, null, new Date()].every(throws) || false;
}, test.limit.quick);
