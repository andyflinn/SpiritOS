'use strict';

// spirit/run/spirit/type/string/deskId/test/script.js
// The tests of spirit/type/string/deskId/script.js, and of no other module (spec: ./script.md). goal/G48.4:
// spirit.type.string.deskId, a Desk goal or item: goal/G<goal> or goal/G<goal>.<item> (Desk's item ids). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/deskId/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/deskId/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
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
