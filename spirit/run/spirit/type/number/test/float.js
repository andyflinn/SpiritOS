'use strict';

// spirit/run/spirit/type/number/test/float.js
// The tests of spirit/type/number/float.js, and of no other module (spec: ./float.md). goal/G48.4, Q23; Andy:
// "spirit.type.number.float": a finite number, with or without a fractional part.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'type', 'number', 'float.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/number/float.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for 1.5, 0.01, 0, -3, 1e6', 0.4, function () {
  if (!T) return false;
  try { return [1.5, 0.01, 0, -3, 1e6].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "1.5", NaN, Infinity, null, {}', 0.4, function () {
  if (!T) return false;
  return ['1.5', NaN, Infinity, null, {}].every(throws) || false;
}, test.limit.quick);
