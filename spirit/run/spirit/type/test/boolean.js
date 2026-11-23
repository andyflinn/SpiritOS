'use strict';

// spirit/run/spirit/type/test/boolean.js
// The tests of spirit/type/boolean.js, and of no other module (spec: ./boolean.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.boolean: a boolean, true or false and nothing else (the box: "still have to make sure it's actually a fucking boolean"; "\"flags\" must be booleans").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'type', 'boolean.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/boolean.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for true, false', 0.4, function () {
  if (!T) return false;
  try { return [true, false].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for 1, 0, "yes", "", "true", null, undefined', 0.4, function () {
  if (!T) return false;
  return [1, 0, 'yes', '', 'true', null, undefined].every(throws) || false;
}, test.limit.quick);
