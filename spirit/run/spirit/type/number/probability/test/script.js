'use strict';

// spirit/run/spirit/type/number/probability/test/script.js
// The tests of spirit/type/number/probability/script.js, and of no other module (spec: ./script.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.number.probability: a probability, a number from 0 to 1.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/number/probability/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/number/probability/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for 0, 0.5, 1', 0.4, function () {
  if (!T) return false;
  try { return [0, 0.5, 1].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for -0.1, 1.1, NaN, "0.5", null', 0.4, function () {
  if (!T) return false;
  return [-0.1, 1.1, NaN, '0.5', null].every(throws) || false;
}, test.limit.quick);
