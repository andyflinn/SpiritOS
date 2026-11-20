'use strict';

// spirit/run/spirit/type/string/test/chatWho.js
// The tests of spirit/type/string/chatWho.js, and of no other module (spec: ./chatWho.md). goal/G48.4:
// spirit.type.string.chatWho, the side a Desk chat search keeps: one of '', me, them (its three options). What every type file keeps, and what every
// <type>Select.js keeps beside its sibling, ../../test/boolean-sibling-general.js judges; here, its values.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'type', 'string', 'chatWho.js');

let T = null;
const throws = function (v) { try { T.isValid(v); return false; } catch (e) { return e instanceof Error; } };

test.run('spirit/type/string/chatWho.js exists and loads', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  try { require(path.join(RUN, 'spirit', 'spirit.js')); T = require(FILE); } catch (e) { T = null; }
  return (!!T && typeof T === 'object') || false;
}, test.limit.quick);
test.run('isValid answers true, the boolean, for "", "me", "them"', 0.4, function () {
  if (!T) return false;
  try { return ["", "me", "them"].every(function (v) { return T.isValid(v) === true; }) || false; } catch (e) { return false; }
}, test.limit.quick);
test.run('isValid throws an error for "you", "Me", 5, null', 0.4, function () {
  if (!T) return false;
  return ["you", "Me", 5, null].every(throws) || false;
}, test.limit.quick);
