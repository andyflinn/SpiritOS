'use strict';

// spirit/run/spirit/type/string/test/word.js
// The tests of spirit/type/string/word.js, and of no other module (spec: ./word.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.word: a word, 1 to 32 of letters, digits, dot, underscore or dash, as fieldRules.js's spoken word.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/word.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/word.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('it is an object of two static functions, defaultValue and isValid', 0.4, function () {
  return (!!T && typeof T.defaultValue === 'function' && typeof T.isValid === 'function') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "card", "a".repeat(32), "set_name-2.x"', 0.4, function () {
  if (!T) return false;
  try { return ['card', 'a'.repeat(32), 'set_name-2.x'].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "", "a".repeat(33), "two words", "a/b", 5, null', 0.4, function () {
  if (!T) return false;
  return ['', 'a'.repeat(33), 'two words', 'a/b', 5, null].every(throws) || false;
}, test.limit.quick);
