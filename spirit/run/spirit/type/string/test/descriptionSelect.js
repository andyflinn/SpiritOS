'use strict';

// spirit/run/spirit/type/string/test/descriptionSelect.js
// The tests of spirit/type/string/descriptionSelect.js, and of no other module (spec: ./descriptionSelect.md). goal/G48.4,
// Q22, Andy: "how fucking long does a search string need to be?? isn't description enough?", and "description, 128 bytes
// for a search string is plenty". spirit.type.string.descriptionSelect: the words a search narrows by: empty for all, else
// a description as spirit.type.string.description is.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'type', 'string/descriptionSelect.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/descriptionSelect.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "two words", "a".repeat(128)', 0.4, function () {
  if (!T) return false;
  try { return ['', 'two words', 'a'.repeat(128)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "a".repeat(129), "   " (a description is not empty), 5, {}', 0.4, function () {
  if (!T) return false;
  return ['a'.repeat(129), '   ', 5, {}].every(throws) || false;
}, test.limit.quick);
test.run('its description says empty for all, then the description of its sibling', 0.2, function () {
  if (!T) return false;
  const sib = LOADER.requireScript('spirit/type/string/description.js');
  return T.ruleDescription() === 'empty for all, else ' + sib.ruleDescription() || false;
}, test.limit.quick);
