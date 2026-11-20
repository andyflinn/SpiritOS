'use strict';

// spirit/run/spirit/type/string/test/lineSelect.js
// The tests of spirit/type/string/lineSelect.js, and of no other module (spec: ./lineSelect.md). goal/G48.4, Andy:
// "<type>Select.js requires <type>.js, when validating <type>Select.js FIRST checks for \"\", and returns true if the value
// is \"\", it otherwise it lets <type>.js handle the check". spirit.type.string.lineSelect: the words a search narrows by: empty for all, else a line as spirit.type.string.line is.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/lineSelect.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/lineSelect.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "two words", "a".repeat(1024)', 0.4, function () {
  if (!T) return false;
  try { return ["","two words",'a'.repeat(1024)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "a".repeat(1025), "   " (a line is not empty), 5, {}', 0.4, function () {
  if (!T) return false;
  return ['a'.repeat(1025), '   ', 5, {}].every(throws) || false;
}, test.limit.quick);
test.run('its description says empty for all, then the description of its sibling', 0.2, function () {
  if (!T) return false;
  const sib = require(path.join(RUN, 'spirit', 'type', 'string', 'line.js'));
  return T.ruleDescription() === 'empty for all, else ' + sib.ruleDescription() || false;
}, test.limit.quick);
