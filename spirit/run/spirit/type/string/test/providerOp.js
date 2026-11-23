'use strict';

// spirit/run/spirit/type/string/test/providerOp.js
// The tests of spirit/type/string/providerOp.js, and of no other module (spec: ./providerOp.md). goal/G48.4, the box: "options for a
// multiple-choice will be held in a separate script file for each field type that has its own options. so that
// interpreters of data descriptions can use the same function for validation, without knowning if a field is one with
// options....". What every type file keeps (defaultValue, null and undefined refused) ../../test/boolean-sibling-general.js
// judges; here, its choices.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/providerOp.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/providerOp.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('it holds its choices as OPTIONS, a list of distinct non-empty strings', 0.4, function () {
  if (!T || !Array.isArray(T.OPTIONS) || !T.OPTIONS.length) return false;
  return (T.OPTIONS.every(function (o) { return typeof o === 'string' && o.length > 0; }) && new Set(T.OPTIONS).size === T.OPTIONS.length) || false;
}, test.limit.quick);
test.run('isValid answers true for each of its OPTIONS', 0.4, function () {
  if (!T || !Array.isArray(T.OPTIONS)) return false;
  try { return T.OPTIONS.every(function (o) { return T.isValid(o) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for a string that is none of its OPTIONS, for an empty one and for one choice in other case', 0.4, function () {
  if (!T || !Array.isArray(T.OPTIONS) || !T.OPTIONS.length) return false;
  const first = T.OPTIONS[0];
  const flipped = first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase();
  const outside = ['zz-none-of-them', ''].concat(T.OPTIONS.indexOf(flipped) === -1 ? [flipped] : []);
  return outside.every(throws) || false;
}, test.limit.quick);
test.run('isValid throws an error for a value that is no string: 5, true, a list of its choices', 0.4, function () {
  if (!T || !Array.isArray(T.OPTIONS)) return false;
  return [5, true, T.OPTIONS.slice()].every(throws) || false;
}, test.limit.quick);
