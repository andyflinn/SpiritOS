'use strict';

// spirit/run/spirit/type/string/test/box.js
// The tests of spirit/type/string/box.js, and of no other module (spec: ./box.md). goal/G48.4:
// spirit.type.string.box, the text of a Desk box: any string, empty too, at most the node's payload limit (Andy: "unlimited strings are forbidden in SpiritOS."). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string', 'box.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/box.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "a\\nb", "a".repeat(T.MAX_BYTES)', 0.4, function () {
  if (!T) return false;
  try { return ["", "a\nb", "a".repeat(T.MAX_BYTES)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "a".repeat(T.MAX_BYTES + 1), 5, null', 0.4, function () {
  if (!T) return false;
  return ["a".repeat(T.MAX_BYTES + 1), 5, null].every(throws) || false;
}, test.limit.quick);
