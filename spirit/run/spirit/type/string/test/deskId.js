'use strict';

// spirit/run/spirit/type/string/test/deskId.js
// The tests of spirit/type/string/deskId.js, and of no other module (spec: ./deskId.md). goal/G48.4:
// spirit.type.string.deskId, a Desk goal or item: goal/G<goal> or goal/G<goal>.<item> (Desk's item ids). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string', 'deskId.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/deskId.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "goal/G48", "goal/G48.4"', 0.4, function () {
  if (!T) return false;
  try { return ["goal/G48", "goal/G48.4"].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "G48.4", "goal/G48.4.1", "goal/g48", "", 5', 0.4, function () {
  if (!T) return false;
  return ["G48.4", "goal/G48.4.1", "goal/g48", "", 5].every(throws) || false;
}, test.limit.quick);
