'use strict';

// spirit/run/spirit/type/number/UTC/test/script.js
// The tests of spirit/type/number/UTC/script.js, and of no other module (spec: ./script.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.number.UTC: a date, a number (the box: "YES, DATE IS A FUCKING NUMBER").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/number/UTC/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/number/UTC/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for 0, Date.now()', 0.4, function () {
  if (!T) return false;
  try { return [0, Date.now()].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "2026-11-20", NaN, Infinity, null, new Date()', 0.4, function () {
  if (!T) return false;
  return ['2026-11-20', NaN, Infinity, null, new Date()].every(throws) || false;
}, test.limit.quick);
// goal/G48.4, the box v33: "spirit/type/number/UTC/script.js (YES, DATE IS A FUCKING NUMBER!, default: now".
test.run('its default is now: Date.now() as it is asked', 0.4, function () {
  if (!T) return false;
  const before = Date.now(); const d = T.defaultValue(); const after = Date.now();
  return (typeof d === 'number' && d >= before && d <= after) || false;
}, test.limit.quick);
