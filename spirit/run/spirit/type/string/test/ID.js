'use strict';

// spirit/run/spirit/type/string/test/ID.js
// The tests of spirit/type/string/ID.js, and of no other module (spec: ./ID.md). goal/G48.4, the box: "a type script.js
// is an object containing static functions ... defaultValue() returns a default value that passes validation, and
// isValid(something) return boolean true if something is valid and throws and error if something is NOT valid."
// spirit.type.string.ID: an ID, a public key (the box: "spirit/type/string/ID.js (public keys)").

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string/ID.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/ID.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ="', 0.4, function () {
  if (!T) return false;
  try { return ['MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lzQ='].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
// Its title in words, not the cut key itself: a title is bounded by spirit.type.string.description's 128 bytes.
test.run('isValid throws an error for "goal/G48", "", a key cut short at either end, 5 and null', 0.4, function () {
  if (!T) return false;
  return ['goal/G48', '', 'MCowBQYDK2VwAyEA', 'MCowBQYDK2VwAyEANrNqPPaIac2/NlIHC7C+LoalDe0ub7RvS7U4c6P+lz', 5, null].every(throws) || false;
}, test.limit.quick);
