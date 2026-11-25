'use strict';

// spirit/run/spirit/type/object/payload/test/script.js
// The tests of spirit/type/object/payload/script.js, and of no other module (spec: ./script.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.object.payload: a payload, an object.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/object/payload/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/object/payload/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for {}, { a: 1 }', 0.4, function () {
  if (!T) return false;
  try { return [{}, { a: 1 }].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for [], null, "x", 5', 0.4, function () {
  if (!T) return false;
  return [[], null, 'x', 5].every(throws) || false;
}, test.limit.quick);
