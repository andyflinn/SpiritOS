'use strict';

// spirit/run/spirit/type/string/box/test/script.js
// The tests of spirit/type/string/box/script.js, and of no other module (spec: ./script.md). goal/G48.4:
// spirit.type.string.box, the text of a Desk box: any string, empty too, at most the node's payload limit (Andy: "unlimited strings are forbidden in SpiritOS."). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/box/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/box/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
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
