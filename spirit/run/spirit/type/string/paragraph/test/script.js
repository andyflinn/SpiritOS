'use strict';

// spirit/run/spirit/type/string/paragraph/test/script.js
// The tests of spirit/type/string/paragraph/script.js, and of no other module (spec: ./script.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.paragraph: a paragraph, its limit PARAGRAPH_MAX_BYTES, 2048 bytes.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/testicle/testReport/script.js');
// What it judges, by its run-root path, the one place it is named (goal/G49.6).
const SUBJECT = 'spirit/type/string/paragraph/script.js';
const FILE = path.join(RUN, SUBJECT);

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/paragraph/script.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'script.js')); T = LOADER.requireScript(SUBJECT); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "one line\\nand another", "a".repeat(2048)', 0.4, function () {
  if (!T) return false;
  try { return ['one line\nand another', 'a'.repeat(2048)].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
// Q21 (Andy: "DAMN FCUKING RIGHT: spirit/type/string/paragraph/script.js"): a chat line is a paragraph, and takes the joiner inside an
// emoji such as testicle's runner; every other invisible character stays out.
test.run('isValid answers true for a runner emoji with its joiner, U+200D', 0.4, function () {
  if (!T) return false;
  try { return T.isValid('red: \u{1F3C3}\u200D\u2642\uFE0F a test') === true || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for a zero width space, U+200B, and a soft hyphen, U+00AD', 0.4, function () {
  if (!T) return false;
  return ['zero\u200Bwidth', 'soft\u00ADhyphen'].every(throws) || false;
}, test.limit.quick);
test.run('isValid throws an error for "", "a".repeat(2049), 3, null', 0.4, function () {
  if (!T) return false;
  return ['', 'a'.repeat(2049), 3, null].every(throws) || false;
}, test.limit.quick);
