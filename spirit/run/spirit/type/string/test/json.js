'use strict';

// spirit/run/spirit/type/string/test/json.js
// The tests of spirit/type/string/json.js, and of no other module (spec: ./json.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.json: JSON carried in a string, at most the payload limit, 22528 bytes (Q3, Andy: "make spirit/type/string/json.js and set the limit same as payload, but verify parsing....").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'type', 'string/json.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/json.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true for an object, a list and a string as JSON, and for 22000 bytes of it', 0.4, function () {
  if (!T) return false;
  try { return [JSON.stringify({ a: 1 }), JSON.stringify([]), JSON.stringify('x'), JSON.stringify({ a: 'b'.repeat(22000) })].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for JSON that does not parse, an empty string, JSON past 22528 bytes, a number and an object', 0.4, function () {
  if (!T) return false;
  return ['{', 'nope', '', JSON.stringify({ a: 'b'.repeat(22600) }), 5, {}].every(throws) || false;
}, test.limit.quick);
