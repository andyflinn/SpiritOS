'use strict';

// spirit/run/spirit/type/string/test/labelSelect.js
// The tests of spirit/type/string/labelSelect.js, and of no other module (spec: ./labelSelect.md). goal/G48.4:
// spirit.type.string.labelSelect, a label that may be left empty: "" for none, else a label as spirit.type.string.label takes (Andy: "<type>Select.js FIRST checks for "", and returns true if the value is "", it otherwise it lets <type>.js handle the check"). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string', 'labelSelect.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/labelSelect.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "Andy", "a".repeat(64)', 0.4, function () {
  if (!T) return false;
  try { return ["", "Andy", "a".repeat(64)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "a".repeat(65), 5, null', 0.4, function () {
  if (!T) return false;
  return ["a".repeat(65), 5, null].every(throws) || false;
}, test.limit.quick);
