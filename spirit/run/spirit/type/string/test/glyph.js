'use strict';

// spirit/run/spirit/type/string/test/glyph.js
// The tests of spirit/type/string/glyph.js, and of no other module (spec: ./glyph.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.glyph: one glyph of at most 32 bytes (Andy: "glyphs are capped at 32 bytes, one character.").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/glyph.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/glyph.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true for one glyph: a bed, a letter, a joined runner of 13 bytes and a joined branch of 25 bytes', 0.4, function () {
  if (!T) return false;
  try { return ['🛌', 'a', '🏃‍♂️', '👨‍👩‍👧‍👦'].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for an empty string, two letters, two beds, one glyph of 41 bytes, 5 and null', 0.4, function () {
  if (!T) return false;
  return ['', 'ab', '🛌🛌', '👨🏻‍👩🏻‍👧🏻‍👦🏻', 5, null].every(throws) || false;
}, test.limit.quick);
