'use strict';

// spirit/run/spirit/type/string/test/description.js
// The tests of spirit/type/string/description.js, and of no other module (spec: ./description.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.description: a description, its limit DESCRIPTION_MAX_BYTES, 128 bytes, never empty.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/description.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/description.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('it is an object of two static functions, defaultValue and isValid', 0.4, function () {
  return (!!T && typeof T.defaultValue === 'function' && typeof T.isValid === 'function') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "said in a few words", "a".repeat(128)', 0.4, function () {
  if (!T) return false;
  try { return ['said in a few words', 'a'.repeat(128)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "", "a".repeat(129), "a\\u200db", 7, null', 0.4, function () {
  if (!T) return false;
  return ['', 'a'.repeat(129), 'a\u200db', 7, null].every(throws) || false;
}, test.limit.quick);
