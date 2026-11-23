'use strict';

// spirit/run/spirit/type/string/test/IDNew.js
// The tests of spirit/type/string/IDNew.js, and of no other module (spec: ./IDNew.md). goal/G48.4, Q12: the key type for
// adding a contact (Andy: "similar to <type>Select.js <type>New.js expands to allowable values."): every key ID takes, and a
// well-formed key nobody here has seen yet. What every type file keeps, and what every <type>New.js keeps,
// ../../test/boolean-sibling-general.js judges; here, the keys.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string', 'IDNew.js');

let T = null;
let fresh = '';
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/IDNew.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true for a well-formed key made just now, which no node has seen', 0.4, function () {
  if (!T) return false;
  try { fresh = spirit.requireScript('spirit/relayAuth.js').generateIdentity('zz-idnew').publicKey; } catch (e) { return false; }
  try { return T.isValid(fresh) === true || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for an item name, an empty string, a key cut short and a key with a space', 0.4, function () {
  if (!T || !fresh) return false;
  return ['goal/G48', '', fresh.slice(0, 20), fresh.slice(0, 10) + ' ' + fresh.slice(11)].every(throws) || false;
}, test.limit.quick);
